import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  APPLICANT_STANDINGS,
  Applicant,
  ApplicantHistory,
  BlockReason,
  LookupItem,
} from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { ApplicantService, BlockReasonService } from '../../core/services/people.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
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
            <label class="field-label" for="apState">State/UT</label>
            <select id="apState" class="select" (change)="list.setFilter('state', value($event))">
              <option value="">All states/UTs</option>
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
          <div class="field field--range">
            <label class="field-label" for="apFrom">Registered between</label>
            <div class="field-range__inputs">
              <input
                id="apFrom"
                class="input"
                type="date"
                aria-label="Registered from"
                (change)="list.setFilter('registeredFrom', value($event))"
              />
              <span class="field-range__dash">&ndash;</span>
              <input
                id="apTo"
                class="input"
                type="date"
                aria-label="Registered to"
                (change)="list.setFilter('registeredTo', value($event))"
              />
            </div>
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
              class="btn btn--icon"
              title="Access history"
              (click)="openHistory($any(row))"
            >
              <app-icon name="clock" [size]="15" />
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

    @if (blockPrompt(); as prompt) {
      <!-- Both directions are explained. A history that gives grounds only
           for the blocks answers half the questions later put to it. -->
      <app-modal
        [title]="prompt.blocking ? 'Block this account?' : 'Unblock this account?'"
        size="sm"
        (closed)="blockPrompt.set(null)"
      >
        <div class="stack stack-sm">
          <p class="text-sm">
            {{ prompt.row.fullName }} ({{ prompt.row.applicantCode }})
            @if (prompt.blocking) {
              will not be able to sign in to the mobile app. The account and its history are kept.
            } @else {
              regains access to the mobile app.
            }
          </p>

          @if (prompt.blocking) {
            <div class="field">
              <label class="field-label" for="blockReason">Reason <span class="req">*</span></label>
              <select
                id="blockReason"
                class="select"
                [value]="blockReasonId() ?? ''"
                (change)="blockReasonId.set(numberValue($event))"
              >
                <option value="">Choose a reason</option>
                @for (reason of blockReasons(); track reason.id) {
                  <option [value]="reason.id">{{ reason.label }}</option>
                }
              </select>
              @if (blockReasons().length === 0) {
                <span class="field-hint">
                  No reasons have been set up yet. A Super Admin adds them under System Settings.
                </span>
              }
            </div>
          }

          <div class="field">
            <label class="field-label" for="blockNote">
              Note
              @if (!prompt.blocking || chosenBlockReason()?.requiresNote) {
                <span class="req">*</span>
              }
            </label>
            <textarea
              id="blockNote"
              class="textarea"
              maxlength="1000"
              [value]="blockNote()"
              (input)="blockNote.set(textValue($event))"
              [placeholder]="
                prompt.blocking
                  ? 'What happened, in enough detail to stand up later.'
                  : 'Why this account is being let back in.'
              "
            ></textarea>
            <span class="field-hint">
              Recorded against the account with your name and the date.
            </span>
          </div>
        </div>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="blockPrompt.set(null)">
            Cancel
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--danger]="prompt.blocking"
            [class.btn--primary]="!prompt.blocking"
            [disabled]="!canConfirmBlock() || savingBlock()"
            (click)="confirmBlock()"
          >
            @if (savingBlock()) { <span class="spinner"></span> }
            {{ prompt.blocking ? 'Block' : 'Unblock' }}
          </button>
        </div>
      </app-modal>
    }

    @if (history(); as record) {
      <app-modal [title]="record.fullName" (closed)="history.set(null)">
        <div class="stack stack-md applicant-detail">
          <div class="detail-group">
            <h4 class="section-title">Access</h4>
            <div class="dl">
              <div>
                <div class="dl__term">Applicant ID</div>
                <div class="dl__value"><code>{{ record.applicantCode }}</code></div>
              </div>
              <div>
                <div class="dl__term">Now</div>
                <div class="dl__value">{{ record.isBlocked ? 'Blocked' : 'Active' }}</div>
              </div>
              @if (record.isBlocked) {
                <div>
                  <div class="dl__term">Blocked on</div>
                  <div class="dl__value">
                    {{ record.blockedOn | date: 'dd MMM yyyy, HH:mm' }}
                  </div>
                </div>
                <div>
                  <div class="dl__term">Current reason</div>
                  <div class="dl__value">{{ record.blockReasonLabel }}</div>
                </div>
              }
            </div>
          </div>

          @if (record.events.length === 0) {
            <p class="text-muted text-sm">
              This account has never been blocked.
            </p>
          } @else {
            <div class="table-wrap">
              <table class="table table--compact">
                <thead>
                  <tr><th>When</th><th>Change</th><th>Reason</th><th>By</th></tr>
                </thead>
                <tbody>
                  @for (event of record.events; track event.id) {
                    <tr>
                      <td class="tabular">{{ event.on | date: 'dd MMM yyyy, HH:mm' }}</td>
                      <td>{{ event.blocked ? 'Blocked' : 'Unblocked' }}</td>
                      <td>
                        @if (event.reasonLabel) { <div>{{ event.reasonLabel }}</div> }
                        @if (event.remarks) {
                          <div class="text-xs text-muted">{{ event.remarks }}</div>
                        }
                      </td>
                      <td>
                        {{ event.byUserName }}<br />
                        <span class="text-xs text-muted">{{ event.byUserCode }}</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="history.set(null)">Close</button>
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

  /**
   * The export is its own read, not the rows on screen.
   *
   * A spreadsheet of applicants is opened to be worked through: it wants
   * every answer the sign-up form collected, the dates behind each change of
   * status, and why an account is blocked - none of which fits in a table
   * and none of which is on the list DTO.
   *
   * The custom answers differ per sub-category, so they arrive as a bag and
   * become columns here, one per question that anybody on this list was
   * actually asked.
   */
  protected readonly exportRows = async () => {
    const filters = this.list.filters();
    const rows = await firstValueFrom(
      this.service.exportRows({
        categoryId: filters['categoryId'] ?? null,
        state: filters['state'] ?? null,
        standing: filters['standing'] ?? null,
        isBlocked: filters['isBlocked'] ?? null,
        registeredFrom: filters['registeredFrom'] ?? null,
        registeredTo: filters['registeredTo'] ?? null,
        search: this.list.search(),
      }),
    );

    const questions = [...new Set(rows.flatMap((r) => Object.keys(r.answers ?? {})))];

    return {
      rows: rows.map((r) => ({
        'Applicant ID': r.applicantCode,
        Name: r.fullName,
        Email: r.email,
        Mobile: r.mobile,
        PAN: r.pan,
        Gender: r.gender ?? '',
        'Social category': r.socialCategory ?? '',
        Category: r.category ?? '',
        'Sub-category': r.subCategory ?? '',
        'State/UT': r.state ?? '',
        District: r.district ?? '',
        City: r.city ?? '',
        'Email verified': r.emailVerified ? 'Yes' : 'No',
        'Mobile verified': r.mobileVerified ? 'Yes' : 'No',
        Status: this.standingLabel(r.standing),
        Registered: r.registeredOn,
        'First applied': r.firstAppliedOn ?? '',
        Approved: r.approvedOn ?? '',
        Rejected: r.rejectedOn ?? '',
        'Rejection reason': r.rejectionReason ?? '',
        Access: r.access,
        'Blocked on': r.blockedOn ?? '',
        'Block reason': r.blockReason ?? '',
        'Last signed in': r.lastLoginOn ?? '',
        /* One column per question anybody on this list was asked; blank
           where a particular sub-category's form did not ask it. */
        ...Object.fromEntries(questions.map((q) => [q, r.answers?.[q] ?? ''])),
      })),
      truncated: false,
    };
  };
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

  /* A plain confirm will not do: blocking somebody has to be explained, and
     the explanation is kept. */
  private readonly blockReasonService = inject(BlockReasonService);
  protected readonly blockReasons = toSignal(this.blockReasonService.list(true), {
    initialValue: [] as BlockReason[],
  });

  protected readonly blockPrompt = signal<{ row: Applicant; blocking: boolean } | null>(null);
  protected readonly blockReasonId = signal<number | null>(null);
  protected readonly blockNote = signal('');
  protected readonly savingBlock = signal(false);
  protected readonly history = signal<ApplicantHistory | null>(null);

  protected textValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected numberValue(event: Event): number | null {
    const raw = (event.target as HTMLSelectElement).value;
    return raw ? Number(raw) : null;
  }

  protected readonly chosenBlockReason = computed(() =>
    this.blockReasons().find((r) => r.id === this.blockReasonId()) ?? null,
  );

  /* Mirrors what the server insists on, so the button is not offered for a
     request that is going to come straight back. */
  protected readonly canConfirmBlock = computed(() => {
    const prompt = this.blockPrompt();
    if (!prompt) return false;

    const note = this.blockNote().trim();
    if (!prompt.blocking) return note.length > 0;

    const reason = this.chosenBlockReason();
    if (!reason) return false;
    return !reason.requiresNote || note.length > 0;
  });

  protected toggleBlock(row: Applicant): void {
    this.blockReasonId.set(null);
    this.blockNote.set('');
    this.blockPrompt.set({ row, blocking: !row.isBlocked });
  }

  protected confirmBlock(): void {
    const prompt = this.blockPrompt();
    if (!prompt || !this.canConfirmBlock() || this.savingBlock()) return;

    this.savingBlock.set(true);
    this.service
      .setBlocked(
        prompt.row.id,
        prompt.blocking,
        prompt.blocking ? this.blockReasonId() : null,
        this.blockNote().trim(),
      )
      .subscribe({
        next: () => {
          this.savingBlock.set(false);
          this.blockPrompt.set(null);
          this.toast.success(
            prompt.blocking ? 'Applicant blocked' : 'Applicant unblocked',
            prompt.row.applicantCode,
          );
          this.list.reload();
        },
        error: () => this.savingBlock.set(false),
      });
  }

  protected openHistory(row: Applicant): void {
    this.service.history(row.id).subscribe((record) => this.history.set(record));
  }
}
