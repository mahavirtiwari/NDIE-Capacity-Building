import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Id, Marksheet, MarksheetRow, MarksheetRowSave } from '../../core/models';
import { MarksheetService } from '../../core/services/marksheet.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { ExamReviewComponent } from './exam-review.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

/** An edit in progress: what is typed, before it has been sent. */
interface Draft {
  written?: number | null;
  skills: Record<number, number | null>;
}

/**
 * The trainer's marksheet for one programme.
 *
 * Laid out the way it is marked — one line per candidate, one column per skill
 * — and saved as a pass rather than a field at a time, because that is how the
 * marking happens: down the list with the trainer, then filed.
 *
 * Nothing here decides a result. The totals shown while typing are a preview;
 * the result is whatever the server says when the marks land, so the portal and
 * the coordinator's app can never disagree about who passed.
 */
@Component({
  selector: 'app-marksheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, StatusBadgeComponent, ExamReviewComponent],
  template: `
    @if (sheet(); as data) {
      <div class="card__body stack stack-md">
        <div class="head">
          <div class="stack stack-xs">
            <strong class="text-sm">{{ data.evaluation.kindLabel }}</strong>
            <span class="text-xs text-muted">{{ pattern() }}</span>
          </div>

          <div class="btn-row btn-row--end">
            @if (data.trainers.length > 0 && data.canEdit) {
              <label class="marked-by">
                <span class="text-xs text-muted">Marked by</span>
                <select class="select select--sm" [(ngModel)]="trainerId">
                  <option [ngValue]="null">Not recorded</option>
                  @for (trainer of data.trainers; track trainer.id) {
                    <option [ngValue]="trainer.id">{{ trainer.fullName }}</option>
                  }
                </select>
              </label>
            }
            @if (data.canEdit) {
              <button
                type="button"
                class="btn btn--ghost"
                [disabled]="dirtyCount() === 0 || saving()"
                (click)="discard()"
              >
                Discard
              </button>
              <button
                type="button"
                class="btn btn--primary"
                [disabled]="dirtyCount() === 0 || saving()"
                (click)="save()"
              >
                @if (saving()) { <span class="spinner"></span> }
                Save {{ dirtyCount() }} candidate{{ dirtyCount() === 1 ? '' : 's' }}
              </button>
            }
          </div>
        </div>

        <span class="text-xs text-muted">
          {{ data.markedCount }} of {{ data.rows.length }} decided · {{ data.passCount }} passed ·
          {{ data.failCount }} did not qualify
          @if (satOnline() > 0) {
            · {{ satOnline() }} sat the paper online
          }
        </span>

        @if (data.readOnlyReason) {
          <div class="alert alert--info">
            <app-icon name="info" [size]="16" />
            <span>{{ data.readOnlyReason }}</span>
          </div>
        }

        @if (data.evaluation.kind === 'None') {
          <div class="alert alert--info">
            <app-icon name="info" [size]="16" />
            <span>{{ copy.text('marksheet.noExam', { programType: data.programTypeName }) }}</span>
          </div>
        } @else if (data.evaluation.hasViva && data.skills.length === 0) {
          <div class="alert alert--warning">
            <app-icon name="alert" [size]="16" />
            <span>{{ copy.text('marksheet.noSkills', { programType: data.programTypeName }) }}</span>
          </div>
        }
      </div>

      @if (data.rows.length > 0 && data.evaluation.kind !== 'None') {
        <div class="table-wrap">
          <table class="table table--compact">
            <thead>
              <tr>
                <th class="sticky-col">Candidate</th>
                <th style="width: 90px" class="text-center">Attd.</th>
                @if (data.evaluation.hasWritten) {
                  <th style="width: 110px" class="text-center">
                    Written<div class="text-xs text-muted">of {{ data.evaluation.writtenMarks }}</div>
                  </th>
                }
                @for (skill of data.skills; track skill.id) {
                  <th style="width: 110px" class="text-center" [title]="skill.description || skill.name">
                    {{ skill.name }}
                    <div class="text-xs text-muted">
                      of {{ skill.maxMarks }}{{ skill.isRetired ? ' · retired' : '' }}
                    </div>
                  </th>
                }
                @if (data.evaluation.hasViva) {
                  <th style="width: 90px" class="text-center">
                    Viva<div class="text-xs text-muted">of {{ data.evaluation.vivaMarks }}</div>
                  </th>
                }
                <th style="width: 90px" class="text-center">
                  Total<div class="text-xs text-muted">of {{ data.evaluation.totalMarks }}</div>
                </th>
                <th style="width: 230px">Result</th>
              </tr>
            </thead>
            <tbody>
              @for (row of data.rows; track row.participantId) {
                <tr [class.is-dirty]="isDirty(row.participantId)">
                  <td class="cell-primary sticky-col">
                    {{ row.name }}
                    <div class="text-xs text-muted">{{ row.applicationNo }}</div>
                  </td>
                  <td class="text-center cell-muted tabular">{{ row.attendancePercent }}%</td>

                  @if (data.evaluation.hasWritten) {
                    <td class="text-center">
                      <input
                        class="input input--mark"
                        type="number"
                        min="0"
                        [max]="data.evaluation.writtenMarks"
                        [disabled]="!data.canEdit || row.isLocked || row.writtenFromExam"
                        [ngModel]="writtenOf(row)"
                        (ngModelChange)="setWritten(row, $event)"
                        [title]="row.writtenFromExam ? 'From the paper sat online' : ''"
                      />
                      @if (row.writtenFromExam) {
                        <!-- The way into the paper behind the mark: somebody
                             looking at a score is usually asking what it was
                             made of. -->
                        <button type="button" class="link-xs" (click)="reviewing.set(row)">
                          {{ copy.text('marksheet.fromExam') }} · {{ row.examPercentage }}%
                        </button>
                      }
                    </td>
                  }

                  @for (skill of data.skills; track skill.id) {
                    <td class="text-center">
                      <input
                        class="input input--mark"
                        type="number"
                        min="0"
                        [max]="skill.maxMarks"
                        [disabled]="!data.canEdit || row.isLocked || skill.isRetired"
                        [ngModel]="skillOf(row, skill.id)"
                        (ngModelChange)="setSkill(row, skill.id, $event)"
                      />
                    </td>
                  }

                  @if (data.evaluation.hasViva) {
                    <td class="text-center tabular">{{ vivaOf(row) ?? '—' }}</td>
                  }
                  <td class="text-center tabular"><strong>{{ totalOf(row) ?? '—' }}</strong></td>

                  <td>
                    @if (isDirty(row.participantId)) {
                      <span class="text-xs text-muted">Not saved yet</span>
                    } @else {
                      <app-status-badge [value]="row.result" />
                      @if (row.isLocked) {
                        <div class="text-xs text-muted">{{ copy.text('marksheet.locked') }}</div>
                      } @else if (row.pending) {
                        <div class="text-xs text-muted">{{ row.pending }}</div>
                      } @else if (row.shortfall) {
                        <div class="text-xs text-muted">{{ row.shortfall }}</div>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (data.rows.length === 0) {
        <div class="card__body">
          <span class="text-sm text-muted">Nobody is enrolled on this programme yet.</span>
        </div>
      }
    } @else {
      <div class="card__body"><span class="text-sm text-muted">Loading the marksheet…</span></div>
    }

    @if (reviewing(); as row) {
      <app-exam-review
        [programmeId]="programmeId()"
        [participantId]="row.participantId"
        [name]="row.name"
        (closed)="reviewing.set(null)"
      />
    }
  `,
  styles: [
    `
      .head {
        align-items: flex-start;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: space-between;
      }
      .marked-by {
        align-items: center;
        display: flex;
        gap: 0.4rem;
      }
      .input--mark {
        max-width: 78px;
        padding: 0.3rem 0.4rem;
        text-align: center;
      }
      .sticky-col {
        background: inherit;
        left: 0;
        position: sticky;
        z-index: 1;
      }
      tbody tr.is-dirty {
        background: var(--warning-50, #fff8e6);
      }
      .link-xs {
        background: none;
        border: 0;
        color: var(--brand-700, #82232f);
        cursor: pointer;
        font-size: 0.72rem;
        padding: 2px 0 0;
        text-decoration: underline;
      }
    `,
  ],
})
export class MarksheetComponent {
  private readonly service = inject(MarksheetService);
  private readonly toast = inject(ToastService);
  protected readonly copy = inject(SiteTextService);

  readonly programmeId = input.required<Id>();

  protected readonly sheet = signal<Marksheet | null>(null);
  protected readonly saving = signal(false);

  /** Who is marking, applied to everything in this pass. */
  protected trainerId: Id | null = null;

  /** The candidate whose sitting is open for review, if any. */
  protected readonly reviewing = signal<MarksheetRow | null>(null);

  /** Edits not sent yet, by participant. */
  private readonly drafts = signal<Record<number, Draft>>({});

  protected readonly dirtyCount = computed(() => Object.keys(this.drafts()).length);

  constructor() {
    effect(() => {
      const id = this.programmeId();
      this.drafts.set({});
      this.service.get(id).subscribe((sheet) => this.sheet.set(sheet));
    });
  }

  /** The pattern in a sentence, so the columns explain themselves. */
  protected readonly pattern = computed(() => {
    const scheme = this.sheet()?.evaluation;
    if (!scheme || scheme.kind === 'None') return '';
    const parts: string[] = [];
    if (scheme.hasWritten) {
      parts.push(`written ${scheme.writtenMarks} (pass ${scheme.writtenPassMarks})`);
    }
    if (scheme.hasViva) parts.push(`viva ${scheme.vivaMarks} (pass ${scheme.vivaPassMarks})`);
    return `Out of ${scheme.totalMarks}: ${parts.join(', ')}. ` +
      `${scheme.overallPassMarks} needed overall.`;
  });

  /** How many written marks came from the online paper rather than a typist. */
  protected readonly satOnline = computed(
    () => this.sheet()?.rows.filter((row) => row.writtenFromExam).length ?? 0,
  );

  protected isDirty(participantId: Id): boolean {
    return this.drafts()[participantId] !== undefined;
  }

  /* ------------------------------------------------- what a cell shows ----
     The draft if there is one, otherwise what was saved. A cleared box is
     null, which is "not marked" — never a silent zero. */

  protected writtenOf(row: MarksheetRow): number | null {
    const draft = this.drafts()[row.participantId];
    return draft && 'written' in draft ? (draft.written ?? null) : (row.writtenMarks ?? null);
  }

  protected skillOf(row: MarksheetRow, skillId: Id): number | null {
    const draft = this.drafts()[row.participantId];
    if (draft && skillId in draft.skills) return draft.skills[skillId] ?? null;
    return row.skillMarks.find((m) => m.skillId === skillId)?.marks ?? null;
  }

  /** Added up as typed, so a trainer sees the total before saving. */
  protected vivaOf(row: MarksheetRow): number | null {
    const skills = this.sheet()?.skills ?? [];
    const marks = skills
      .map((skill) => this.skillOf(row, skill.id))
      .filter((mark): mark is number => mark !== null);
    return marks.length > 0 ? marks.reduce((sum, mark) => sum + mark, 0) : null;
  }

  protected totalOf(row: MarksheetRow): number | null {
    const scheme = this.sheet()?.evaluation;
    if (!scheme) return null;
    const written = scheme.hasWritten ? this.writtenOf(row) : 0;
    const viva = scheme.hasViva ? this.vivaOf(row) : 0;
    if (written === null || viva === null) return null;
    return written + viva;
  }

  /* --------------------------------------------------------- editing */

  protected setWritten(row: MarksheetRow, value: unknown): void {
    const marks = toMark(value);
    this.edit(row, (draft) => ({ ...draft, written: marks }));
  }

  protected setSkill(row: MarksheetRow, skillId: Id, value: unknown): void {
    const marks = toMark(value);
    this.edit(row, (draft) => ({ ...draft, skills: { ...draft.skills, [skillId]: marks } }));
  }

  private edit(row: MarksheetRow, change: (draft: Draft) => Draft): void {
    this.drafts.update((all) => {
      const current = all[row.participantId] ?? { skills: {} };
      return { ...all, [row.participantId]: change(current) };
    });
  }

  protected discard(): void {
    this.drafts.set({});
  }

  /* ----------------------------------------------------------- saving */

  protected save(): void {
    const sheet = this.sheet();
    const drafts = this.drafts();
    if (!sheet || Object.keys(drafts).length === 0) return;

    const rows: MarksheetRowSave[] = Object.entries(drafts).map(([id, draft]) => ({
      participantId: Number(id),
      /* Omitted unless it was touched: a sheet that never showed the written
         column must not send null and wipe it. */
      ...('written' in draft ? { writtenMarks: draft.written ?? null } : {}),
      trainerId: this.trainerId,
      skillMarks: Object.entries(draft.skills).map(([skillId, marks]) => ({
        skillId: Number(skillId),
        marks: marks ?? 0,
        /* An emptied box takes the mark back rather than recording a zero. */
        clear: marks === null,
      })),
    }));

    this.saving.set(true);
    this.service.save(sheet.programmeId, { rows }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.drafts.set({});
        this.sheet.set(saved);
        this.toast.success(
          'Marks saved',
          `${saved.passCount} passed, ${saved.failCount} did not qualify.`,
        );
      },
      error: () => this.saving.set(false),
    });
  }
}

/** An empty box is "not marked"; anything else is a number or it is ignored. */
function toMark(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
