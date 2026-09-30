import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  LookupItem,
  PROFILE_STATUSES,
  PROFILE_STATUS_LABELS,
  ProfileSubmission,
  RejectionReason,
} from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import {
  ProfileSubmissionService,
  RejectionReasonService,
} from '../../core/services/workflow.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'applicant', header: 'Applicant', variant: 'primary' },
  { key: 'subCategoryName', header: 'Sub-category', width: '180px' },
  { key: 'attemptNo', header: 'Attempt', width: '90px', align: 'center' },
  { key: 'submittedOn', header: 'Sent', sortable: true, width: '130px' },
  { key: 'status', header: 'Status', width: '140px' },
  { key: 'rejectionReasonLabel', header: 'Reason', width: '200px', variant: 'muted' },
  { key: 'actions', header: '', width: '150px', align: 'right' },
];

/**
 * The profile queue.
 *
 * An applicant declares who they are once for their discipline, and this is
 * where that is read. It comes before application scrutiny in every sense —
 * nobody has an application until their profile has been accepted — so it
 * sits above it in the sidebar too.
 */
@Component({
  selector: 'app-profile-scrutiny',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      title="Profile scrutiny"
      subtitle="Applicants waiting to be let into their sub-category."
      icon="inbox"
      [breadcrumbs]="[{ label: 'Administration' }, { label: 'Profile scrutiny' }]"
    />

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field">
            <label class="field-label" for="psSearch">Search</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                id="psSearch"
                class="input"
                placeholder="Applicant name or ID"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="psSub">Sub-category</label>
            <select
              id="psSub"
              class="select"
              (change)="list.setFilter('subCategoryId', value($event))"
            >
              <option value="">All sub-categories</option>
              @for (sub of subCategories(); track sub.id) {
                <option [value]="sub.id">{{ sub.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="psStatus">Status</label>
            <select id="psStatus" class="select" (change)="list.setFilter('status', value($event))">
              <option value="">All statuses</option>
              @for (status of statuses; track status) {
                <option [value]="status">{{ statusLabels[status] }}</option>
              }
            </select>
          </div>
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Profile submissions"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="Queue is clear"
        emptyMessage="No profiles match these filters."
        emptyIcon="check"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="applicant" let-row>
          <div class="stack stack-xs">
            <strong>{{ $any(row).applicantName }}</strong>
            <span class="cell-muted">{{ $any(row).applicantCode }}</span>
          </div>
        </ng-template>
        <ng-template appCell="submittedOn" let-row>
          {{ $any(row).submittedOn | date: 'dd MMM yyyy' }}
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="rejectionReasonLabel" let-row>
          @if ($any(row).rejectionReasonLabel) {
            <span class="wrap-text">{{ $any(row).rejectionReasonLabel }}</span>
          } @else {
            <span class="cell-muted">&mdash;</span>
          }
        </ng-template>
        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn--sm btn--secondary" (click)="open($any(row))">
            Read it
          </button>
        </ng-template>
      </app-data-table>
    </section>

    <!-- ------------------------------------------------ reading one ----
         Everything the officer needs to decide, on one sheet: what was
         declared, what they were told last time, and the two buttons. -->
    @if (reading(); as row) {
      <app-modal
        [title]="row.applicantName ?? 'Profile'"
        [subtitle]="
          row.subCategoryName + ' · attempt ' + row.attemptNo + ' · ' + row.applicantCode
        "
        size="lg"
        (closed)="reading.set(null)"
      >
        <div class="stack stack-md">
          @if (row.status === 'Rejected' || row.status === 'Approved') {
            <div class="banner banner--info">
              Already decided by {{ row.decidedByUserName }} on
              {{ row.decidedOn | date: 'dd MMM yyyy' }}.
            </div>
          }

          <div class="stack stack-sm">
            <span class="field-label">What they declared</span>
            @if (answers(row).length === 0) {
              <p class="text-muted text-sm">Nothing was recorded against this submission.</p>
            } @else {
              <div class="dl">
                @for (entry of answers(row); track entry.key) {
                  <div>
                    <dt>{{ entry.key }}</dt>
                    <dd>{{ entry.value }}</dd>
                  </div>
                }
              </div>
            }
          </div>

          @if (row.history.length > 0) {
            <div class="stack stack-sm">
              <span class="field-label">What has happened</span>
              @for (event of row.history; track event.id) {
                <div class="text-sm">
                  <strong>{{ event.action }}</strong>
                  <span class="text-muted">
                    &middot; {{ event.byUserName }} &middot;
                    {{ event.on | date: 'dd MMM yyyy' }}
                  </span>
                  @if (event.rejectionReasonLabel) {
                    <div class="text-danger">{{ event.rejectionReasonLabel }}</div>
                  }
                  @if (event.remarks) {
                    <div class="text-muted">{{ event.remarks }}</div>
                  }
                </div>
              }
            </div>
          }

          @if (row.status === 'Submitted' || row.status === 'UnderScrutiny') {
            <form [formGroup]="decision" class="stack stack-sm">
              <div class="field">
                <label class="field-label" for="psReason">Reason, if turning it down</label>
                <select id="psReason" class="select" formControlName="rejectionReasonId">
                  <option [ngValue]="null">Select a reason</option>
                  @for (reason of reasons(); track reason.id) {
                    <option [ngValue]="reason.id">{{ reason.label }}</option>
                  }
                </select>
                <span class="field-hint">
                  Required to turn a profile down, so the applicant is told why and can put it
                  right. Ignored when accepting.
                </span>
              </div>
              <div class="field">
                <label class="field-label" for="psRemarks">Remarks</label>
                <textarea
                  id="psRemarks"
                  class="textarea"
                  formControlName="remarks"
                  placeholder="Anything the applicant should know"
                ></textarea>
              </div>
            </form>
          }
        </div>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="reading.set(null)">
            Close
          </button>
          @if (row.status === 'Submitted' || row.status === 'UnderScrutiny') {
            <button
              type="button"
              class="btn btn--subtle-danger"
              [disabled]="deciding()"
              (click)="reject(row)"
            >
              Turn down
            </button>
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="deciding()"
              (click)="approve(row)"
            >
              @if (deciding()) { <span class="spinner"></span> }
              Accept
            </button>
          }
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .dl > div {
        display: grid;
        grid-template-columns: minmax(140px, 240px) 1fr;
        gap: 0.75rem;
        padding: 0.45rem 0;
        border-top: 1px solid var(--border);
      }
      .dl dt {
        color: var(--ink-500);
        font-size: var(--fs-sm);
        word-break: break-word;
      }
      .dl dd {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--ink-900);
        word-break: break-word;
      }
      .text-danger { color: var(--danger-700); }
    `,
  ],
})
export class ProfileScrutinyComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ProfileSubmissionService);
  private readonly reasonService = inject(RejectionReasonService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;
  protected readonly statuses = PROFILE_STATUSES;
  protected readonly statusLabels = PROFILE_STATUS_LABELS;
  protected readonly term = searchTerm;
  protected readonly value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected readonly list = new ListState<ProfileSubmission>(
    (request) => this.service.list(request),
    { sortBy: 'submittedOn', sortDir: 'desc' },
  );

  protected readonly subCategories = toSignal(this.lookups.subCategories(null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly reasons = toSignal(this.reasonService.list(true), {
    initialValue: [] as RejectionReason[],
  });

  protected readonly reading = signal<ProfileSubmission | null>(null);
  protected readonly deciding = signal(false);

  protected readonly decision = this.fb.nonNullable.group({
    rejectionReasonId: [null as number | null],
    remarks: [''],
  });

  protected open(row: ProfileSubmission): void {
    this.decision.reset({ rejectionReasonId: null, remarks: '' });
    /* Fetched rather than reused from the row: the list carries enough to
       scan, and the sheet needs the answers and the whole history. */
    this.service.getById(row.id).subscribe((full) => this.reading.set(full));
  }

  /** The answers as a list the template can walk, newest form first. */
  protected answers(row: ProfileSubmission): { key: string; value: string }[] {
    return Object.entries(row.responses ?? {}).map(([key, value]) => ({
      key,
      value: this.describe(value),
    }));
  }

  private describe(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    /* A repeating section arrives as a list of objects; showing the JSON is
       honest and readable enough until somebody asks for more. */
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  protected approve(row: ProfileSubmission): void {
    this.deciding.set(true);
    this.service
      .approve(row.id, { remarks: this.decision.value.remarks || null })
      .subscribe({
        next: () => {
          this.deciding.set(false);
          this.reading.set(null);
          this.toast.success(
            'Profile accepted',
            'The programs under this sub-category are now open to them.',
          );
          this.list.reload();
        },
        error: () => this.deciding.set(false),
      });
  }

  protected reject(row: ProfileSubmission): void {
    const reasonId = this.decision.value.rejectionReasonId;
    if (!reasonId) {
      this.toast.error('Choose a reason', 'A profile cannot be turned down without one.');
      return;
    }

    this.deciding.set(true);
    this.service
      .reject(row.id, { rejectionReasonId: reasonId, remarks: this.decision.value.remarks || null })
      .subscribe({
        next: () => {
          this.deciding.set(false);
          this.reading.set(null);
          this.toast.success(
            'Profile turned down',
            'The applicant can correct it and send it again.',
          );
          this.list.reload();
        },
        error: () => this.deciding.set(false),
      });
  }
}
