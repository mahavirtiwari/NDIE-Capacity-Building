import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Application, LookupItem, RegistrationForm, RejectionReason } from '../../core/models';
import { RegistrationFormService } from '../../core/services/academics.service';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/masters.service';
import { ToastService } from '../../core/services/toast.service';
import { ApplicationService, RejectionReasonService } from '../../core/services/workflow.service';
import { DynamicFormComponent } from '../../shared/components/dynamic-form.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { FileSizePipe, InrPipe } from '../../shared/pipes/format.pipes';

type Decision = 'Approve' | 'Reject' | 'Clarification';
type Tab = 'responses' | 'documents' | 'history';

@Component({
  selector: 'app-application-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    PageHeaderComponent,
    StatusBadgeComponent,
    DynamicFormComponent,
    ModalComponent,
    IconComponent,
    InrPipe,
    FileSizePipe,
  ],
  template: `
    @if (application(); as record) {
      <app-page-header
        [title]="record.applicantName"
        [subtitle]="record.applicationNo + ' · ' + record.programTypeName"
        icon="inbox"
        [breadcrumbs]="[
          { label: 'Administration' },
          { label: 'Application scrutiny', link: '/admin/applications' },
          { label: record.applicationNo }
        ]"
      >
        <a class="btn btn--secondary" routerLink="/admin/applications">
          <app-icon name="chevron-left" [size]="15" /> Back to queue
        </a>
        @if (canScrutinise() && isOpen(record)) {
          <button type="button" class="btn btn--secondary" (click)="openDecision('Clarification')">
            <app-icon name="help" [size]="15" /> Seek clarification
          </button>
          <button type="button" class="btn btn--danger" (click)="openDecision('Reject')">
            <app-icon name="x" [size]="15" /> Reject
          </button>
          <button type="button" class="btn btn--success" (click)="openDecision('Approve')">
            <app-icon name="check" [size]="15" /> Approve
          </button>
        }
      </app-page-header>

      <div class="detail-grid">
        <div class="stack stack-md">
          <section class="card">
            <div class="tabs" style="padding: 0 1rem">
              <button type="button" class="tab" [class.is-active]="tab() === 'responses'" (click)="tab.set('responses')">
                Application form
              </button>
              <button type="button" class="tab" [class.is-active]="tab() === 'documents'" (click)="tab.set('documents')">
                Documents ({{ record.documents.length }})
              </button>
              <button type="button" class="tab" [class.is-active]="tab() === 'history'" (click)="tab.set('history')">
                History ({{ record.history.length }})
              </button>
            </div>

            <div class="card__body">
              @switch (tab()) {
                @case ('responses') {
                  @if (formDefinition(); as definition) {
                    <app-dynamic-form
                      [definition]="definition"
                      [values]="$any(record.responses)"
                      [readonly]="true"
                    />
                  } @else {
                    <p class="text-sm text-muted">Loading the registration form for this program type…</p>
                  }
                }
                @case ('documents') {
                  <div class="stack stack-sm">
                    @for (document of record.documents; track document.id) {
                      <div class="doc">
                        <span class="doc__icon"><app-icon name="file" [size]="16" /></span>
                        <div class="stack stack-xs flex-1">
                          <strong class="text-sm">{{ document.label }}</strong>
                          <span class="text-xs text-muted">
                            {{ document.fileName }} · {{ document.fileSizeKb | fileSize }} ·
                            uploaded {{ document.uploadedOn | date: 'dd MMM yyyy' }}
                          </span>
                          @if (document.remarks) {
                            <span class="text-xs text-danger">{{ document.remarks }}</span>
                          }
                        </div>
                        @if (document.verified) {
                          <span class="badge badge--success"><span class="badge-dot"></span>Verified</span>
                        } @else if (canScrutinise() && isOpen(record)) {
                          <button type="button" class="btn btn--sm btn--secondary" (click)="verify(record, document.id)">
                            Mark verified
                          </button>
                        } @else {
                          <span class="badge badge--neutral"><span class="badge-dot"></span>Pending</span>
                        }
                      </div>
                    }
                  </div>
                }
                @default {
                  <div class="timeline">
                    @for (event of record.history; track event.id) {
                      <div class="timeline__item">
                        <span class="timeline__dot"><app-icon name="check" [size]="12" /></span>
                        <div class="stack stack-xs">
                          <strong class="text-sm">{{ event.action }}</strong>
                          <span class="text-xs text-muted">
                            {{ event.byUserName }} ({{ event.byRole }}) · {{ event.on | date: 'dd MMM yyyy, HH:mm' }}
                          </span>
                          @if (event.remarks) {
                            <span class="text-sm">{{ event.remarks }}</span>
                          }
                        </div>
                      </div>
                    } @empty {
                      <span class="text-sm text-muted">No activity recorded yet.</span>
                    }
                  </div>
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
            <div class="card__body stack stack-sm">
              <div class="dl">
                <div>
                  <div class="dl__term">Submitted on</div>
                  <div class="dl__value">{{ record.submittedOn | date: 'dd MMM yyyy' }}</div>
                </div>
                <div>
                  <div class="dl__term">Assigned to</div>
                  <div class="dl__value">{{ record.assignedToName || 'Unassigned' }}</div>
                </div>
              </div>
              @if (canScrutinise()) {
                <div class="field">
                  <label class="field-label" for="assignTo">Reassign</label>
                  <select id="assignTo" class="select" (change)="assign(record, $event)">
                    <option value="">Select officer</option>
                    @for (officer of officers(); track officer.id) {
                      <option [value]="officer.id">{{ officer.name }}</option>
                    }
                  </select>
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
                  <div class="dl__value"><code>{{ applicantCode() }}</code></div>
                </div>
                <div>
                  <div class="dl__term">Email</div>
                  <div class="dl__value">{{ record.applicantEmail }}</div>
                </div>
                <div>
                  <div class="dl__term">Mobile</div>
                  <div class="dl__value">{{ record.applicantMobile }}</div>
                </div>
                <div>
                  <div class="dl__term">PAN</div>
                  <div class="dl__value">{{ record.pan }}</div>
                </div>
                <div>
                  <div class="dl__term">Location</div>
                  <div class="dl__value">{{ record.city }}, {{ record.state }}</div>
                </div>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card__header"><span class="card__title">Program &amp; fee</span></div>
            <div class="card__body">
              <div class="dl">
                <div>
                  <div class="dl__term">Category</div>
                  <div class="dl__value">{{ record.categoryName }}</div>
                </div>
                <div>
                  <div class="dl__term">Sub-category</div>
                  <div class="dl__value">{{ record.subCategoryName }}</div>
                </div>
                <div>
                  <div class="dl__term">Program type</div>
                  <div class="dl__value">{{ record.programTypeName }}</div>
                </div>
                <div>
                  <div class="dl__term">Fee</div>
                  <div class="dl__value tabular">{{ record.feeAmount | inr }}</div>
                </div>
                <div>
                  <div class="dl__term">Payment</div>
                  <div class="dl__value"><app-status-badge [value]="record.paymentStatus" /></div>
                </div>
              </div>

              <!-- The one-word status above says where it got to; this says how,
                   and carries the reference a bank or the payer will quote. -->
              @if (record.payments?.length) {
                <div class="stack stack-sm" style="margin-top: 1rem">
                  <h4 class="section-title">Payment attempts</h4>
                  @for (attempt of record.payments; track attempt.orderId) {
                    <div class="attempt">
                      <div class="attempt__head">
                        <app-status-badge [value]="attempt.status" />
                        <span class="tabular">{{ attempt.amount | inr }}</span>
                      </div>
                      <div class="attempt__meta">
                        {{ attempt.completedOn ?? attempt.initiatedOn | date: 'dd MMM yyyy, HH:mm' }}
                        · {{ attempt.gateway }}@if (attempt.testMode) { <span> (test)</span> }
                        @if (attempt.method) { <span> · {{ attempt.method }}</span> }
                      </div>
                      <div class="attempt__meta">
                        Ref <code>{{ attempt.trackingId ?? attempt.orderId }}</code>
                        @if (attempt.bankReference) { <span> · Bank {{ attempt.bankReference }}</span> }
                      </div>
                      @if (attempt.failureReason) {
                        <div class="attempt__why">{{ attempt.failureReason }}</div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </section>
        </aside>
      </div>
    } @else {
      <div class="card" style="height: 300px"></div>
    }

    @if (decision(); as pending) {
      <app-modal
        [title]="
          pending === 'Approve'
            ? 'Approve application'
            : pending === 'Reject'
              ? 'Reject application'
              : 'Seek clarification'
        "
        size="sm"
        (closed)="decision.set(null)"
      >
        <form [formGroup]="decisionForm" id="decision-form" (ngSubmit)="submitDecision()">
          @if (pending === 'Reject') {
            <!-- Chosen, not typed. A rejection is something the scheme counts
                 and reports on, and forty spellings of one reason cannot be.
                 The list is configured in System Settings. -->
            <div class="field">
              <label class="field-label" for="rejectionReason">
                Reason <span class="req">*</span>
              </label>
              <select id="rejectionReason" class="select" formControlName="rejectionReasonId">
                <option [ngValue]="null">Choose a reason</option>
                @for (reason of reasons(); track reason.id) {
                  <option [ngValue]="reason.id">{{ reason.label }}</option>
                }
              </select>
              @if (reasons().length === 0) {
                <span class="field-hint">
                  No reasons have been set up yet. A Super Admin adds them under
                  System Settings.
                </span>
              } @else if (chosenReason()?.requiresNote) {
                <span class="field-hint">
                  This reason needs a note below saying what exactly was wrong.
                </span>
              }
            </div>
          }

          <div class="field">
            <label class="field-label" for="remarks">
              Remarks
              @if (pending !== 'Reject' || chosenReason()?.requiresNote) {
                <span class="req">*</span>
              }
            </label>
            <textarea
              id="remarks"
              class="textarea"
              formControlName="remarks"
              [placeholder]="
                pending === 'Approve'
                  ? 'Documents verified, eligibility criteria met.'
                  : pending === 'Reject'
                    ? 'State the ground for rejection.'
                    : 'Tell the applicant exactly what to correct or re-upload.'
              "
            ></textarea>
            <span class="field-hint">Recorded on the application history and sent to the applicant.</span>
          </div>
          @if (pending === 'Approve') {
            <label class="check mt-sm">
              <input type="checkbox" formControlName="verifyAll" />
              <span class="text-sm">Mark all documents as verified</span>
            </label>
          }
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="decision.set(null)">Cancel</button>
          <button
            type="submit"
            form="decision-form"
            class="btn"
            [class.btn--success]="pending === 'Approve'"
            [class.btn--danger]="pending === 'Reject'"
            [class.btn--primary]="pending === 'Clarification'"
            [disabled]="saving()"
          >
            @if (saving()) { <span class="spinner"></span> }
            Confirm
          </button>
        </div>
      </app-modal>
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
      @media (max-width: 1200px) {
        .detail-grid { grid-template-columns: minmax(0, 1fr); }
      }
      .attempt {
        border: 1px solid var(--border);
        border-radius: var(--radius-md, 8px);
        padding: 0.6rem 0.75rem;
        display: grid;
        gap: 0.2rem;
      }
      .attempt__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        font-weight: 600;
      }
      .attempt__meta { font-size: 0.78rem; color: var(--ink-500); }
      .attempt__why { font-size: 0.78rem; color: var(--danger-700); }
      .doc {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }
      .doc__icon {
        width: 30px;
        height: 30px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: var(--radius-sm);
        background: var(--brand-600);
        color: #fff;
      }
    `,
  ],
})
export class ApplicationDetailComponent {
  private readonly service = inject(ApplicationService);
  private readonly forms = inject(RegistrationFormService);
  private readonly lookups = inject(LookupService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly id = input.required<string>();

  protected readonly application = signal<Application | null>(null);
  protected readonly formDefinition = signal<RegistrationForm | null>(null);
  protected readonly tab = signal<Tab>('responses');
  protected readonly decision = signal<Decision | null>(null);
  protected readonly saving = signal(false);

  protected readonly officers = toSignal(this.lookups.operationManagers(), {
    initialValue: [] as LookupItem[],
  });

  protected readonly canScrutinise = computed(() =>
    this.auth.hasPermission('applications.scrutinise'),
  );

  /** Applicant identity is the generated code, never the email address. */
  protected readonly applicantCode = computed(() => {
    const record = this.application();
    return record ? `APP${String(240000 + record.applicantId)}` : '';
  });

  /* Remarks are not blanket-required any more: a rejection carries a chosen
     reason, and only a reason that says so needs words as well. Which of
     those applies is decided in submitDecision, where the reason is known. */
  protected readonly decisionForm = this.fb.group({
    remarks: [''],
    verifyAll: [true],
    rejectionReasonId: [null as number | null],
  });

  private readonly reasonService = inject(RejectionReasonService);

  /** The form control as a signal, so the hint can follow the choice. */
  protected readonly chosenReasonId = toSignal(
    this.decisionForm.controls.rejectionReasonId.valueChanges,
    { initialValue: null as number | null },
  );

  constructor() {
    effect(() => {
      const id = Number(this.id());
      if (!id) return;
      this.service.getById(id).subscribe((record) => {
        this.application.set(record);
        this.forms.byProgramType(record.programTypeId).subscribe({
          next: (definition) => this.formDefinition.set(definition),
          error: () => this.formDefinition.set(null),
        });
      });
    });
  }

  protected isOpen(record: Application): boolean {
    return (
      record.status === 'Submitted' ||
      record.status === 'UnderScrutiny' ||
      record.status === 'Clarification'
    );
  }

  protected openDecision(kind: Decision): void {
    this.decisionForm.reset({
      remarks: '',
      verifyAll: kind === 'Approve',
      rejectionReasonId: null,
    });
    this.decision.set(kind);
  }

  /* Only the reasons still switched on: a retired one stays on the
     applications that cite it but must not be handed out again. */
  protected readonly reasons = toSignal(this.reasonService.list(true), {
    initialValue: [] as RejectionReason[],
  });

  protected readonly chosenReason = computed(() => {
    const id = this.chosenReasonId();
    return this.reasons().find((r) => r.id === id) ?? null;
  });

  protected submitDecision(): void {
    const record = this.application();
    const kind = this.decision();
    if (!record || !kind || this.decisionForm.invalid) {
      this.decisionForm.markAllAsTouched();
      return;
    }

    /* Enforced here as well as on the server, so the officer is told before
       the round trip rather than after it. */
    if (kind !== 'Reject' && (this.decisionForm.value.remarks ?? '').trim().length < 5) {
      this.toast.error(
        'Remarks are needed',
        kind === 'Approve'
          ? 'Say what was verified.'
          : 'Tell the applicant exactly what to correct.',
      );
      return;
    }

    if (kind === 'Reject') {
      const reason = this.chosenReason();
      if (!reason) {
        this.toast.error('Choose a reason', 'A rejection has to say what it is for.');
        return;
      }
      if (reason.requiresNote && !(this.decisionForm.value.remarks ?? '').trim()) {
        this.toast.error(
          'A note is needed',
          `'${reason.label}' does not say what exactly was wrong.`,
        );
        return;
      }
    }
    this.saving.set(true);
    const raw = this.decisionForm.getRawValue();
    this.service
      .decide({
        applicationId: record.id,
        decision: kind,
        remarks: raw.remarks ?? '',
        documentIdsVerified: raw.verifyAll ? record.documents.map((d) => d.id) : [],
        rejectionReasonId: kind === 'Reject' ? raw.rejectionReasonId : null,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.application.set(updated);
          this.decision.set(null);
          this.toast.success(
            kind === 'Approve'
              ? 'Application approved'
              : kind === 'Reject'
                ? 'Application rejected'
                : 'Clarification sought',
            record.applicationNo,
          );
        },
        error: () => this.saving.set(false),
      });
  }

  protected verify(record: Application, documentId: number): void {
    this.service.verifyDocument(record.id, documentId, true).subscribe((updated) => {
      this.application.set(updated);
      this.toast.success('Document verified');
    });
  }

  protected assign(record: Application, event: Event): void {
    const userId = Number((event.target as HTMLSelectElement).value);
    if (!userId) return;
    this.service.assign(record.id, userId).subscribe((updated) => {
      this.application.set(updated);
      this.toast.success('Application reassigned', updated.assignedToName);
    });
  }
}
