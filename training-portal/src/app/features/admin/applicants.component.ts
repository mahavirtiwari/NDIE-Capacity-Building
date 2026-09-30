import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { APPLICANT_STANDINGS, Applicant, LookupItem } from '../../core/models';
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
  { key: 'standing', header: 'Status', width: '150px' },
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
            <label class="field-label" for="apStanding">Status</label>
            <select id="apStanding" class="select" (change)="list.setFilter('standing', value($event))">
              <option value="">All</option>
              @for (option of standings; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </div>

          <!-- Registered between two dates. Either end on its own works: a
               "from" with no "to" is everything since, and the reverse is
               everything up to and including that day. -->
          <div class="field">
            <label class="field-label" for="apFrom">Registered from</label>
            <input
              id="apFrom"
              class="input"
              type="date"
              (change)="list.setFilter('registeredFrom', value($event))"
            />
          </div>
          <div class="field">
            <label class="field-label" for="apTo">Registered to</label>
            <input
              id="apTo"
              class="input"
              type="date"
              (change)="list.setFilter('registeredTo', value($event))"
            />
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
        <ng-template appCell="standing" let-row>
          <app-status-badge [value]="$any(row).standing" />
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
        <div class="stack stack-lg applicant-detail">
          <!-- Who, at a glance: the ID they sign in with, where they stand,
               and whether they are locked out. -->
          <div class="who">
            <span class="who__avatar">{{ initials(row.fullName) }}</span>
            <div class="who__text">
              <strong class="who__name">{{ row.fullName }}</strong>
              <div class="row row-sm row-wrap">
                <code class="who__code">{{ row.applicantCode }}</code>
                <app-status-badge [value]="row.standing" />
                @if (row.isBlocked) {
                  <span class="badge badge--danger">Blocked</span>
                }
              </div>
            </div>
          </div>

          <div class="detail-group">
            <h4 class="section-title">Contact</h4>
            <div class="dl">
              <div>
                <div class="dl__term">Email</div>
                <div class="dl__value">{{ row.email }}</div>
              </div>
              <div>
                <div class="dl__term">Mobile</div>
                <div class="dl__value">{{ row.mobile }}</div>
              </div>
            </div>
          </div>

          <div class="detail-group">
            <h4 class="section-title">Registration</h4>
            <div class="dl">
              <div>
                <div class="dl__term">PAN</div>
                <div class="dl__value">{{ row.pan || '—' }}</div>
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
              @if (row.state || row.city) {
                <div>
                  <div class="dl__term">Location</div>
                  <div class="dl__value">
                    {{ row.city ? row.city + ', ' + (row.state ?? '') : row.state }}
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="detail-group">
            <h4 class="section-title">Activity</h4>
            <div class="dl">
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
          </div>

          <!-- Only where the form actually asked something. A heading over a
               sentence saying there is nothing under it is a heading that
               should not be there. -->
          @if (row.answers?.length) {
            <div class="detail-group">
              <h4 class="section-title">Sign-up form answers</h4>
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
            </div>
          }
        </div>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="detail.set(null)">Close</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .who {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding-bottom: 0.9rem;
        border-bottom: 1px solid var(--border);
      }
      .who__avatar {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 999px;
        background: var(--brand-700);
        color: #fff;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .who__text { display: grid; gap: 0.3rem; }
      .who__name { font-size: 1.05rem; }
      .who__code {
        background: var(--ink-100);
        border-radius: 4px;
        padding: 0.05rem 0.35rem;
      }
      .detail-group { display: grid; gap: 0.5rem; }

      /* A dark rule under the section heading, as wide as the word rather
         than the panel.

         justify-self rather than display:inline-block: the heading is a grid
         item, and a grid item is blockified whatever display it asks for. */
      .applicant-detail .section-title {
        justify-self: start;
        margin: 0;
        padding-bottom: 0.25rem;
        border-bottom: 2px solid var(--brand-700);
      }

      /* A hairline under every row of fields, so a two-column grid reads as
         rows rather than as eight loose values, and the last one in a group
         closes it off before the next heading. */
      .applicant-detail .dl > div {
        padding: 0.4rem 0;
        border-bottom: 1px solid var(--border);
      }
    `,
  ],
})
export class ApplicantsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ApplicantService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly columns = COLUMNS;
  protected readonly detail = signal<Applicant | null>(null);
  protected readonly standings = APPLICANT_STANDINGS;

  protected initials(name: string): string {
    return (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected standingLabel(value: string): string {
    return APPLICANT_STANDINGS.find((s) => s.value === value)?.label ?? value;
  }

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
