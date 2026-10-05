import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LookupItem, ProfileForm, ProfileSubmission, RejectionReason } from '../../core/models';
import { ProfileFormService } from '../../core/services/academics.service';
import { LookupService } from '../../core/services/masters.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ProfileSubmissionService,
  RejectionReasonService,
} from '../../core/services/workflow.service';
import { ToastService } from '../../core/services/toast.service';
import { DynamicFormComponent } from '../../shared/components/dynamic-form.component';
import { IconComponent } from '../../shared/components/icon.component';
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
        @if (isOpen(record)) {
          <button type="button" class="btn btn--danger" (click)="decide('reject')" [disabled]="saving()">
            <app-icon name="x" [size]="15" /> Turn down
          </button>
          <button type="button" class="btn btn--success" (click)="decide('approve')" [disabled]="saving()">
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
          <section class="card">
            <div class="card__header">
              <span class="card__title">Status</span>
              <app-status-badge [value]="record.status" />
            </div>
            <div class="card__body">
              <div class="dl">
                <div>
                  <div class="dl__term">Submitted on</div>
                  <div class="dl__value">
                    {{ record.submittedOn ? (record.submittedOn | date: 'dd MMM yyyy') : '—' }}
                  </div>
                </div>
                <div>
                  <div class="dl__term">Attempt</div>
                  <div class="dl__value">{{ record.attemptNo }}</div>
                </div>
                <div>
                  <div class="dl__term">Assigned to</div>
                  <div class="dl__value">{{ record.assignedToName || 'Unassigned' }}</div>
                </div>
                @if (record.decidedOn) {
                  <div>
                    <div class="dl__term">Decided</div>
                    <div class="dl__value">
                      {{ record.decidedOn | date: 'dd MMM yyyy' }}
                      @if (record.decidedByUserName) { by {{ record.decidedByUserName }} }
                    </div>
                  </div>
                }
                @if (record.rejectionReasonLabel) {
                  <div>
                    <div class="dl__term">Reason</div>
                    <div class="dl__value text-danger">{{ record.rejectionReasonLabel }}</div>
                  </div>
                }
              </div>
              @if (canReassign()) {
                <div class="field" style="margin-top: 0.6rem">
                  <label class="field-label" for="pdAssign">Reassign</label>
                  <select id="pdAssign" class="select" (change)="reassign($event)">
                    <option value="">Select an operation manager</option>
                    @for (officer of officers(); track officer.id) {
                      <option [value]="officer.id" [selected]="officer.id === record.assignedToUserId">
                        {{ officer.name }}
                      </option>
                    }
                  </select>
                  <span class="field-hint">
                    Chosen automatically when the profile arrives, from the managers
                    whose program types and states cover it.
                  </span>
                </div>
              }
            </div>
          </section>

          <section class="card">
            <div class="card__header"><span class="card__title">Applicant</span></div>
            <div class="card__body">
              <div class="dl">
                <div>
                  <div class="dl__term">Applicant ID</div>
                  <div class="dl__value"><code>{{ record.applicantCode }}</code></div>
                </div>
                <div>
                  <div class="dl__term">Category</div>
                  <div class="dl__value">{{ record.categoryName }}</div>
                </div>
                <div>
                  <div class="dl__term">Sub-category</div>
                  <div class="dl__value">{{ record.subCategoryName }}</div>
                </div>
              </div>
            </div>
          </section>

          <!-- The decision, beside what it is being made about. A reason is
               required only when turning a profile down, so the applicant is
               told why and can put it right. -->
          @if (isOpen(record)) {
            <section class="card">
              <div class="card__header"><span class="card__title">Decision</span></div>
              <div class="card__body">
                <form [formGroup]="decision" class="stack stack-sm">
                  <div class="field">
                    <label class="field-label" for="pdReason">Reason, if turning it down</label>
                    <select id="pdReason" class="select" formControlName="rejectionReasonId">
                      <option [ngValue]="null">Select a reason</option>
                      @for (reason of reasons(); track reason.id) {
                        <option [ngValue]="reason.id">{{ reason.label }}</option>
                      }
                    </select>
                    <span class="field-hint">
                      Required to turn a profile down. Ignored when accepting.
                    </span>
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
              </div>
            </section>
          }
        </aside>
      </div>
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
      @media (max-width: 1100px) {
        .detail-grid { grid-template-columns: minmax(0, 1fr); }
      }
      .text-danger { color: var(--danger-700); }
    `,
  ],
})
export class ProfileScrutinyDetailComponent {
  readonly id = input.required<string>();

  private readonly service = inject(ProfileSubmissionService);
  private readonly forms = inject(ProfileFormService);
  private readonly reasonService = inject(RejectionReasonService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly lookups = inject(LookupService);
  private readonly auth = inject(AuthService);

  protected readonly submission = signal<ProfileSubmission | null>(null);
  protected readonly definition = signal<ProfileForm | null>(null);
  protected readonly tab = signal<'form' | 'history'>('form');
  protected readonly saving = signal(false);

  /* Only the reasons still switched on: a retired one stays on the
     submissions that cite it but must not be handed out again. */
  protected readonly reasons = toSignal(this.reasonService.list(true), {
    initialValue: [] as RejectionReason[],
  });

  protected readonly decision = this.fb.group({
    rejectionReasonId: [null as number | null],
    remarks: [''],
  });

  /* Who a profile may be handed to. Operation Managers only — scrutiny is
     theirs, and offering anybody else is offering something the server
     refuses. */
  protected readonly officers = toSignal(this.lookups.operationManagers(), {
    initialValue: [] as LookupItem[],
  });

  /* Reassignment belongs to the tier above. A manager cannot hand their own
     queue to somebody else, which is the same rule the server enforces. */
  protected readonly canReassign = computed(() =>
    this.auth.hasRole('SuperAdmin', 'Ministry', 'Admin'),
  );

  protected reassign(event: Event): void {
    const record = this.submission();
    const value = (event.target as HTMLSelectElement).value;
    if (!record || !value) return;

    this.service.assign(record.id, Number(value)).subscribe((updated) => {
      this.submission.set(updated);
      this.toast.success('Profile reassigned', updated.assignedToName ?? '');
    });
  }

  constructor() {
    effect(() => {
      const id = Number(this.id());
      if (!id) return;

      this.service.getById(id).subscribe((record) => {
        this.submission.set(record);

        /* The form it was filled against, so the answers read in their own
           sections rather than as a list of keys. */
        this.forms.bySubCategory(record.subCategoryId).subscribe({
          next: (form) => this.definition.set(form),
          error: () => this.definition.set(null),
        });
      });
    });
  }

  protected isOpen(record: ProfileSubmission): boolean {
    return record.status === 'Submitted' || record.status === 'UnderScrutiny';
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

  protected decide(kind: 'approve' | 'reject'): void {
    const record = this.submission();
    if (!record) return;

    const raw = this.decision.getRawValue();
    const remarks = (raw.remarks ?? '').trim();

    if (kind === 'reject' && !raw.rejectionReasonId) {
      this.toast.error('Choose a reason', 'A profile turned down has to say what for.');
      return;
    }

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
        this.submission.set(updated);
        this.toast.success(
          kind === 'approve' ? 'Profile accepted' : 'Profile turned down',
          record.applicantCode ?? '',
        );
        void this.router.navigate(['/admin/profile-scrutiny']);
      },
      error: () => this.saving.set(false),
    });
  }
}
