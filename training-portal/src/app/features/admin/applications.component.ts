import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  Application,
  LookupItem,
} from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ApplicationService } from '../../core/services/workflow.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { InrPipe } from '../../shared/pipes/format.pipes';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'applicationNo', header: 'Application no.', sortable: true, width: '160px' },
  { key: 'applicant', header: 'Applicant', variant: 'primary' },
  { key: 'programTypeName', header: 'Program type', width: '210px' },
  { key: 'location', header: 'Location', width: '160px' },
  { key: 'submittedOn', header: 'Submitted', sortable: true, width: '130px' },
  { key: 'assignedToName', header: 'Assigned to', width: '160px', variant: 'muted' },
  { key: 'payment', header: 'Fee', width: '150px' },
  { key: 'status', header: 'Status', width: '150px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-applications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    IconComponent,
    InrPipe,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.applications.title')"
      [subtitle]="copy.text('page.applications.subtitle')"
      icon="inbox"
      [breadcrumbs]="[{ label: 'Administration' }, { label: copy.text('page.applications.title') }]"
    />

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
        <div class="filter-bar filter-bar--two-rows">
          <div class="field">
            <label class="field-label" for="apqSearch">Search</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input id="apqSearch" class="input" placeholder="Application no., applicant or PAN" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="apqCategory">Category</label>
            <select id="apqCategory" class="select" (change)="list.setFilter('categoryId', value($event))">
              <option value="">All categories</option>
              @for (category of categories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="apqProgramType">Program type</label>
            <select id="apqProgramType" class="select" (change)="list.setFilter('programTypeId', value($event))">
              <option value="">All program types</option>
              @for (programType of programTypes(); track programType.id) {
                <option [value]="programType.id">{{ programType.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="apqState">State</label>
            <select id="apqState" class="select" (change)="list.setFilter('state', value($event))">
              <option value="">All states</option>
              @for (state of states(); track state.id) {
                <option [value]="state.name">{{ state.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="apqStatus">Status</label>
            <select id="apqStatus" class="select" [value]="activeStatus() ?? ''" (change)="list.setFilter('status', value($event))">
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
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="Queue is clear"
        emptyMessage="No applications match these filters."
        emptyIcon="check"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="applicationNo" let-row>
          <a class="cell-primary" [routerLink]="['/admin/applications', $any(row).id]">
            {{ $any(row).applicationNo }}
          </a>
        </ng-template>
        <ng-template appCell="applicant" let-row>
          <div class="stack stack-xs">
            <strong>{{ $any(row).applicantName }}</strong>
            <span class="cell-muted">{{ $any(row).applicantEmail }} · {{ $any(row).pan }}</span>
          </div>
        </ng-template>
        <ng-template appCell="location" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).city }}</span>
            <span class="cell-muted">{{ $any(row).state }}</span>
          </div>
        </ng-template>
        <ng-template appCell="submittedOn" let-row>
          {{ $any(row).submittedOn | date: 'dd MMM yyyy' }}
        </ng-template>
        <ng-template appCell="payment" let-row>
          <div class="stack stack-xs">
            <app-status-badge [value]="$any(row).paymentStatus" />
            @if ($any(row).feeAmount) {
              <span class="cell-muted tabular">{{ $any(row).feeAmount | inr }}</span>
            }
          </div>
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <a class="btn btn--sm btn--secondary" [routerLink]="['/admin/applications', $any(row).id]">
            Scrutinise
          </a>
        </ng-template>
      </app-data-table>
    </section>
  `,
  styles: [
    `
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
    `,
  ],
})
export class ApplicationsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ApplicationService);
  private readonly lookups = inject(LookupService);

  protected readonly columns = COLUMNS;
  protected readonly statuses = APPLICATION_STATUSES;
  protected readonly statusLabels = APPLICATION_STATUS_LABELS;

  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] as LookupItem[] });
  protected readonly programTypes = toSignal(this.lookups.programTypes(null), { initialValue: [] as LookupItem[] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });

  /** Full set, used for the counters above the table. */
  private readonly all = toSignal(this.service.all(), { initialValue: [] as Application[] });

  protected readonly list = new ListState<Application>((request) => this.service.list(request), {
    sortBy: 'submittedOn',
    pageSize: 25,
  });

  protected readonly activeStatus = computed(
    () => (this.list.filters()['status'] as string | undefined) ?? null,
  );

  protected readonly queueTiles = computed(() =>
    (['Submitted', 'UnderScrutiny', 'Clarification', 'Approved', 'Enrolled', 'Rejected'] as const).map(
      (status) => ({
        status,
        label: APPLICATION_STATUS_LABELS[status],
        count: this.all().filter((a) => a.status === status).length,
      }),
    ),
  );

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  constructor() {
    this.list.sortDir.set('desc');
  }

  protected filterByStatus(status: string): void {
    this.list.setFilter('status', this.activeStatus() === status ? null : status);
  }
}
