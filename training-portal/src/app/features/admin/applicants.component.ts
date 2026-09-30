import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Applicant, LookupItem } from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { ApplicantService } from '../../core/services/people.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
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
  { key: 'verification', header: 'Verification', width: '130px' },
  { key: 'registeredOn', header: 'Registered', width: '130px' },
  { key: 'actions', header: '', width: '150px', align: 'right' },
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
    ModalComponent,
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
        exportName="Applicants"
        [exportRows]="exportRows"
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
            <button type="button" class="cell-link" (click)="openDetail($any(row))">
              {{ $any(row).fullName }}
            </button>
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
        <ng-template appCell="verification" let-row>
          <app-status-badge [value]="$any(row).kycStatus" />
        </ng-template>
        <ng-template appCell="registeredOn" let-row>
          <span class="cell-muted">{{ $any(row).registeredOn | date: 'dd MMM yyyy' }}</span>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button
              type="button"
              class="btn btn--sm btn--secondary"
              (click)="openDetail($any(row))"
            >
              Details
            </button>
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

    @if (detail(); as row) {
      <!-- The sign-up form is per sub-category, so what an applicant was asked
           beyond the standard particulars is not the same for everybody. The
           list cannot hold a column per question; this is where they are read. -->
      <app-modal [title]="row.fullName" (closed)="detail.set(null)">
        <div class="stack stack-md">
          <div class="dl">
            <div>
              <div class="dl__term">Applicant ID</div>
              <div class="dl__value"><code>{{ row.applicantCode }}</code></div>
            </div>
            <div>
              <div class="dl__term">PAN</div>
              <div class="dl__value">{{ row.pan || '—' }}</div>
            </div>
            <div>
              <div class="dl__term">Email</div>
              <div class="dl__value">{{ row.email }}</div>
            </div>
            <div>
              <div class="dl__term">Mobile</div>
              <div class="dl__value">{{ row.mobile }}</div>
            </div>
            <div>
              <div class="dl__term">Category</div>
              <div class="dl__value">{{ row.categoryName }}</div>
            </div>
            <div>
              <div class="dl__term">Sub-category</div>
              <div class="dl__value">{{ row.subCategoryName }}</div>
            </div>
            <div>
              <div class="dl__term">Gender</div>
              <div class="dl__value">{{ row.gender || 'Not stated' }}</div>
            </div>
            <div>
              <div class="dl__term">Social category</div>
              <div class="dl__value">{{ row.socialCategory || 'Not stated' }}</div>
            </div>
            <div>
              <div class="dl__term">Registered</div>
              <div class="dl__value">{{ row.registeredOn | date: 'dd MMM yyyy' }}</div>
            </div>
            <div>
              <div class="dl__term">Last signed in</div>
              <div class="dl__value">
                {{ row.lastLoginOn ? (row.lastLoginOn | date: 'dd MMM yyyy, HH:mm') : 'Never' }}
              </div>
            </div>
          </div>

          <div class="stack stack-sm">
            <h4 class="section-title">Sign-up form answers</h4>
            @if (!row.answers?.length) {
              <p class="text-muted text-sm">
                This sub-category's sign-up form asked nothing beyond the particulars above.
              </p>
            } @else {
              <div class="table-wrap">
                <table class="table table--compact">
                  <thead>
                    <tr><th>Question</th><th>Answer</th></tr>
                  </thead>
                  <tbody>
                    @for (answer of row.answers; track answer.key) {
                      <tr>
                        <td>{{ answer.label }}</td>
                        <td>{{ answer.value || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="detail.set(null)">Close</button>
        </div>
      </app-modal>
    }
  `,
})
export class ApplicantsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ApplicantService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly columns = COLUMNS;
  protected readonly detail = signal<Applicant | null>(null);

  /* Read fresh rather than taken from the row: the list does not carry the
     sign-up answers, because most of the time nobody is looking at them. */
  protected openDetail(row: Applicant): void {
    this.detail.set(row);
    this.service.getById(row.id).subscribe((full) => this.detail.set(full));
  }

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
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
