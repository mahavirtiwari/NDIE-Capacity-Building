import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  LoadedPhoto,
  ProfileField,
  ProfileForm,
  ProfileSubmission,
  RejectionReason,
} from '../../core/models';
import { ProfileFormService } from '../../core/services/academics.service';
import {
  ProfileSubmissionService,
  RejectionReasonService,
} from '../../core/services/workflow.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { DynamicFormComponent } from '../../shared/components/dynamic-form.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { TimelineComponent } from '../../shared/components/timeline.component';

/**
 * One profile, read in full and decided on.
 *
 * Laid out the way the application sheet was, because it answers the same
 * question and reading them should feel the same: the form down the middle
 * under its own sections, who the applicant is and where the profile stands
 * down the side, and the decision at the top where it is not hunted for.
 *
 * The form is rendered by the same component the applicant filled it in, in
 * read-only mode. A scrutiny officer sees the sections, the labels and the
 * order the applicant saw — not a list of storage keys, which is what a flat
 * dump of the answers amounts to.
 */
@Component({
  selector: 'app-profile-scrutiny-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    DynamicFormComponent,
    IconComponent,
    ModalComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    TimelineComponent,
  ],
  template: `
    @if (submission(); as record) {
      <app-page-header
        [title]="record.applicantName ?? 'Profile'"
        [subtitle]="
          (record.applicantCode ?? '') + ' · ' + record.categoryName + ' · ' +
          record.subCategoryName + ' · attempt ' + record.attemptNo
        "
        icon="user-check"
        [breadcrumbs]="[
          { label: 'Administration' },
          { label: 'Profile scrutiny', link: '/admin/profile-scrutiny' },
          { label: record.applicantCode ?? 'Profile' }
        ]"
      >
        <a class="btn btn--secondary" routerLink="/admin/profile-scrutiny">
          <app-icon name="chevron-left" [size]="15" /> Back to profile scrutiny
        </a>
<!-- The decision belongs to the Operation Manager the profile was
             placed with, and to nobody else. The tiers above read the
             register to see where things stand; offering them buttons the
             server refuses only invites the question of why they failed. -->
        @if (canDecide(record)) {
          <button type="button" class="btn btn--danger" (click)="askToReject()" [disabled]="saving()">
            <app-icon name="x" [size]="15" /> Reject
          </button>
          <button type="button" class="btn btn--success" (click)="accept()" [disabled]="saving()">
            <app-icon name="check" [size]="15" /> Accept
          </button>
        }
      </app-page-header>

      <div class="detail-grid">
        <div class="stack stack-md">
          <section class="card">
            <div class="tabs" style="padding: 0 1rem">
              <button type="button" class="tab" [class.is-active]="tab() === 'form'" (click)="tab.set('form')">
                Profile form
              </button>
              <button type="button" class="tab" [class.is-active]="tab() === 'history'" (click)="tab.set('history')">
                History ({{ record.history.length }})
              </button>
            </div>

            <div class="card__body">
              @switch (tab()) {
                @case ('form') {
                  @if (definition(); as form) {
                    <app-dynamic-form
                      [definition]="form"
                      [values]="$any(record.responses)"
                      [photos]="photos()"
                      [readonly]="true"
                    />
                  } @else {
                    <p class="text-sm text-muted">
                      Loading the profile form for this discipline…
                    </p>
                  }
                }
                @default {
                  <app-timeline
                    [events]="historyEvents(record)"
                    emptyMessage="No activity recorded yet."
                  />
                }
              }
            </div>
          </section>
        </div>

        <aside class="stack stack-md">
          <!-- Tinted and first: where the profile stands is what the side
               column is opened for. -->
          <section class="panel panel--accent">
            <h2 class="panel__head">
              <app-icon name="flag" [size]="14" /> Status
              <app-status-badge class="panel__aside" [value]="record.status" />
            </h2>
            <div class="panel__body">
              <div class="fact">
                <span class="fact__term">Submitted on</span>
                <span class="fact__value">
                  {{ record.submittedOn ? (record.submittedOn | date: 'dd MMM yyyy') : '—' }}
                </span>
              </div>
              <div class="fact">
                <span class="fact__term">Attempt</span>
                <span class="fact__value tabular">{{ record.attemptNo }}</span>
              </div>
              <div class="fact">
                <span class="fact__term">Assigned to</span>
                <span class="fact__value">{{ record.assignedToName || 'Unassigned' }}</span>
                <!-- Nobody places these by hand any more, so the sheet has
                     to say how the desk was chosen. -->
                <span class="text-xs text-muted">
                  Chosen automatically from the managers whose program types and states
                  cover this profile.
                </span>
              </div>
            </div>
          </section>

          <section class="panel">
            <h2 class="panel__head"><app-icon name="user-check" [size]="14" /> Applicant</h2>
            <div class="panel__body">
              <div class="fact">
                <span class="fact__term">Applicant ID</span>
                <span class="fact__value"><code>{{ record.applicantCode }}</code></span>
              </div>
              <div class="fact">
                <span class="fact__term">Category</span>
                <span class="fact__value">{{ record.categoryName }}</span>
              </div>
              <div class="fact">
                <span class="fact__term">Sub-category</span>
                <span class="fact__value">{{ record.subCategoryName }}</span>
              </div>
            </div>
          </section>

          <!-- What was decided, once it has been. Everybody sees this, the
               manager who decided included: it is the record of the outcome
               rather than the means of reaching one, and the reason an
               applicant was turned down is the part the rest of the office
               actually needs to read. Nothing stands here while a profile is
               still open, because there is nothing yet to report. -->
          @if (record.decidedOn) {
            <section class="panel">
              <h2 class="panel__head">
                <app-icon name="clipboard" [size]="14" /> Decision
                <app-status-badge class="panel__aside" [value]="record.status" />
              </h2>
              <div class="panel__body">
                <div class="fact">
                  <span class="fact__term">Decided</span>
                  <span class="fact__value">
                    {{ record.decidedOn | date: 'dd MMM yyyy, h:mm a' }}
                  </span>
                </div>
                @if (record.decidedByUserName) {
                  <div class="fact">
                    <span class="fact__term">By</span>
                    <span class="fact__value">{{ record.decidedByUserName }}</span>
                  </div>
                }
                @if (record.rejectionReasonLabel) {
                  <div class="fact">
                    <span class="fact__term">Reason</span>
                    <span class="fact__value text-danger">{{ record.rejectionReasonLabel }}</span>
                  </div>
                }
                @if (record.remarks) {
                  <div class="fact">
                    <span class="fact__term">Remarks</span>
                    <span class="fact__value">{{ record.remarks }}</span>
                  </div>
                }
              </div>
            </section>
          }
        </aside>
      </div>
<!-- Asked for at the moment of rejecting, rather than sitting open
           beside a profile nobody has decided on. A reason is required: the
           applicant is told why and has to be able to put it right. -->
      @if (rejecting()) {
        <app-modal
          title="Reject this profile"
          [subtitle]="(record.applicantName ?? '') + ' · ' + (record.applicantCode ?? '')"
          size="sm"
          (closed)="rejecting.set(false)"
        >
          <form [formGroup]="decision" class="stack stack-sm">
            <div class="field">
              <label class="field-label" for="pdReason">Reason <span class="req">*</span></label>
              <select id="pdReason" class="select" formControlName="rejectionReasonId">
                <option [ngValue]="null">Select a reason</option>
                @for (reason of reasons(); track reason.id) {
                  <option [ngValue]="reason.id">{{ reason.label }}</option>
                }
              </select>
              <span class="field-hint">The applicant is told this, and can send it again.</span>
            </div>
            <div class="field">
              <label class="field-label" for="pdRemarks">Remarks</label>
              <textarea
                id="pdRemarks"
                class="input"
                rows="4"
                formControlName="remarks"
                placeholder="Anything the applicant should know"
              ></textarea>
            </div>
          </form>

          <div footer>
            <button type="button" class="btn btn--secondary" (click)="rejecting.set(false)">
              Cancel
            </button>
            <button type="button" class="btn btn--danger" (click)="reject()" [disabled]="saving()">
              <app-icon name="x" [size]="15" />
              {{ saving() ? 'Rejecting…' : 'Reject profile' }}
            </button>
          </div>
        </app-modal>
      }
    } @else {
      <div class="card" style="height: 320px"></div>
    }
  `,
  styles: [
    `
      .detail-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 1rem;
        align-items: start;
      }
      /* The side stays where it is while the form scrolls past it.

         A profile runs to several screens, and the two things a reader
         keeps glancing at — where it stands, and what was decided — were
         at the top of a column that had already gone. Only where there is
         the height to do it; on a short window a stuck panel is a panel
         with its own scrollbar, which is worse than one that moves. */
      @media (min-width: 1101px) and (min-height: 720px) {
        .detail-grid > aside {
          position: sticky;
          top: 1rem;
        }
      }
      @media (max-width: 1100px) {
        .detail-grid { grid-template-columns: minmax(0, 1fr); }
      }
      /* A panel heading is a flex row, so anything after the title goes
         to the far end of it rather than trailing the words. */
      .panel__aside { margin-left: auto; }

      .text-danger { color: var(--danger-700); }
      .req { color: var(--danger-600); }
    `,
  ],
})
export class ProfileScrutinyDetailComponent {
  readonly id = input.required<string>();

  private readonly service = inject(ProfileSubmissionService);
  private readonly forms = inject(ProfileFormService);
  private readonly reasonService = inject(RejectionReasonService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly submission = signal<ProfileSubmission | null>(null);
  protected readonly definition = signal<ProfileForm | null>(null);
  protected readonly tab = signal<'form' | 'history'>('form');
  protected readonly saving = signal(false);
  protected readonly rejecting = signal(false);

  /** The pictures for every camera field on this form, keyed by field key. */
  protected readonly photos = signal<Record<string, LoadedPhoto[]>>({});

  /* Only the reasons still switched on: a retired one stays on the
     submissions that cite it but must not be handed out again. */
  protected readonly reasons = toSignal(this.reasonService.list(true), {
    initialValue: [] as RejectionReason[],
  });

  protected readonly decision = this.fb.group({
    rejectionReasonId: [null as number | null],
    remarks: [''],
  });

  constructor() {
    /* Registered once, not inside the effect: the effect re-runs whenever
       the route id changes, and a teardown added on each run would be a
       handler per visit for the lifetime of the screen. */
    this.destroyRef.onDestroy(() => this.revokePhotos());

    effect(() => {
      const id = Number(this.id());
      if (!id) return;

      this.service.getById(id).subscribe((record) => {
        this.submission.set(record);

        /* The form it was filled against, so the answers read in their own
           sections rather than as a list of keys. */
        this.forms.bySubCategory(record.subCategoryId).subscribe({
          next: (form) => {
            this.definition.set(form);
            if (form) this.loadPhotos(record.id, form);
          },
          error: () => this.definition.set(null),
        });
      });
    });
  }

  /**
   * Fetches every picture the form's camera fields hold.
   *
   * Two steps per field: the register of what is there, then the bytes of
   * each one. The images need the bearer token, which an <img src> cannot
   * carry, so each becomes an object URL — and every one of those is a
   * handle on memory that the browser only releases when told, which is
   * what the teardown below is for.
   */
  private loadPhotos(id: number, form: ProfileForm): void {
    this.revokePhotos();
    this.photos.set({});

    const camera = form.sections
      .flatMap((section) => section.fields as ProfileField[])
      .filter((field) => field.type === 'photos');

    for (const field of camera) {
      this.service.photos(id, field.key).subscribe({
        next: (shots) => {
          for (const shot of shots) {
            this.service.photo(id, field.key, shot.displayOrder).subscribe({
              next: (blob) => {
                const loaded: LoadedPhoto = { ...shot, url: URL.createObjectURL(blob) };
                this.photos.update((held) => {
                  const forField = [...(held[field.key] ?? []), loaded]
                    .sort((a, b) => a.displayOrder - b.displayOrder);
                  return { ...held, [field.key]: forField };
                });
              },
              /* One picture that will not load must not take the others
                 with it; the rest of the set still tells the officer
                 most of what they need. */
              error: () => undefined,
            });
          }
        },
        error: () => undefined,
      });
    }
  }

  private revokePhotos(): void {
    for (const shots of Object.values(this.photos())) {
      for (const shot of shots) URL.revokeObjectURL(shot.url);
    }
  }

  protected isOpen(record: ProfileSubmission): boolean {
    return record.status === 'Submitted' || record.status === 'UnderScrutiny';
  }

  /**
   * Whether this account may decide this profile.
   *
   * The Operation Manager it was placed with, and only while it is still
   * open. The server holds the same rule — this hides a button that would
   * not work, which is not the same thing as enforcing anything.
   */
  protected canDecide(record: ProfileSubmission): boolean {
    return this.isOpen(record) && this.auth.hasRole('OperationManager');
  }

  /** The scrutiny events, in the shape the shared timeline reads. */
  protected historyEvents(record: ProfileSubmission) {
    return record.history.map((event) => ({
      on: event.on,
      area: 'Profile',
      title: event.action,
      detail: event.remarks ?? undefined,
      reference: event.rejectionReasonLabel ?? undefined,
      by: event.byUserName,
    }));
  }

  protected askToReject(): void {
    this.decision.reset({ rejectionReasonId: null, remarks: '' });
    this.rejecting.set(true);
  }

  protected accept(): void {
    this.decide('approve');
  }

  protected reject(): void {
    if (!this.decision.getRawValue().rejectionReasonId) {
      this.toast.error('Choose a reason', 'A profile turned down has to say what for.');
      return;
    }
    this.decide('reject');
  }

  private decide(kind: 'approve' | 'reject'): void {
    const record = this.submission();
    if (!record) return;

    const raw = this.decision.getRawValue();
    const remarks = (raw.remarks ?? '').trim();

    this.saving.set(true);
    const call =
      kind === 'approve'
        ? this.service.approve(record.id, { remarks })
        : this.service.reject(record.id, {
            remarks,
            rejectionReasonId: raw.rejectionReasonId,
          });

    call.subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.rejecting.set(false);
        this.submission.set(updated);
        this.toast.success(
          kind === 'approve' ? 'Profile accepted' : 'Profile rejected',
          record.applicantCode ?? '',
        );
        void this.router.navigate(['/admin/profile-scrutiny']);
      },
      error: () => this.saving.set(false),
    });
  }
}
