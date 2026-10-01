import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FeedbackForm,
  FeedbackQuestion,
  FeedbackQuestionType,
  FeedbackSummary,
  LookupItem,
  OptionSet,
  RecordStatus,
} from '../../core/models';
import { FeedbackFormService, LookupService, OptionSetService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'programTypeName', header: 'Program type', sortable: true, variant: 'primary' },
  { key: 'title', header: 'Title' },
  { key: 'questionCount', header: 'Questions', align: 'center', width: '110px' },
  { key: 'responseCount', header: 'Answers', align: 'center', width: '110px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '140px', align: 'right' },
];

const TYPES: { value: FeedbackQuestionType; label: string }[] = [
  { value: 'Rating', label: 'Rating out of five' },
  { value: 'YesNo', label: 'Yes or no' },
  { value: 'Select', label: 'Choose one (dropdown)' },
  { value: 'Radio', label: 'Choose one (buttons)' },
  { value: 'Text', label: 'Free text' },
];

/**
 * What a programme type asks its participants once a batch is over.
 *
 * One form per programme type: the questions worth asking about a
 * five-day assessor course are the same whichever batch of it somebody
 * sat, and a form per batch would make the answers impossible to compare
 * across the year.
 *
 * The answers come back anonymously, and that is a fact about how they
 * are stored rather than a promise made here — which is why the responses
 * view can only ever count, average and list the comments.
 */
@Component({
  selector: 'app-feedback-forms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    StatusToggleComponent,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      icon="clipboard"
      title="Feedback forms"
      subtitle="What a program type asks its participants once a batch has been conducted."
      [breadcrumbs]="[{ label: 'Academics' }, { label: 'Feedback forms' }]"
    >
      <button *appCan="'curriculum.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New feedback form
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <label class="field-label" for="fbSearch">Search</label>
            <input
              id="fbSearch"
              class="input"
              placeholder="Program type"
              (input)="list.setSearch(term($event))"
            />
          </div>
          <div class="field">
            <label class="field-label" for="fbType">Program type</label>
            <select
              id="fbType"
              class="select"
              [value]="list.stagedValue('programTypeId')"
              (change)="list.stageFilter('programTypeId', value($event))"
            >
              <option value="">All</option>
              @for (type of programTypes(); track type.id) {
                <option [value]="type.id">{{ type.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="fbStatus">Status</label>
            <select
              id="fbStatus"
              class="select"
              [value]="list.stagedValue('status')"
              (change)="list.stageFilter('status', value($event))"
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--primary" (click)="list.applyFilters()">
              <app-icon name="filter" [size]="15" /> Apply
            </button>
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Feedback forms"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No feedback forms"
        emptyIcon="clipboard"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="questionCount" let-row>
          <span class="chip">{{ $any(row).questions.length }}</span>
        </ng-template>
        <ng-template appCell="responseCount" let-row>
          @if ($any(row).responseCount) {
            <span class="chip">{{ $any(row).responseCount }}</span>
          } @else {
            <span class="cell-muted">—</span>
          }
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button
              type="button"
              class="btn btn--icon"
              title="Answers"
              (click)="openSummary($any(row))"
            >
              <app-icon name="list" [size]="15" />
            </button>
            <button
              *appCan="'curriculum.manage'"
              type="button"
              class="btn btn--icon"
              title="Edit"
              (click)="openForm($any(row))"
            >
              <app-icon name="edit" [size]="15" />
            </button>
            <app-status-toggle
              [status]="$any(row).status"
              (toggled)="setStatus($any(row), $event)"
            />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit feedback form' : 'New feedback form'"
        subtitle="Asked once a batch of this program type has been conducted."
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="feedback-form" (ngSubmit)="save()" class="form-grid">
          <div class="field">
            <label class="field-label" for="fbProgramType">
              Program type <span class="req">*</span>
            </label>
            <select
              id="fbProgramType"
              class="select"
              formControlName="programTypeId"
              [attr.disabled]="editing() ? true : null"
            >
              <option [ngValue]="null">Select</option>
              @for (type of programTypes(); track type.id) {
                <option [ngValue]="type.id">{{ type.name }}</option>
              }
            </select>
            <span class="field-hint">One form per program type. Fixed once it exists.</span>
          </div>

          <div class="field">
            <label class="field-label" for="fbTitle">Title <span class="req">*</span></label>
            <input id="fbTitle" class="input" formControlName="title" />
          </div>

          <div class="field field--span-2">
            <label class="field-label" for="fbIntro">Opening line</label>
            <input
              id="fbIntro"
              class="input"
              formControlName="intro"
              placeholder="Your answers are anonymous."
            />
          </div>

          <!-- The questions. Added one at a time rather than typed as a
               block, because each carries a type and the choices that go
               with it. -->
          <div class="field field--span-2">
            <div class="row row-between">
              <span class="field-label">Questions</span>
              <button type="button" class="btn btn--sm btn--secondary" (click)="addQuestion()">
                <app-icon name="plus" [size]="14" /> Add question
              </button>
            </div>

            @if (questions().length === 0) {
              <p class="text-sm text-muted">Nothing asked yet. Add the first question.</p>
            }

            <div class="stack stack-sm">
              @for (q of questions(); track $index) {
                <div class="card card--inset">
                  <div class="card__body stack stack-sm">
                    <div class="row row-sm">
                      <input
                        class="input"
                        [value]="q.text"
                        placeholder="How would you rate the trainer?"
                        (input)="patch($index, { text: inputValue($event) })"
                      />
                      <select
                        class="select select--narrow"
                        [value]="q.type"
                        (change)="patch($index, { type: $any(inputValue($event)) })"
                      >
                        @for (t of types; track t.value) {
                          <option [value]="t.value" [selected]="t.value === q.type">
                            {{ t.label }}
                          </option>
                        }
                      </select>
                      <button
                        type="button"
                        class="btn btn--icon btn--subtle-danger"
                        title="Remove"
                        (click)="removeQuestion($index)"
                      >
                        <app-icon name="trash" [size]="15" />
                      </button>
                    </div>

                    @if (q.type === 'Select' || q.type === 'Radio') {
                      <div class="row row-sm">
                        <!-- Each option says whether it is the chosen one. The
                             select's own [value] is set before @for has made
                             any options to match it, so on reopening a saved
                             form it would fall back to the first one. -->
                        <select
                          class="select"
                          [value]="q.optionSetId ?? ''"
                          (change)="patch($index, { optionSetId: setId(inputValue($event)) })"
                        >
                          <option value="">Its own choices</option>
                          @for (set of optionSets(); track set.id) {
                            <option [value]="set.id" [selected]="set.id === q.optionSetId">
                              {{ set.name }} ({{ set.items.length }})
                            </option>
                          }
                        </select>
                        @if (!q.optionSetId) {
                          <input
                            class="input"
                            [value]="labelsOf(q)"
                            placeholder="Choices, comma separated"
                            (input)="setChoices($index, inputValue($event))"
                          />
                        }
                      </div>
                    }

                    <label class="check">
                      <input
                        type="checkbox"
                        [checked]="q.required"
                        (change)="patch($index, { required: checked($event) })"
                      />
                      <span>Must be answered</span>
                    </label>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="fbStatusSel">Status</label>
            <select id="fbStatusSel" class="select" formControlName="status">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          @if (editing()?.responseCount) {
            <div class="field field--span-2">
              <p class="text-sm text-muted">
                {{ editing()?.responseCount }} people have already answered. Rewording a
                question keeps their answers; removing one leaves them with nothing to be
                read against, so switch the form off instead if it has had its day.
              </p>
            </div>
          }
        </form>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="feedback-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save form
          </button>
        </div>
      </app-modal>
    }

    @if (summary(); as report) {
      <app-modal
        [title]="report.programTypeName ?? 'Feedback'"
        [subtitle]="report.responseCount + ' answered · nobody is named, by design'"
        size="lg"
        (closed)="summary.set(null)"
      >
        @if (report.responseCount === 0) {
          <p class="text-muted text-sm">Nobody has answered yet.</p>
        } @else {
          <div class="stack stack-md">
            @for (q of report.questions; track q.key) {
              <div class="detail-group">
                <h4 class="section-title">{{ q.text }}</h4>

                @if (q.average !== null && q.average !== undefined) {
                  <p class="text-sm">
                    <strong>{{ q.average }}</strong> out of five, from {{ q.answered }} answers.
                  </p>
                } @else if (q.tally.length) {
                  <div class="stack stack-xs">
                    @for (t of q.tally; track t.value) {
                      <div class="row row-sm">
                        <span class="text-sm">{{ t.label }}</span>
                        <span class="chip">{{ t.count }}</span>
                      </div>
                    }
                  </div>
                } @else if (q.comments.length) {
                  <div class="stack stack-xs">
                    @for (c of q.comments; track $index) {
                      <p class="text-sm text-muted">&ldquo;{{ c }}&rdquo;</p>
                    }
                  </div>
                } @else {
                  <p class="text-sm text-muted">No answers to this one.</p>
                }
              </div>
            }
          </div>
        }

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="summary.set(null)">
            Close
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class FeedbackFormsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(FeedbackFormService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;
  protected readonly types = TYPES;
  protected readonly term = searchTerm;
  protected readonly value = (e: Event) => (e.target as HTMLSelectElement).value;
  protected readonly inputValue = (e: Event) => (e.target as HTMLInputElement).value;
  protected readonly checked = (e: Event) => (e.target as HTMLInputElement).checked;
  protected readonly exportRows = () => this.list.fetchAll();

  protected readonly programTypes = toSignal(inject(LookupService).programTypes(null), {
    initialValue: [] as LookupItem[],
  });
  protected readonly optionSets = toSignal(inject(OptionSetService).all(), {
    initialValue: [] as OptionSet[],
  });

  protected readonly list = new ListState<FeedbackForm>((r) => this.service.list(r), {
    sortBy: 'programTypeName',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<FeedbackForm | null>(null);
  protected readonly summary = signal<FeedbackSummary | null>(null);
  protected readonly questions = signal<FeedbackQuestion[]>([]);

  protected readonly form = this.fb.group({
    programTypeId: [null as number | null, [Validators.required]],
    title: ['Your feedback', [Validators.required]],
    intro: [''],
    status: ['Active' as RecordStatus],
  });

  protected labelsOf(q: FeedbackQuestion): string {
    return q.options.map((o) => o.label).join(', ');
  }

  protected setId(value: string): number | null {
    return value ? Number(value) : null;
  }

  protected patch(index: number, change: Partial<FeedbackQuestion>): void {
    this.questions.update((list) =>
      list.map((q, i) => (i === index ? { ...q, ...change } : q)),
    );
  }

  protected setChoices(index: number, text: string): void {
    const options = text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((label) => ({ value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label }));
    this.patch(index, { options });
  }

  protected addQuestion(): void {
    this.questions.update((list) => [
      ...list,
      {
        id: 0,
        key: '',
        text: '',
        type: 'Rating' as FeedbackQuestionType,
        required: true,
        displayOrder: list.length + 1,
        maxRating: 5,
        options: [],
      },
    ]);
  }

  protected removeQuestion(index: number): void {
    this.questions.update((list) => list.filter((_, i) => i !== index));
  }

  protected openForm(row?: FeedbackForm): void {
    this.editing.set(row ?? null);
    this.questions.set(row ? row.questions.map((q) => ({ ...q, options: [...q.options] })) : []);
    this.form.reset({
      programTypeId: row?.programTypeId ?? null,
      title: row?.title ?? 'Your feedback',
      intro: row?.intro ?? '',
      status: row?.status ?? ('Active' as RecordStatus),
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected openSummary(row: FeedbackForm): void {
    this.service.summary(row.programTypeId).subscribe((report) => this.summary.set(report));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const live = this.questions().filter((q) => q.text.trim().length > 0);
    if (live.length === 0) {
      this.toast.warning('No questions', 'A feedback form needs at least one question.');
      return;
    }

    const body = { ...this.form.getRawValue(), questions: live };
    const current = this.editing();

    this.saving.set(true);
    const request = current
      ? this.service.update(current.id, body)
      : this.service.create(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Feedback form saved');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected setStatus(row: FeedbackForm, status: RecordStatus): void {
    this.service.setStatus(row.id, status).subscribe(() => this.list.reload());
  }
}
