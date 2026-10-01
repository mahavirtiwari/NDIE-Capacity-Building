import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AdminRole,
  LookupItem,
  PortalUser,
  RecordStatus,
  UserHistory,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/masters.service';
import { RoleService, UserService } from '../../core/services/people.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { ScopePickerComponent } from '../../shared/components/scope-picker.component';
import { describeError, requiredFormat } from '../../core/validation/formats';
import { ListState, searchTerm } from '../../shared/list-state';

/** The same screen serves "Portal users" and the coordinator-only view. */
export type UserScope = 'all' | 'coordinators';

const COLUMNS: ColumnDef[] = [
  { key: 'userCode', header: 'User ID', sortable: true, width: '120px' },
  { key: 'fullName', header: 'Name', sortable: true, variant: 'primary' },
  { key: 'roleName', header: 'Role', width: '170px' },
  { key: 'contact', header: 'Contact', width: '230px' },
  /* No Scope column. Two chips counting categories and program types told
     nobody which ones, so the number could only prompt opening the row to
     find out - which is where the scope is set and shown in full. */
  { key: 'agencyName', header: 'Agency', variant: 'muted' },
  { key: 'lastLoginOn', header: 'Last login', width: '150px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '140px', align: 'right' },
];

/**
 * Who each tier may create — and therefore edit.
 *
 * Mirrors RoleHierarchy on the server, which is the authority; this copy only
 * decides what to put on screen, so a mismatch shows a button that the API then
 * refuses rather than letting anything through. An Operation Manager was
 * missing here, which left them with no assignable role at all.
 */
const CREATABLE_BY: Record<string, string[]> = {
  SuperAdmin: ['Admin', 'Ministry'],
  Admin: ['OperationManager'],
  OperationManager: ['AgencyAdmin'],
  AgencyAdmin: ['Coordinator'],
};

/*
 * Rank, for the two things a senior tier may do to an account it does not
 * edit: enable or disable it, and hand its password back. Mirrors
 * RoleHierarchy.Outranks on the server.
 */
const TIER_DEPTH: Record<string, number> = {
  SuperAdmin: 0,
  Ministry: 1,
  Admin: 2,
  OperationManager: 3,
  AgencyAdmin: 4,
  Coordinator: 5,
};

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    DatePipe,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    StatusToggleComponent,
    ScopePickerComponent,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text(isCoordinatorView() ? 'page.coordinators.title' : 'page.users.title')"
      [subtitle]="
        copy.text(isCoordinatorView() ? 'page.coordinators.subtitle' : 'page.users.subtitle')
      "
      [icon]="isCoordinatorView() ? 'user-check' : 'users'"
      [breadcrumbs]="[
        { label: isCoordinatorView() ? 'Operations' : 'Administration' },
        { label: copy.text(isCoordinatorView() ? 'page.coordinators.title' : 'page.users.title') }
      ]"
    >
      <button *appCan="'users.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" />
        {{ isCoordinatorView() ? 'New coordinator' : 'New user' }}
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--two-rows">
          <div class="field">
            <label class="field-label" for="usrSearch">Search</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input id="usrSearch" class="input" placeholder="Name, user ID or email" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          @if (!isCoordinatorView()) {
            <div class="field">
              <label class="field-label" for="usrRole">Role</label>
              <select id="usrRole" class="select"
                [value]="list.stagedValue('roleId')"
                (change)="list.stageFilter('roleId', value($event))"
              >
                <option value="">All roles</option>
                @for (role of roles(); track role.id) {
                  <option [value]="role.id">{{ role.name }}</option>
                }
              </select>
            </div>
          }
          <div class="field">
            <label class="field-label" for="usrAgency">Agency</label>
            <select id="usrAgency" class="select"
              [value]="list.stagedValue('agencyId')"
              (change)="list.stageFilter('agencyId', value($event))"
            >
              <option value="">All agencies</option>
              @for (agency of agencies(); track agency.id) {
                <option [value]="agency.id">{{ agency.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="usrState">State/UT</label>
            <select id="usrState" class="select"
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
            <label class="field-label" for="usrStatus">Status</label>
            <select id="usrStatus" class="select"
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
            <button type="button" class="btn btn--ghost" (click)="reset()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Portal users"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No users found"
        emptyIcon="users"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <!-- Just the name. The initials disc repeated what was written
             beside it, and the designation under it turned one line into
             three and set the height of every row in the table. -->
        <ng-template appCell="fullName" let-row>
          {{ $any(row).fullName }}
        </ng-template>
        <ng-template appCell="contact" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).email }}</span>
            <span class="cell-muted">{{ $any(row).mobile }}</span>
          </div>
        </ng-template>
        <ng-template appCell="lastLoginOn" let-row>
          <span class="cell-muted">{{ $any(row).lastLoginOn | date: 'dd MMM, HH:mm' }}</span>
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            @if (canResetPassword($any(row))) {
              <button
                type="button"
                class="btn btn--icon"
                title="Resend sign-in details"
                (click)="resetPassword($any(row))"
              >
                <app-icon name="lock" [size]="15" />
              </button>
            }
            @if (canEdit($any(row))) {
              <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
                <app-icon name="edit" [size]="15" />
              </button>
            }
            <!-- Enable and disable stay available to every tier above, which is
                 the oversight senior tiers keep without editing. -->
            <button
              type="button"
              class="btn btn--icon"
              title="Status history"
              (click)="openHistory($any(row))"
            >
              <app-icon name="clock" [size]="15" />
            </button>
            <app-status-toggle [status]="$any(row).status" (toggled)="setStatus($any(row), $event)" />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit user' : isCoordinatorView() ? 'New coordinator' : 'New portal user'"
        subtitle="The user ID and first-time password are generated by the system."
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="user-form" (ngSubmit)="save()" class="stack stack-md">
          @if (editing(); as current) {
            <div class="alert alert--info">
              <app-icon name="info" [size]="16" />
              <span>
                User ID <strong>{{ current.userCode }}</strong> is system generated and cannot be
                changed. Email is profile data and may be updated freely.
              </span>
            </div>
          }

          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="uName">Full name <span class="req">*</span></label>
              <input id="uName" class="input" formControlName="fullName" />
            </div>
            <div class="field">
              <label class="field-label" for="uDesignation">Designation</label>
              <input id="uDesignation" class="input" formControlName="designation" />
            </div>
            <div class="field">
              <label class="field-label" for="uEmail">Email <span class="req">*</span></label>
              <input id="uEmail" type="email" class="input" formControlName="email"
                placeholder="Enter email address"
                [class.is-invalid]="invalid('email')" />
              @if (invalid('email')) { <span class="field-error">{{ errorFor('email', 'Email') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="uMobile">Mobile <span class="req">*</span></label>
              <input id="uMobile" class="input" formControlName="mobile" maxlength="10" inputmode="numeric"
                placeholder="Enter mobile number"
                [class.is-invalid]="invalid('mobile')" />
              @if (invalid('mobile')) { <span class="field-error">{{ errorFor('mobile', 'Mobile') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="uRole">Role <span class="req">*</span></label>
              <select
                id="uRole"
                class="select"
                formControlName="roleId"
                (change)="onRoleChanged()"
              >
                <option [ngValue]="null">Select role</option>
                @for (role of assignableRoles(); track role.id) {
                  <option [ngValue]="role.id">{{ role.name }}</option>
                }
              </select>
              @if (assignableRoles().length === 0) {
                <span class="field-hint">
                  Your role does not create portal accounts directly.
                </span>
              }
            </div>
            <!-- Implementing agency and Reports to are not asked for.
                 An account answers to whoever created it, and an agency's
                 account belongs to that agency — both known from the caller,
                 so a picker could only record a different answer from the
                 truth. -->
            <div class="field">
              <label class="field-label" for="uState">State/UT</label>
              <select id="uState" class="select" formControlName="stateCode" (change)="onStateChange()">
                <option [ngValue]="null">Select</option>
                @for (state of states(); track state.id) {
                  <option [ngValue]="state.id">{{ state.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="uDistrict">District</label>
              <select id="uDistrict" class="select" formControlName="districtCode">
                <option [ngValue]="null">Select</option>
                @for (district of districts(); track district.id) {
                  <option [ngValue]="district.id">{{ district.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="uCity">City</label>
              <input id="uCity" class="input" formControlName="city" />
            </div>
            <div class="field">
              <label class="field-label" for="uStatus">Status</label>
              <select id="uStatus" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div class="divider"></div>
          <strong class="text-md">Allocation</strong>
          <p class="text-sm text-muted">
            {{ allocationHint() }}
          </p>

          <div class="stack stack-sm">
            @if (axes().category) {
              <app-scope-picker
                label="Categories"
                [options]="categories()"
                [(selected)]="categoryIds"
              />
            }
            @if (axes().subCategory) {
              <app-scope-picker
                label="Sub-categories"
                [options]="subCategoryOptions()"
                [(selected)]="subCategoryIds"
                emptyMessage="Select at least one category first."
              />
            }
            @if (axes().programType) {
              <app-scope-picker
                label="Program types"
                [options]="programTypeOptions()"
                [(selected)]="programTypeIds"
                emptyMessage="Select at least one sub-category first."
              />
            }
            @if (axes().state) {
              <app-scope-picker
                label="States/UTs"
                [options]="states()"
                [(selected)]="stateCodes"
              />
            }
            @if (axes().district) {
              <app-scope-picker
                label="Districts"
                [options]="districtOptions()"
                [(selected)]="districtCodes"
                emptyMessage="Select at least one state first."
              />
            }
            @if (!anyAxis()) {
              <p class="text-sm text-muted">
                This role sees the whole programme, so there is nothing to allocate.
              </p>
            }
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="user-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save user
          </button>
        </div>
      </app-modal>
    }

    @if (generated(); as created) {
      <!-- The password is not shown. It is e-mailed to the account's own
           address, which is where it has to arrive anyway — putting it on
           screen only invites it being passed along some other way, and
           leaves it in a screenshot. -->
      <app-modal title="Account created" size="sm" (closed)="generated.set(null)">
        <div class="stack stack-sm">
          <p class="text-sm">
            <strong>{{ created.userCode }}</strong> has been created. The sign-in details have
            been e-mailed to {{ created.email }}.
          </p>
          <div class="alert alert--info">
            <app-icon name="info" [size]="16" />
            <span>They will be asked to change the password at first sign-in.</span>
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--primary" (click)="generated.set(null)">Done</button>
        </div>
      </app-modal>
    }

    @if (statusPrompt(); as prompt) {
      <!-- Enabling and disabling both ask. A history with reasons on only the
           disables answers half the questions later put to it. -->
      <app-modal
        [title]="prompt.status === 'Active' ? 'Enable this account?' : 'Disable this account?'"
        size="sm"
        (closed)="statusPrompt.set(null)"
      >
        <div class="stack stack-sm">
          <p class="text-sm">
            {{ prompt.row.fullName }} ({{ prompt.row.userCode }})
            @if (prompt.status === 'Active') {
              will be able to sign in again.
            } @else {
              will be signed out and blocked from signing in. The account and its history are kept.
            }
          </p>
          <div class="field">
            <label class="field-label" for="statusReason">
              Reason <span class="req">*</span>
            </label>
            <textarea
              id="statusReason"
              class="textarea"
              maxlength="500"
              [value]="statusReason()"
              (input)="statusReason.set(textValue($event))"
              [placeholder]="
                prompt.status === 'Active'
                  ? 'e.g. Returned from deputation'
                  : 'e.g. Left the agency on 30 September'
              "
            ></textarea>
            <span class="field-hint">
              Recorded against the account with your name and the date, and e-mailed to them.
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
            {{ prompt.status === 'Active' ? 'Enable' : 'Disable' }}
          </button>
        </div>
      </app-modal>
    }

    @if (history(); as record) {
      <app-modal [title]="record.fullName" (closed)="history.set(null)">
        <div class="stack stack-md">
          <div class="dl">
            <div>
              <div class="dl__term">Login</div>
              <div class="dl__value"><code>{{ record.userCode }}</code></div>
            </div>
            <div>
              <div class="dl__term">Role</div>
              <div class="dl__value">{{ record.roleName }}</div>
            </div>
            <div>
              <div class="dl__term">Status</div>
              <div class="dl__value">{{ record.status }}</div>
            </div>
            <div>
              <div class="dl__term">Last signed in</div>
              <div class="dl__value">
                {{ record.lastLoginOn ? (record.lastLoginOn | date: 'dd MMM yyyy, HH:mm') : 'Never' }}
              </div>
            </div>
          </div>

          @if (record.events.length === 0) {
            <p class="text-muted text-sm">
              This account has not been switched on or off since it was created.
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
                      <td>{{ event.fromStatus }} &rarr; {{ event.toStatus }}</td>
                      <td>{{ event.reason }}</td>
                      <td>{{ event.byUserName }}<br /><span class="text-xs text-muted">{{ event.byUserCode }}</span></td>
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
})
export class UsersComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Bound from route data. */
  readonly scope = input<UserScope>('all');

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly isCoordinatorView = computed(() => this.scope() === 'coordinators');

  protected readonly roles = toSignal(this.roleService.all(), { initialValue: [] as AdminRole[] });
  protected readonly agencies = toSignal(this.lookups.agencies(), { initialValue: [] as LookupItem[] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });
  protected readonly districts = signal<LookupItem[]>([]);
  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] as LookupItem[] });
  /* The whole masters; the pickers narrow each to what the axis above it
     allows, the way districts have always narrowed to the chosen states. */
  protected readonly allSubCategories = toSignal(this.lookups.subCategories(null), { initialValue: [] as LookupItem[] });
  protected readonly allProgramTypes = toSignal(this.lookups.programTypes(null), { initialValue: [] as LookupItem[] });
  /* The whole district master; the picker narrows it to the chosen states. */
  protected readonly allDistricts = toSignal(this.lookups.districts(null), {
    initialValue: [] as LookupItem[],
  });
  protected readonly managers = toSignal(this.lookups.operationManagers(), {
    initialValue: [] as LookupItem[],
  });

  /** The signed-in account's own tier, which decides what it may create. */
  private readonly myTier = computed<string | null>(() => this.auth.role());

  /**
   * Only the tier immediately below the signed-in account. Mirrors the
   * server's delegation chain so the dropdown cannot offer something the API
   * will refuse — a Super Admin appoints Admins and the Ministry, an Admin
   * appoints Operation Managers, an agency adds Coordinators.
   */
  protected readonly assignableRoles = computed(() => {
    if (this.isCoordinatorView()) {
      return this.roles().filter((r) => r.baseRole === 'Coordinator');
    }

    const creatable = CREATABLE_BY[this.myTier() ?? ''] ?? [];
    return this.roles().filter((r) => creatable.includes(r.baseRole));
  });

  /**
   * Whether this account is one the signed-in tier may edit.
   *
   * The same rule as creating: whoever may set an account up is the tier that
   * answers for it. Everything further down the chain stays visible and can be
   * enabled or disabled, but is edited by the tier that created it — so the
   * Edit and Reset password buttons are withheld rather than offered and then
   * refused by the server.
   */
  protected canEdit(row: PortalUser): boolean {
    return (CREATABLE_BY[this.myTier() ?? ''] ?? []).includes(row.baseRole);
  }

  /*
   * Wider than canEdit on purpose. An agency's portal user is created by
   * empanelment rather than by a tier that can edit it, so tying the reset to
   * editing left that account with nobody able to issue it a password - and
   * with mail switched off, no way in at all.
   */
  protected canResetPassword(row: PortalUser): boolean {
    if (this.canEdit(row)) return true;

    const mine = TIER_DEPTH[this.myTier() ?? ''];
    const theirs = TIER_DEPTH[row.baseRole];
    return mine !== undefined && theirs !== undefined && mine < theirs;
  }

  protected readonly list = new ListState<PortalUser>((request) => this.service.list(request), {
    sortBy: 'fullName',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<PortalUser | null>(null);
  protected readonly generated = signal<{ userCode: string; email: string } | null>(null);
  /* One signal per axis, bound straight into the pickers. */
  protected readonly categoryIds = signal<number[]>([]);
  protected readonly subCategoryIds = signal<number[]>([]);
  protected readonly programTypeIds = signal<number[]>([]);
  protected readonly stateCodes = signal<number[]>([]);
  protected readonly districtCodes = signal<number[]>([]);

  /** The tier currently chosen in the role dropdown. */
  private readonly chosenBaseRole = computed(() => {
    const roleId = this.roleIdSignal();
    return this.roles().find((r) => r.id === roleId)?.baseRole ?? null;
  });

  /**
   * Whether the account belongs to an implementing agency and answers to
   * somebody above it.
   *
   * Both are questions about a place in the delivery chain, and the tiers
   * above it have no place in one: a Super Admin, an Admin and the Ministry
   * are not mapped to an agency and do not report to a manager. Offering the
   * fields anyway invites somebody to fill them in, and "Not mapped" beside a
   * Ministry account reads as an omission rather than as the answer.
   */
  protected readonly inDeliveryChain = computed(() => {
    const tier = this.chosenBaseRole();
    return tier !== null && tier !== 'SuperAdmin' && tier !== 'Admin' && tier !== 'Ministry';
  });

  /**
   * Which axes the chosen tier is allocated on. Mirrors RoleHierarchy on the
   * server; the server is still the authority, this only decides what to show.
   */
  protected readonly axes = computed(() => {
    switch (this.chosenBaseRole()) {
      case 'Admin':
        return { category: true, subCategory: true, programType: false, state: true, district: false };
      case 'OperationManager':
        return { category: true, subCategory: true, programType: true, state: true, district: false };
      case 'AgencyAdmin':
        return { category: false, subCategory: false, programType: true, state: true, district: false };
      case 'Coordinator':
        return { category: false, subCategory: false, programType: true, state: true, district: true };
      default:
        return { category: false, subCategory: false, programType: false, state: false, district: false };
    }
  });

  protected readonly anyAxis = computed(() => Object.values(this.axes()).some(Boolean));

  protected readonly allocationHint = computed(() =>
    this.anyAxis()
      ? 'This account sees only what is selected here. Nothing selected means no access — ' +
        'use Select all to grant everything you hold.'
      : 'Nothing to allocate for this role.',
  );

  /** Sub-categories offered are limited to the categories chosen above them. */
  protected readonly subCategoryOptions = computed(() => {
    const chosen = this.categoryIds();
    return this.allSubCategories().filter((s) => chosen.includes(Number(s.parentId)));
  });

  /** Program types offered are limited to the sub-categories chosen above them. */
  protected readonly programTypeOptions = computed(() => {
    const chosen = this.subCategoryIds();
    return this.allProgramTypes().filter((p) => chosen.includes(Number(p.parentId)));
  });

  /** Districts offered are limited to the states chosen above them. */
  protected readonly districtOptions = computed(() => {
    const chosen = this.stateCodes();
    return this.allDistricts().filter((d) => chosen.includes(Number(d.parentId)));
  });

  /** The role control as a signal, so the visible axes follow the selection. */
  private readonly roleIdSignal = signal<number | null>(null);

  protected readonly form = this.fb.group({
    fullName: ['', Validators.required],
    designation: [''],
    email: ['', requiredFormat('email')],
    mobile: ['', requiredFormat('mobile')],
    roleId: [null as number | null, Validators.required],
    agencyId: [null as number | null],
    reportsToUserId: [null as number | null],
    stateCode: [null as number | null],
    districtCode: [null as number | null],
    city: [''],
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

  constructor() {
    /* Narrowing the options is not enough on its own. A sub-category ticked
       under a category that is then unticked stays in the selection, off
       screen, and is saved with the rest — the account ends up holding reach
       its categories do not grant, and nothing on the form ever said so.
       Each axis is therefore pruned to what the axis above it still allows.

       Guarded on the master being loaded: an empty list means the lookup has
       not arrived, and pruning against it would wipe the allocation of the
       user whose form was just opened. */
    effect(() => {
      const categories = this.categoryIds();
      const all = this.allSubCategories();
      if (all.length === 0) return;

      this.subCategoryIds.update((chosen) => {
        const kept = chosen.filter((id) =>
          all.some((s) => s.id === id && categories.includes(Number(s.parentId))));
        return kept.length === chosen.length ? chosen : kept;
      });
    });

    effect(() => {
      const subCategories = this.subCategoryIds();
      const all = this.allProgramTypes();
      if (all.length === 0) return;

      this.programTypeIds.update((chosen) => {
        const kept = chosen.filter((id) =>
          all.some((p) => p.id === id && subCategories.includes(Number(p.parentId))));
        return kept.length === chosen.length ? chosen : kept;
      });
    });

    effect(() => {
      const states = this.stateCodes();
      const all = this.allDistricts();
      if (all.length === 0) return;

      this.districtCodes.update((chosen) => {
        const kept = chosen.filter((id) =>
          all.some((d) => d.id === id && states.includes(Number(d.parentId))));
        return kept.length === chosen.length ? chosen : kept;
      });
    });

    effect(() => {
      /* Re-scope the query whenever the route switches between the two views.
         The view is the only dependency: setFilter reads the current filters
         on its way to writing them, and tracking that read would make this
         effect retrigger on its own write. */
      const coordinatorsOnly = this.isCoordinatorView();
      untracked(() => {
        this.list.setFilter('baseRole', coordinatorsOnly ? 'Coordinator' : null);
        /* Portal users is the staff register: admins, operation managers
           and the ministry. An agency login is shown with its agency and a
           coordinator with its coordinators, so neither is listed twice. */
        this.list.setFilter(
          'excludeBaseRoles', coordinatorsOnly ? null : 'Coordinator,AgencyAdmin');
      });
    });
  }

  /** Districts follow the LGD state that was picked. */
  protected onStateChange(): void {
    const stateCode = this.form.value.stateCode ?? null;
    this.form.patchValue({ districtCode: null }, { emitEvent: false });
    this.lookups.districts(stateCode).subscribe((items) => this.districts.set(items));
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected reset(): void {
    this.list.clearFilters();
    this.list.setFilter('baseRole', this.isCoordinatorView() ? 'Coordinator' : null);
  }

  protected openForm(row?: PortalUser): void {
    this.editing.set(row ?? null);
    this.categoryIds.set(row?.categoryIds ?? []);
    this.subCategoryIds.set(row?.subCategoryIds ?? []);
    this.programTypeIds.set(row?.programTypeIds ?? []);
    this.stateCodes.set(row?.stateCodes ?? []);
    this.districtCodes.set(row?.districtCodes ?? []);
    this.roleIdSignal.set(row?.roleId ?? null);
    this.form.reset({
      fullName: row?.fullName ?? '',
      designation: row?.designation ?? '',
      email: row?.email ?? '',
      mobile: row?.mobile ?? '',
      roleId: row?.roleId ?? (this.isCoordinatorView() ? (this.assignableRoles()[0]?.id ?? null) : null),
      agencyId: row?.agencyId ?? null,
      reportsToUserId: row?.reportsToUserId ?? null,
      stateCode: row?.stateCode ?? null,
      districtCode: row?.districtCode ?? null,
      city: row?.city ?? '',
      status: row?.status ?? 'Active',
    });
    this.lookups.districts(row?.stateCode ?? null).subscribe((items) => this.districts.set(items));
    this.formOpen.set(true);
  }

  /**
   * The allocation axes follow the tier, so a change of role clears selections
   * that no longer apply — leaving them behind would submit an allocation the
   * form is no longer showing.
   */
  protected onRoleChanged(): void {
    this.roleIdSignal.set(this.form.controls.roleId.value ?? null);
    const axes = this.axes();
    if (!axes.category) this.categoryIds.set([]);
    if (!axes.subCategory) this.subCategoryIds.set([]);
    if (!axes.programType) this.programTypeIds.set([]);
    if (!axes.state) this.stateCodes.set([]);
    if (!axes.district) this.districtCodes.set([]);

    /* Same reason the axes are cleared: a value left behind by the previous
       role is still on the form and would be saved with it. */
    if (!this.inDeliveryChain()) {
      this.form.controls.agencyId.setValue(null);
      this.form.controls.reportsToUserId.setValue(null);
    }
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
    const raw = this.form.getRawValue();
    const role = this.roles().find((r) => r.id === raw.roleId);
    const payload = {
      ...raw,
      categoryIds: this.categoryIds(),
      subCategoryIds: this.subCategoryIds(),
      programTypeIds: this.programTypeIds(),
      stateCodes: this.stateCodes(),
      districtCodes: this.districtCodes(),
      baseRole: role?.baseRole ?? 'Coordinator',
    };
    const current = this.editing();

    if (current) {
      this.service.update(current.id, payload).subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.closeForm();
          this.list.reload();
          this.toast.success('User updated', saved.fullName);
        },
        error: () => this.saving.set(false),
      });
      return;
    }

    this.service.createUser(payload).subscribe({
      next: (credentials) => {
        this.saving.set(false);
        this.closeForm();
        this.list.reload();
        /* The generated user ID, and where the password went. The password
           itself is not held here at all — the server e-mails it and this
           screen never needs a copy. */
        this.generated.set({
          userCode: credentials.userCode,
          email: payload.email ?? '',
        });
      },
      error: () => this.saving.set(false),
    });
  }

  /**
   * Sends the account's sign-in details to its own e-mail address.
   *
   * It cannot send the password they already have. Passwords are kept as a
   * hash and never in readable form, so nobody — not this screen, not the
   * database, not an administrator — can read one back. What it can do is
   * issue a working one and deliver it, which is what somebody who has lost
   * their details actually needs.
   *
   * The dialog says so plainly, because the difference matters: the password
   * they were using stops working the moment this is done.
   */
  protected async resetPassword(row: PortalUser): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Resend sign-in details?',
      message:
        `${row.fullName} (${row.userCode}) will be e-mailed a fresh password at the address ` +
        'on their account. Their current password stops working — passwords are stored as a ' +
        'hash, so the one they have cannot be read back and sent again.',
      confirmLabel: 'Send details',
    });
    if (!confirmed) return;

    this.service.resetPassword(row.id).subscribe(() => {
      this.toast.success(
        'Sign-in details sent',
        `${row.fullName} has been e-mailed a fresh password at ${row.email}.`,
      );
    });
  }

  /* A plain confirm will not do here: the change has to be explained, and the
     explanation is stored. */
  protected readonly statusPrompt = signal<{ row: PortalUser; status: RecordStatus } | null>(null);
  protected readonly statusReason = signal('');
  protected readonly savingStatus = signal(false);
  protected readonly history = signal<UserHistory | null>(null);

  protected textValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected setStatus(row: PortalUser, status: RecordStatus): void {
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
          `User ${prompt.status === 'Active' ? 'enabled' : 'disabled'}`,
          `${prompt.row.fullName} has been told by e-mail.`,
        );
        this.list.reload();
      },
      error: () => this.savingStatus.set(false),
    });
  }

  protected openHistory(row: PortalUser): void {
    this.service.history(row.id).subscribe((record) => this.history.set(record));
  }
}
