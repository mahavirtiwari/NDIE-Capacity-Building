import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  LookupItem,
  PROFILE_STATUSES,
  PROFILE_STATUS_LABELS,
  ProfileForm,
  ProfileScrutinyCounts,
  ProfileSubmission,
  RejectionReason,
} from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { ProfileFormService } from '../../core/services/academics.service';
import { AuthService } from '../../core/services/auth.service';
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

/*
 * The Reason column is gone from here and folded into Status.
 *
 * It held a value on rejected rows and an em dash on every other one,
 * which on a healthy queue is almost all of them — two hundred pixels
 * of nothing, in the middle of the table, to carry the occasional line.
 * A rejection now says why underneath its badge, where the two belong
 * together anyway.
 */
const COLUMNS: ColumnDef[] = [
  { key: 'applicant', header: 'Applicant', variant: 'primary', width: '170px' },
  /* The code, not the name, is the identity — and so the thing that
     opens the profile. */
  { key: 'applicantCode', header: 'Applicant ID', width: '130px' },
  { key: 'categoryName', header: 'Category', width: '140px' },
  { key: 'subCategoryName', header: 'Sub-category', width: '150px' },
  { key: 'attemptNo', header: 'Attempt', width: '90px', align: 'center' },
  { key: 'submittedOn', header: 'Submission date', sortable: true, width: '130px' },
  { key: 'assignedToName', header: 'Assigned to', width: '140px' },
  { key: 'status', header: 'Status', width: '150px' },
  /* Last, and the only column without a width: a reason is a sentence
     and should take whatever room is left rather than wrap in a box. */
  { key: 'reason', header: 'Reason' },
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
    RouterLink,
  ],
  template: `
    <app-page-header
      title="Profile scrutiny"
      subtitle="Applicants waiting to be let into their sub-category."
      icon="inbox"
      [breadcrumbs]="[{ label: 'Administration' }, { label: 'Profile scrutiny' }]"
    />

    <!-- The headline figures, and a way into each. Counted under the same
         filters as the list but without its status, so the three always add
         up to what was received. -->
    <div class="queue-strip mb-md">
      @for (tile of queueTiles(); track tile.status) {
        <button
          type="button"
          class="queue-tile"
          [class.is-active]="activeStatus() === tile.status"
          (click)="filterByStatus(tile.status)"
        >
          <span class="queue-tile__label">{{ tile.label }}</span>
          <strong class="queue-tile__value tabular">{{ tile.count }}</strong>
        </button>
      }
    </div>

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
                placeholder="Applicant name, ID or PAN"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="psCat">Category</label>
            <select id="psCat" class="select"
              [value]="list.stagedValue('categoryId')"
              (change)="list.stageFilter('categoryId', value($event))"
            >
              <option value="">All categories</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="psSub">Sub-category</label>
            <select
              id="psSub"
              class="select"
              [value]="list.stagedValue('subCategoryId')"
              (change)="list.stageFilter('subCategoryId', value($event))"
              >
              <option value="">All sub-categories</option>
              @for (sub of subCategories(); track sub.id) {
                <option [value]="sub.id">{{ sub.name }}</option>
              }
            </select>
          </div>
          <!-- A profile belongs to a discipline rather than a course, so
               this asks for the profiles that qualify somebody for the
               chosen type. -->
          <div class="field">
            <label class="field-label" for="psType">Program type</label>
            <select id="psType" class="select"
              [value]="list.stagedValue('programTypeId')"
              (change)="list.stageFilter('programTypeId', value($event))"
            >
              <option value="">All program types</option>
              @for (type of programTypes(); track type.id) {
                <option [value]="type.id">{{ type.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="psState">State/UT</label>
            <select id="psState" class="select"
              [value]="list.stagedValue('state')"
              (change)="list.stageFilter('state', value($event))"
            >
              <option value="">All states/UTs</option>
              @for (st of states(); track st.id) {
                <option [value]="st.name">{{ st.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="psFrom">Submitted between</label>
            <div class="date-range">
              <input id="psFrom" type="date" class="input"
                [value]="list.stagedValue('from')"
                (change)="list.stageFilter('from', value($event))" />
              <span class="text-muted">&ndash;</span>
              <input type="date" class="input" aria-label="Submitted up to"
                [value]="list.stagedValue('to')"
                (change)="list.stageFilter('to', value($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="psStatus">Status</label>
            <select id="psStatus" class="select"
              [value]="list.stagedValue('status')"
              (change)="list.stageFilter('status', value($event))"
            >
              <option value="">All statuses</option>
              @for (status of statuses; track status) {
                <option [value]="status">{{ statusLabels[status] }}</option>
              }
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
        exportName="Profile submissions"
        minWidth="1060px"
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
<!-- The name opens the profile. It was plain bold text beside a
             filled button at the far right of the row, so the one thing a
             reader looks at was not the thing they could click, and the
             button repeated down the page in the brand colour pulled the
             eye away from the names. -->
        <ng-template appCell="applicant" let-row>
          {{ $any(row).applicantName }}
        </ng-template>

        <!-- The code opens the profile, not the name. An applicant is
             identified by the code the system issued them — a name is
             shared by three people in any register this size, and is
             theirs to change. -->
        <ng-template appCell="applicantCode" let-row>
          <a class="cell-link tabular" [routerLink]="['/admin/profile-scrutiny', $any(row).id]">
            {{ $any(row).applicantCode }}
          </a>
        </ng-template>
<!-- A first attempt is the ordinary case and reads as a plain
             number. A second or third is somebody who was turned down and
             has come back, which is worth seeing from the register. -->
        <ng-template appCell="attemptNo" let-row>
          @if ($any(row).attemptNo > 1) {
            <span class="chip chip--warn">{{ $any(row).attemptNo }}</span>
          } @else {
            <span class="cell-muted">1</span>
          }
        </ng-template>
        <ng-template appCell="submittedOn" let-row>
          {{ $any(row).submittedOn | date: 'dd MMM yyyy' }}
        </ng-template>
<!-- Unassigned is not a quiet absence: it means nobody's program
             types and states cover this profile, so it is sitting in the
             register waiting for a manager to be appointed. Said plainly
             rather than greyed out. -->
        <ng-template appCell="assignedToName" let-row>
          @if ($any(row).assignedToName) {
            <span>{{ $any(row).assignedToName }}</span>
          } @else {
            <span class="chip chip--warn">Unassigned</span>
          }
        </ng-template>
<!-- The badge, and under it who decided and when. The reason has
             a column of its own. -->
        <ng-template appCell="status" let-row>
          <div class="stack stack-xs">
            <app-status-badge [value]="$any(row).status" />
            @if ($any(row).decidedOn) {
              <span class="text-xs cell-muted">
                {{ $any(row).decidedOn | date: 'dd MMM yyyy' }}
                @if ($any(row).decidedByUserName) { · {{ $any(row).decidedByUserName }} }
              </span>
            }
          </div>
        </ng-template>

        <!-- A rejection that does not say why makes the officer open the
             profile to find out, which is the one thing the register
             exists to save them. Nothing for the states that have no
             reason to give: an empty cell is quieter than a dash. -->
        <ng-template appCell="reason" let-row>
          @if ($any(row).rejectionReasonLabel) {
            <span class="text-sm text-danger wrap-text">
              {{ $any(row).rejectionReasonLabel }}
            </span>
          }
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
          row.categoryName + ' · ' + row.subCategoryName + ' · attempt ' + row.attemptNo
            + ' · ' + row.applicantCode
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
            @if (sections(row); as groups) {
              @if (groups.length === 0) {
                <p class="text-muted text-sm">
                  Nothing was recorded against this submission.
                </p>
              } @else {
                @for (group of groups; track group.title) {
                  <div class="scrutiny-section">
                    <h4 class="section-title">{{ group.title }}</h4>
                    <div class="dl">
                      @for (entry of group.entries; track entry.label) {
                        <div>
                          <dt>{{ entry.label }}</dt>
                          <dd>{{ entry.value }}</dd>
                        </div>
                      }
                    </div>
                  </div>
                }
              }
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

<!-- The decision is the Operation Manager's. Everyone else reads the
               sheet: the answers, what has happened, and the outcome once
               there is one. -->
          @if (canDecide(row)) {
            <form [formGroup]="decision" class="stack stack-sm">
              <div class="field">
                <label class="field-label" for="psReason">Reason, if rejecting</label>
                <select id="psReason" class="select" formControlName="rejectionReasonId">
                  <option [ngValue]="null">Select a reason</option>
                  @for (reason of reasons(); track reason.id) {
                    <option [ngValue]="reason.id">{{ reason.label }}</option>
                  }
                </select>
                <span class="field-hint">
                  Required to reject a profile, so the applicant is told why and can put it
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
          @if (canDecide(row)) {
            <button
              type="button"
              class="btn btn--subtle-danger"
              [disabled]="deciding()"
              (click)="reject(row)"
            >
              Reject
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
      .scrutiny-section + .scrutiny-section { margin-top: 0.9rem; }
      .scrutiny-section .section-title {
        margin: 0 0 0.25rem;
        font-size: var(--fs-sm);
        color: var(--ink-700);
      }
      .text-danger { color: var(--danger-700); }

      /* The headline figures, as the applications register showed them.
         These styles came with that component and were lost when it went. */
      .queue-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.6rem;
      }
      .queue-tile {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        align-items: flex-start;
        padding: 0.65rem 0.8rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        cursor: pointer;
        font: inherit;
        transition: border-color var(--transition), background var(--transition);
      }
      .queue-tile:hover { border-color: var(--brand-300); background: var(--brand-50); }
      .queue-tile.is-active {
        border-color: var(--brand-600);
        background: var(--brand-50);
        box-shadow: inset 0 -2px 0 var(--brand-600);
      }
      .queue-tile__label {
        font-size: var(--fs-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-500);
        font-weight: 600;
      }
      .queue-tile__value { font-size: var(--fs-xl); color: var(--ink-900); }

      /* The two date inputs are one control. Without a width they each take
         a grid track's worth and push Status out of its own field. */
      .date-range { display: flex; align-items: center; gap: 0.4rem; }
      .date-range .input { min-width: 0; flex: 1 1 0; }
    `,
  ],
})
export class ProfileScrutinyComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ProfileSubmissionService);
  private readonly reasonService = inject(RejectionReasonService);
  private readonly lookups = inject(LookupService);
  private readonly forms = inject(ProfileFormService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  /**
   * Whether this account may decide the profile in front of it.
   *
   * Open, and the Operation Manager's. The queue already shows a manager
   * only their own desk, so for them this is the status check; for the
   * tiers above, who see every profile in the scheme, it is what keeps the
   * sheet to reading.
   */
  protected canDecide(row: ProfileSubmission): boolean {
    return (row.status === 'Submitted' || row.status === 'UnderScrutiny')
      && this.auth.hasRole('OperationManager');
  }

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

  protected readonly categories = toSignal(this.lookups.categories(), {
    initialValue: [] as LookupItem[],
  });

  protected readonly programTypes = toSignal(this.lookups.programTypes(null, null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly states = toSignal(this.lookups.states(), {
    initialValue: [] as LookupItem[],
  });

  /* The counters, counted in the database against the same filters as the
     list rather than by pulling every submission here. */
  private readonly counts = signal<ProfileScrutinyCounts | null>(null);

  /**
   * Received, approved, rejected — and a way into each.
   *
   * Pending is not a tile of its own: Submitted and Under scrutiny are two
   * points in the same queue rather than two places a profile rests.
   */
  protected readonly queueTiles = computed(() => {
    const counts = this.counts();
    return [
      { status: '', label: 'Profiles received', count: counts?.received ?? 0 },
      { status: 'Approved', label: 'Approved', count: counts?.approved ?? 0 },
      { status: 'Rejected', label: 'Rejected', count: counts?.rejected ?? 0 },
    ];
  });

  protected readonly activeStatus = computed(
    () => (this.list.filters()['status'] as string | undefined) ?? '');

  protected filterByStatus(status: string): void {
    this.list.stageFilter('status', this.activeStatus() === status ? '' : status);
    this.list.applyFilters();
  }

  constructor() {
    /* Reading list.rows() ties this to every reload the list does — a
       filter, a search, a page, or coming back from a decision — so the
       tiles and the table can never disagree about what is being looked
       at. */
    effect(() => {
      this.list.rows();
      const filters = this.list.filters();
      this.service
        .counts({
          status: filters['status'] ?? null,
          categoryId: filters['categoryId'] ?? null,
          subCategoryId: filters['subCategoryId'] ?? null,
          programTypeId: filters['programTypeId'] ?? null,
          state: filters['state'] ?? null,
          from: filters['from'] ?? null,
          to: filters['to'] ?? null,
          search: this.list.search(),
        })
        .subscribe((counts) => this.counts.set(counts));
    });
  }

  protected readonly reasons = toSignal(this.reasonService.list(true), {
    initialValue: [] as RejectionReason[],
  });

  protected readonly reading = signal<ProfileSubmission | null>(null);

  /** The form the submission was filled against, so answers read in sections. */
  protected readonly formDefinition = signal<ProfileForm | null>(null);
  protected readonly deciding = signal(false);

  protected readonly decision = this.fb.nonNullable.group({
    rejectionReasonId: [null as number | null],
    remarks: [''],
  });

  protected open(row: ProfileSubmission): void {
    this.decision.reset({ rejectionReasonId: null, remarks: '' });
    this.formDefinition.set(null);

    /* Fetched rather than reused from the row: the list carries enough to
       scan, and the sheet needs the answers and the whole history. */
    this.service.getById(row.id).subscribe((full) => this.reading.set(full));

    /* And the form it was filled against, so the answers can be read in the
       sections and under the labels the applicant saw. A bare list of
       storage keys is not something anybody can scrutinise. */
    this.forms.bySubCategory(row.subCategoryId).subscribe({
      next: (form) => this.formDefinition.set(form),
      error: () => this.formDefinition.set(null),
    });
  }

  /**
   * The answers laid out the way the applicant filled them: section by
   * section, each field under its own label, in the form's own order.
   *
   * Anything the form no longer asks about is gathered at the end rather
   * than dropped — a question that was removed after somebody answered it
   * still has their answer, and hiding it would quietly change what is
   * being scrutinised.
   */
  protected sections(row: ProfileSubmission): {
    title: string;
    entries: { label: string; value: string }[];
  }[] {
    const responses: Record<string, unknown> = row.responses ?? {};
    const form = this.formDefinition();
    if (!form) return [];

    const seen = new Set<string>();
    const out = form.sections
      .filter((section) => section.isEnabled)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((section) => ({
        title: section.title,
        entries: [...section.fields]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((field) => {
            seen.add(field.key);
            return { label: field.label, value: this.describe(responses[field.key]) };
          }),
      }))
      .filter((section) => section.entries.length > 0);

    const orphans = Object.entries(responses)
      .filter(([key]) => !seen.has(key))
      .map(([key, value]) => ({ label: key, value: this.describe(value) }));

    return orphans.length > 0
      ? [...out, { title: 'No longer asked', entries: orphans }]
      : out;
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
      this.toast.error('Choose a reason', 'A profile cannot be rejected without one.');
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
            'Profile rejected',
            'The applicant can correct it and send it again.',
          );
          this.list.reload();
        },
        error: () => this.deciding.set(false),
      });
  }
}
