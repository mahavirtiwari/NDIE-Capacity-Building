import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Applicant, LookupItem } from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { ApplicantService } from '../../core/services/people.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'applicantCode', header: 'Applicant ID', sortable: true, width: '140px' },
  { key: 'fullName', header: 'Applicant', sortable: true, variant: 'primary' },
  { key: 'contact', header: 'Contact', width: '250px' },
  { key: 'pan', header: 'PAN', width: '130px' },
  { key: 'categoryName', header: 'Category', variant: 'muted' },
  { key: 'subCategoryName', header: 'Sub-category', variant: 'muted' },
  { key: 'location', header: 'Location', width: '170px' },
  { key: 'verification', header: 'Verification', width: '190px' },
  { key: 'registeredOn', header: 'Registered', width: '130px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-applicants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.applicants.title')"
      [subtitle]="copy.text('page.applicants.subtitle')"
      icon="graduation"
      [breadcrumbs]="[{ label: 'Administration' }, { label: copy.text('page.applicants.title') }]"
    />

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--two-rows">
          <div class="field">
            <label class="field-label" for="apSearch">Search</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input id="apSearch" class="input" placeholder="Name, applicant ID, PAN or email" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="apCategory">Category</label>
            <select id="apCategory" class="select" (change)="list.setFilter('categoryId', value($event))">
              <option value="">All categories</option>
              @for (category of categories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="apState">State</label>
            <select id="apState" class="select" (change)="list.setFilter('state', value($event))">
              <option value="">All states</option>
              @for (state of states(); track state.id) {
                <option [value]="state.name">{{ state.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="apKyc">KYC status</label>
            <select id="apKyc" class="select" (change)="list.setFilter('kycStatus', value($event))">
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="apBlocked">Access</label>
            <select id="apBlocked" class="select" (change)="list.setFilter('isBlocked', value($event))">
              <option value="">All</option>
              <option value="false">Active</option>
              <option value="true">Blocked</option>
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
        emptyTitle="No applicants registered"
        emptyIcon="graduation"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="fullName" let-row>
          <div class="stack stack-xs">
            <strong>{{ $any(row).fullName }}</strong>
            @if ($any(row).isBlocked) {
              <span class="badge badge--danger">Blocked</span>
            }
          </div>
        </ng-template>
        <ng-template appCell="contact" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).email }}</span>
            <span class="cell-muted">{{ $any(row).mobile }}</span>
          </div>
        </ng-template>
        <ng-template appCell="location" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).city }}</span>
            <span class="cell-muted">{{ $any(row).state }}</span>
          </div>
        </ng-template>
        <ng-template appCell="verification" let-row>
          <div class="row row-sm row-wrap">
            <span class="chip" [class.is-off]="!$any(row).emailVerified">Email</span>
            <span class="chip" [class.is-off]="!$any(row).mobileVerified">Mobile</span>
            <app-status-badge [value]="$any(row).kycStatus" />
          </div>
        </ng-template>
        <ng-template appCell="registeredOn" let-row>
          <span class="cell-muted">{{ $any(row).registeredOn | date: 'dd MMM yyyy' }}</span>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button
              type="button"
              class="btn btn--sm"
              [class.btn--subtle-danger]="!$any(row).isBlocked"
              [class.btn--secondary]="$any(row).isBlocked"
              (click)="toggleBlock($any(row))"
            >
              {{ $any(row).isBlocked ? 'Unblock' : 'Block' }}
            </button>
          </div>
        </ng-template>
      </app-data-table>
    </section>
  `,
  styles: [`.chip.is-off { opacity: 0.45; text-decoration: line-through; }`],
})
export class ApplicantsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ApplicantService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly columns = COLUMNS;
  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] as LookupItem[] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });

  protected readonly list = new ListState<Applicant>((request) => this.service.list(request), {
    sortBy: 'registeredOn',
    pageSize: 25,
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  constructor() {
    this.list.sortDir.set('desc');
  }

  protected async toggleBlock(row: Applicant): Promise<void> {
    const blocking = !row.isBlocked;
    const confirmed = await this.confirm.ask({
      title: blocking ? 'Block applicant?' : 'Unblock applicant?',
      message: blocking
        ? `${row.fullName} (${row.applicantCode}) will not be able to sign in to the mobile app.`
        : `${row.fullName} (${row.applicantCode}) regains access to the mobile app.`,
      confirmLabel: blocking ? 'Block' : 'Unblock',
      tone: blocking ? 'danger' : 'primary',
    });
    if (!confirmed) return;
    this.service.setBlocked(row.id, blocking).subscribe(() => {
      this.toast.success(blocking ? 'Applicant blocked' : 'Applicant unblocked', row.applicantCode);
      this.list.reload();
    });
  }
}
