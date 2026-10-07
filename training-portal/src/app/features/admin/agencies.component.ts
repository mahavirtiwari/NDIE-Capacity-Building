import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AGENCY_TYPES,
  AgencyHistory,
  AllocatableScope,
  ImplementingAgency,
  LookupItem,
  RecordStatus,
} from '../../core/models';
import { AgencyService, LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { MasterFilterComponent } from '../../shared/components/master-filter.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { TimelineComponent } from '../../shared/components/timeline.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { ScopePickerComponent } from '../../shared/components/scope-picker.component';
import {
  UppercaseDirective,
  describeError,
  formatValidator,
  requiredFormat,
} from '../../core/validation/formats';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'code', header: 'Code', sortable: true, width: '140px' },
  { key: 'name', header: 'Agency', sortable: true, variant: 'primary' },
  { key: 'agencyType', header: 'Type', width: '170px' },
  { key: 'contact', header: 'Contact person', width: '230px' },
  /* The agency's own login. It used to be findable only in the portal
     users register, which listed it beside admins and operation managers
     and made that one list of four unrelated kinds of account. */
  { key: 'login', header: 'Login', width: '190px' },
  { key: 'mapping', header: 'Empanelled for', width: '260px' },
  { key: 'empanelmentValidTill', header: 'Valid till', width: '130px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-agencies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    UppercaseDirective,
    DatePipe,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    TimelineComponent,
    StatusToggleComponent,
    ScopePickerComponent,
    ModalComponent,
    IconComponent,
    MasterFilterComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.agencies.title')"
      [subtitle]="copy.text('page.agencies.subtitle')"
      icon="building"
      [breadcrumbs]="[{ label: 'Administration' }, { label: copy.text('page.agencies.title') }]"
    >
      <button *appCan="'agencies.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New agency
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--inline">
          <div class="field">
            <label class="field-label" for="agSearch">Search</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input id="agSearch" class="input" placeholder="Agency, code or contact" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="agType">Agency type</label>
            <select id="agType" class="select"
              [value]="list.stagedValue('agencyType')"
              (change)="list.stageFilter('agencyType', value($event))"
            >
              <option value="">All types</option>
              @for (type of agencyTypes; track type) {
                <option [value]="type">{{ type }}</option>
              }
            </select>
          </div>
          <app-master-filter [list]="list" programTypeLabel="Program type" #masters />
          <div class="field">
            <label class="field-label" for="agState">State/UT</label>
            <select id="agState" class="select"
              [value]="list.stagedValue('state')"
              (change)="list.stageFilter('state', value($event))"
            >
              <option value="">All states/UTs</option>
              @for (state of states(); track state.id) {
                <option [value]="state.name">{{ state.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="agStatus">Status</label>
            <select id="agStatus" class="select"
              [value]="list.stagedValue('status')"
              (change)="list.stageFilter('status', value($event))"
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--primary" (click)="list.applyFilters()">
              <app-icon name="filter" [size]="15" /> Apply
            </button>
            <button type="button" class="btn btn--ghost" (click)="masters.clear(); list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Implementing agencies"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No implementing agencies"
        emptyIcon="building"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="contact" let-row>
          <div class="stack stack-xs">
            <strong class="text-sm">{{ $any(row).contactPerson }}</strong>
            <span class="cell-muted">{{ $any(row).email }}</span>
            <span class="cell-muted">{{ $any(row).mobile }}</span>
          </div>
        </ng-template>
        <ng-template appCell="login" let-row>
          <!-- The user ID alone. Whether the login is enabled and when it
               was last used are on the agency's own row, and repeating them
               here made one column three lines tall. -->
          @if ($any(row).loginUserCode) {
            <span class="text-sm">{{ $any(row).loginUserCode }}</span>
          } @else {
            <span class="cell-muted">No login yet</span>
          }
        </ng-template>
        <!-- Named, not counted. "1 categories" said an agency was
             empanelled for something without saying what, and the only way
             to find out was to open the row. -->
        <ng-template appCell="mapping" let-row>
          @if ($any(row).programTypeNames.length || $any(row).categoryNames.length) {
            <div class="stack stack-xs">
              @if ($any(row).categoryNames.length) {
                <span class="cell-muted">{{ $any(row).categoryNames.join(', ') }}</span>
              }
              <div class="row row-sm row-wrap" [title]="$any(row).programTypeNames.join(', ')">
                @for (name of $any(row).programTypeNames.slice(0, 2); track name) {
                  <span class="chip">{{ name }}</span>
                }
                <!-- Two, then a count. An agency empanelled for a dozen
                     tracks would otherwise be a dozen lines tall; the rest
                     are on hover, and all of them are in the row. -->
                @if ($any(row).programTypeNames.length > 2) {
                  <span class="chip chip--muted">
                    +{{ $any(row).programTypeNames.length - 2 }} more
                  </span>
                }
              </div>
            </div>
          } @else {
            <span class="cell-muted">—</span>
          }
        </ng-template>
        <ng-template appCell="empanelmentValidTill" let-row>
          {{ $any(row).empanelmentValidTill | date: 'dd MMM yyyy' }}
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button type="button" class="btn btn--icon" title="View details"
              (click)="details.set($any(row))">
              <app-icon name="eye" [size]="15" />
            </button>
            <!-- Withheld rather than shown and refused: an agency is edited
                 by the tier that appointed it, and empanelling is not the
                 Super Admin's to do even for a record it added itself. -->
            @if ($any(row).canEdit !== false) {
              <button *appCan="'agencies.manage'" type="button" class="btn btn--icon"
                title="Edit" (click)="openForm($any(row))">
                <app-icon name="edit" [size]="15" />
              </button>
            }
            <!-- One or the other: an agency either has a login or needs
                 one, and offering both invites issuing a second. -->
            @if ($any(row).loginUserCode) {
              <button *appCan="'agencies.manage'" type="button" class="btn btn--icon"
                title="Resend password" (click)="resendPassword($any(row))">
                <app-icon name="send" [size]="15" />
              </button>
            } @else {
              <button *appCan="'agencies.manage'" type="button" class="btn btn--icon"
                title="Issue login" (click)="issueLogin($any(row))">
                <app-icon name="mail" [size]="15" />
              </button>
            }
            <button type="button" class="btn btn--icon" title="History"
              (click)="openHistory($any(row))">
              <app-icon name="clock" [size]="15" />
            </button>
            <!-- Suspending is an edit, and was the one that slipped the
                 guard: the server refuses it without agencies.manage, so
                 offering it only produced a toast. -->
            <ng-container *appCan="'agencies.manage'">
              <app-status-toggle
                [status]="$any(row).status"
                (toggled)="setStatus($any(row), $event)"
              />
            </ng-container>
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (details(); as row) {
      <app-modal
        [title]="row.name"
        [subtitle]="row.code + ' · ' + row.agencyType"
        size="md"
        (closed)="details.set(null)"
      >
        <div class="dl">
          <div>
            <dt>Contact person</dt>
            <dd>{{ row.contactPerson }}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{{ row.email }}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{{ row.mobile }}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>
              {{ row.addressLine1 }}@if (row.addressLine2) {, {{ row.addressLine2 }}}<br />
              {{ row.city }}, {{ row.state }}@if (row.district) { ({{ row.district }})} —
              {{ row.pincode }}
            </dd>
          </div>
          @if (row.gstin) {
            <div>
              <dt>GSTIN</dt>
              <dd>{{ row.gstin }}</dd>
            </div>
          }
          @if (row.pan) {
            <div>
              <dt>PAN</dt>
              <dd>{{ row.pan }}</dd>
            </div>
          }
          <div>
            <dt>Empanelled</dt>
            <dd>
              {{ row.empanelledOn | date: 'dd MMM yyyy' }}
              @if (row.empanelmentValidTill) {
                — valid till {{ row.empanelmentValidTill | date: 'dd MMM yyyy' }}
              }
            </dd>
          </div>
          <div>
            <dt>Categories</dt>
            <dd>{{ row.categoryNames.length ? row.categoryNames.join(', ') : '—' }}</dd>
          </div>
          <div>
            <dt>Program types</dt>
            <dd>{{ row.programTypeNames.length ? row.programTypeNames.join(', ') : '—' }}</dd>
          </div>
          <div>
            <dt>Login</dt>
            <dd>
              @if (row.loginUserCode) {
                {{ row.loginUserCode }}
                @if (row.loginEmail) { · {{ row.loginEmail }} }
                @if (row.loginLastSeenOn) {
                  · last seen {{ row.loginLastSeenOn | date: 'dd MMM yyyy, HH:mm' }}
                } @else {
                  · never signed in
                }
              } @else {
                No login yet
              }
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd><app-status-badge [value]="row.status" /></dd>
          </div>
        </div>

        <div modal-footer>
          <button type="button" class="btn btn--secondary" (click)="details.set(null)">Close</button>
        </div>
      </app-modal>
    }

    @if (statusPrompt(); as prompt) {
      <!-- Both directions ask. A history with grounds on only the
           suspensions answers half the questions later put to it. -->
      <app-modal
        [title]="prompt.status === 'Active' ? 'Empanel back in?' : 'Suspend this agency?'"
        size="sm"
        (closed)="statusPrompt.set(null)"
      >
        <div class="stack stack-sm">
          <p class="text-sm">
            {{ prompt.row.name }} ({{ prompt.row.code }})
            @if (prompt.status === 'Active') {
              can be chosen for new programs again.
            } @else {
              can raise no new program. The batches it has already run are kept.
            }
          </p>
          <div class="field">
            <label class="field-label" for="agStatusReason">
              Reason <span class="req">*</span>
            </label>
            <textarea
              id="agStatusReason"
              class="textarea"
              maxlength="500"
              [value]="statusReason()"
              (input)="statusReason.set(textValue($event))"
              [placeholder]="
                prompt.status === 'Active'
                  ? 'e.g. Documents renewed on 1 April'
                  : 'e.g. Empanelment documents expired'
              "
            ></textarea>
            <span class="field-hint">
              Recorded against the agency with your name and the date, and shown in its history.
            </span>
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="statusPrompt.set(null)">
            Cancel
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--primary]="prompt.status === 'Active'"
            [class.btn--danger]="prompt.status !== 'Active'"
            [disabled]="statusReason().trim().length === 0 || savingStatus()"
            (click)="confirmStatus()"
          >
            @if (savingStatus()) { <span class="spinner"></span> }
            {{ prompt.status === 'Active' ? 'Empanel back in' : 'Suspend' }}
          </button>
        </div>
      </app-modal>
    }

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit implementing agency' : 'New implementing agency'"
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="agency-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid">
            <div class="field field--span-2">
              <label class="field-label" for="agName">Agency name <span class="req">*</span></label>
              <input id="agName" class="input" formControlName="name" />
            </div>
            <div class="field">
              <label class="field-label" for="agPerson">Contact person <span class="req">*</span></label>
              <input id="agPerson" class="input" formControlName="contactPerson" />
            </div>
            <div class="field">
              <label class="field-label" for="agEmail">Email <span class="req">*</span></label>
              <input id="agEmail" type="email" class="input" formControlName="email"
                placeholder="Enter email address"
                [class.is-invalid]="invalid('email')" />
              @if (invalid('email')) { <span class="field-error">{{ errorFor('email', 'Email') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="agMobile">Mobile <span class="req">*</span></label>
              <input id="agMobile" class="input" formControlName="mobile" maxlength="10" inputmode="numeric"
                placeholder="Enter mobile number"
                [class.is-invalid]="invalid('mobile')" />
              @if (invalid('mobile')) { <span class="field-error">{{ errorFor('mobile', 'Mobile') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="agGstin">GSTIN</label>
              <input id="agGstin" class="input" formControlName="gstin" appUppercase maxlength="15"
                placeholder="27AABCU9603R1ZX" [class.is-invalid]="invalid('gstin')" />
              @if (invalid('gstin')) { <span class="field-error">{{ errorFor('gstin', 'GSTIN') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="agPan">PAN <span class="req">*</span></label>
              <input id="agPan" class="input" formControlName="pan" appUppercase maxlength="10"
                placeholder="ABCDE1234F" [class.is-invalid]="invalid('pan')" />
              @if (invalid('pan')) { <span class="field-error">{{ errorFor('pan', 'PAN') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="agTypeSel">Agency type <span class="req">*</span></label>
              <select id="agTypeSel" class="select" formControlName="agencyType">
                @for (type of agencyTypes; track type) {
                  <option [value]="type">{{ type }}</option>
                }
              </select>
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="agAddr1">Address <span class="req">*</span></label>
              <!-- A postal address runs to several lines, and a one-line box
                   made the operator scroll sideways through their own typing. -->
              <textarea
                id="agAddr1"
                class="textarea"
                formControlName="addressLine1"
                rows="3"
                maxlength="300"
              ></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="agCity">City <span class="req">*</span></label>
              <input id="agCity" class="input" formControlName="city" />
            </div>
            <div class="field">
              <label class="field-label" for="agStateSel">State/UT <span class="req">*</span></label>
              <select id="agStateSel" class="select" formControlName="stateCode" (change)="onStateChange()">
                <option [ngValue]="null">Select</option>
                @for (state of addressStates(); track state.id) {
                  <option [ngValue]="state.id">{{ state.name }}</option>
                }
              </select>
              <span class="field-hint">Values come from the LGD master.</span>
            </div>
            <div class="field">
              <label class="field-label" for="agDistrictSel">District</label>
              <select id="agDistrictSel" class="select" formControlName="districtCode">
                <option [ngValue]="null">Select</option>
                @for (district of districts(); track district.id) {
                  <option [ngValue]="district.id">{{ district.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="agPin">Pincode <span class="req">*</span></label>
              <input id="agPin" class="input" formControlName="pincode" maxlength="6" inputmode="numeric"
                [class.is-invalid]="invalid('pincode')" />
              @if (invalid('pincode')) { <span class="field-error">{{ errorFor('pincode', 'Pincode') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="agFrom">Empanelled on</label>
              <input id="agFrom" type="date" class="input" formControlName="empanelledOn" />
            </div>
            <div class="field">
              <label class="field-label" for="agTill">Valid till</label>
              <input id="agTill" type="date" class="input" formControlName="empanelmentValidTill" />
            </div>
            <div class="field">
              <label class="field-label" for="agStatusSel">Status</label>
              <select id="agStatusSel" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div class="divider"></div>
          <strong class="text-md">Empanelled for</strong>
          <p class="text-sm text-muted">
            The agency — and the coordinators it goes on to add — can only work inside what is
            selected here. You can allocate only what your own account holds.
          </p>

          <div class="stack stack-sm">
            <app-scope-picker
              label="Program types"
              [options]="programTypes()"
              [(selected)]="programTypeIds"
            />

            <!-- Not a choice. An agency is empanelled for named program
                 types, and those sit in a sub-category which sits in a
                 category; asking for all three separately let an agency be
                 recorded against a category none of its program types
                 belonged to. Shown so the consequence of the selection
                 above is visible while it is being made. -->
            <div class="field">
              <span class="field-label">Which comes to</span>
              @if (impliedCategories().length === 0) {
                <span class="text-muted text-sm">
                  Choose a program type and its category appears here.
                </span>
              } @else {
                <div class="row row-sm row-wrap">
                  @for (name of impliedCategories(); track name) {
                    <span class="chip">{{ name }}</span>
                  }
                  @for (name of impliedSubCategories(); track name) {
                    <span class="chip chip--muted">{{ name }}</span>
                  }
                </div>
              }
            </div>
            <app-scope-picker
              label="States/UTs"
              [options]="scopeStates()"
              [(selected)]="stateCodes"
            />
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="agency-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save agency
          </button>
        </div>
      </app-modal>
    }

    @if (history(); as record) {
      <app-modal
        [title]="record.name"
        [subtitle]="record.code + ' · empanelled ' + (record.empanelledOn | date: 'dd MMM yyyy')"
        size="lg"
        (closed)="history.set(null)"
      >
        <app-timeline
          [events]="record.timeline"
          emptyMessage="Nothing has been recorded against this agency yet."
        />
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="history.set(null)">Close</button>
        </div>
      </app-modal>
    }
  `,
})
export class AgenciesComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(AgencyService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly agencyTypes = AGENCY_TYPES;

  /* The whole masters, for the filter bar and for the agency's own
     registered address - an office can be anywhere. */
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });

  /* The whole LGD master, for the postal address. Not narrowed:
     where somebody lives is a fact about them, not a slice of the
     estate, and the person appointed may well live outside it. */
  protected readonly addressStates = toSignal(this.lookups.addressStates(), {
    initialValue: [] as LookupItem[],
  });
  protected readonly districts = signal<LookupItem[]>([]);

  /* What this account may empanel an agency for, which is what it holds
     itself. An operation manager allocated two program types used to be
     shown every one in the scheme and refused on Save; the boundary has
     always been enforced there, and is now visible before anything is
     ticked. */
  private readonly allocatable = toSignal(this.lookups.allocatableScope(), {
    initialValue: {
      categories: [], subCategories: [], programTypes: [], states: [], districts: [],
    } as AllocatableScope,
  });

  protected readonly categories = computed(() => this.allocatable().categories);
  protected readonly subCategories = computed(() => this.allocatable().subCategories);
  protected readonly programTypes = computed(() => this.allocatable().programTypes);
  protected readonly scopeStates = computed(() => this.allocatable().states);

  protected readonly list = new ListState<ImplementingAgency>((request) => this.service.list(request), {
    sortBy: 'name',
  });

  protected readonly history = signal<AgencyHistory | null>(null);

  /** The agency whose details are on screen, or null. */
  protected readonly details = signal<ImplementingAgency | null>(null);

  protected readonly statusPrompt = signal<
    { row: ImplementingAgency; status: RecordStatus } | null>(null);
  protected readonly statusReason = signal('');
  protected readonly savingStatus = signal(false);

  /** The empanelment, the login, the coordinators and the batches. */
  protected openHistory(row: ImplementingAgency): void {
    this.service.history(row.id).subscribe((record) => this.history.set(record));
  }

  /** For an agency empanelled without one. The server e-mails the credentials. */
  protected issueLogin(row: ImplementingAgency): void {
    this.service.issueLogin(row.id).subscribe(() => {
      this.toast.success('Login created', `Credentials sent to ${row.email}.`);
      this.list.reload();
    });
  }

  protected resendPassword(row: ImplementingAgency): void {
    this.service.resendLoginPassword(row.id).subscribe(() => {
      this.toast.success('Password sent', `A new first-time password went to ${row.email}.`);
      this.list.reload();
    });
  }
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<ImplementingAgency | null>(null);
  /* Read off the chosen program types rather than chosen themselves,
     the same way the server records them. */
  protected readonly impliedCategories = computed(() => {
    const chosen = this.programTypeIds();
    const categories = new Map(this.categories().map((c) => [Number(c.id), c.name]));
    const subCategories = new Map(this.subCategories().map((c) => [Number(c.id), c]));

    const names = new Set<string>();
    for (const type of this.programTypes().filter((p) => chosen.includes(Number(p.id)))) {
      const sub = subCategories.get(Number(type.parentId));
      const name = sub ? categories.get(Number(sub.parentId)) : undefined;
      if (name) names.add(name);
    }
    return [...names];
  });

  protected readonly impliedSubCategories = computed(() => {
    const chosen = this.programTypeIds();
    const subCategories = new Map(this.subCategories().map((c) => [Number(c.id), c.name]));

    const names = new Set<string>();
    for (const type of this.programTypes().filter((p) => chosen.includes(Number(p.id)))) {
      const name = subCategories.get(Number(type.parentId));
      if (name) names.add(name);
    }
    return [...names];
  });
  protected readonly programTypeIds = signal<number[]>([]);
  protected readonly stateCodes = signal<number[]>([]);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    agencyType: ['Government Body', Validators.required],
    contactPerson: ['', Validators.required],
    email: ['', requiredFormat('email')],
    mobile: ['', requiredFormat('mobile')],
    gstin: ['', [formatValidator('gstin')]],
    /* An agency is a legal body being paid by the scheme, so its PAN is
       as much a part of the record as its name. */
    pan: ['', requiredFormat('pan')],
    addressLine1: ['', Validators.required],
    city: ['', Validators.required],
    stateCode: [null as number | null, Validators.required],
    districtCode: [null as number | null],
    pincode: ['', requiredFormat('pincode')],
    empanelledOn: [new Date().toISOString().slice(0, 10)],
    empanelmentValidTill: [''],
    status: ['Active'],
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected errorFor(control: string, label: string): string {
    return describeError(this.form.get(control)?.errors ?? null, label);
  }

  /** Districts follow the LGD state that was picked. */
  protected onStateChange(): void {
    const stateCode = this.form.value.stateCode ?? null;
    this.form.patchValue({ districtCode: null }, { emitEvent: false });
    this.lookups.addressDistricts(stateCode).subscribe((items) => this.districts.set(items));
  }

  protected openForm(row?: ImplementingAgency): void {
    this.editing.set(row ?? null);
    this.programTypeIds.set(row?.programTypeIds ?? []);
    this.stateCodes.set(row?.stateCodes ?? []);
    this.form.reset({
      name: row?.name ?? '',
      agencyType: row?.agencyType ?? 'Government Body',
      contactPerson: row?.contactPerson ?? '',
      email: row?.email ?? '',
      mobile: row?.mobile ?? '',
      gstin: row?.gstin ?? '',
      pan: row?.pan ?? '',
      addressLine1: row?.addressLine1 ?? '',
      city: row?.city ?? '',
      stateCode: row?.stateCode ?? null,
      districtCode: row?.districtCode ?? null,
      pincode: row?.pincode ?? '',
      empanelledOn: row?.empanelledOn ?? new Date().toISOString().slice(0, 10),
      empanelmentValidTill: row?.empanelmentValidTill ?? '',
      status: row?.status ?? 'Active',
    });
    this.lookups.addressDistricts(row?.stateCode ?? null).subscribe((items) => this.districts.set(items));
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const payload = {
      ...this.form.getRawValue(),
      /* Sent empty: the server reads them off the program types. Kept on
         the payload because the contract still carries them. */
      categoryIds: [],
      subCategoryIds: [],
      programTypeIds: this.programTypeIds(),
      stateCodes: this.stateCodes(),
    };
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Agency saved', payload.name ?? '');
        this.lookups.invalidate('agencies');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  /* A reason, not a yes/no. Suspending an agency stops every batch it would
     raise, and the history sheet has to be able to say who decided it and on
     what grounds — which a confirm dialog cannot capture. */
  protected textValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected setStatus(row: ImplementingAgency, status: RecordStatus): void {
    this.statusReason.set('');
    this.statusPrompt.set({ row, status });
  }

  protected confirmStatus(): void {
    const prompt = this.statusPrompt();
    const reason = this.statusReason().trim();
    if (!prompt || reason.length === 0 || this.savingStatus()) return;

    this.savingStatus.set(true);
    this.service.setStatus(prompt.row.id, prompt.status, reason).subscribe({
      next: () => {
        this.savingStatus.set(false);
        this.statusPrompt.set(null);
        this.toast.success(
          `Agency ${prompt.status === 'Active' ? 'empanelled back in' : 'suspended'}`,
          prompt.row.name,
        );
        this.lookups.invalidate('agencies');
        this.list.reload();
      },
      error: () => this.savingStatus.set(false),
    });
  }
}
