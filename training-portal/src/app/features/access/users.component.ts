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
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import {
  AdminRole,
  AllocatableScope,
  LookupItem,
  PortalUser,
  RecordStatus,
  ScopeAxes,
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
import { TimelineComponent } from '../../shared/components/timeline.component';
import {
  describeError,
  formatValidator,
  requiredFormat,
  UppercaseDirective,
} from '../../core/validation/formats';
import { ListState, searchTerm } from '../../shared/list-state';

/** The same screen serves "Portal users" and the coordinator-only view. */
export type UserScope = 'all' | 'coordinators';

const COLUMNS: ColumnDef[] = [
  /* The code opens the account. It is the identity the system issued —
     a name is shared and is the holder's to change — and it saves an icon
     whose only job was to open the same sheet. */
  { key: 'userCode', header: 'User ID', sortable: true, width: '115px' },
  { key: 'fullName', header: 'Name', sortable: true, variant: 'primary' },
  { key: 'roleName', header: 'Role', width: '170px' },
  { key: 'contact', header: 'Contact', width: '230px' },
  /* No Scope column. Two chips counting categories and program types told
     nobody which ones, so the number could only prompt opening the row to
     find out - which is where the scope is set and shown in full. */
  { key: 'agencyName', header: 'Agency', variant: 'muted' },
  /* When the account was appointed, not when it was last used. The
     register is read to find out who exists and since when; the last
     sign-in is a fact about one account and sits on its sheet. */
  { key: 'createdOn', header: 'Created on', sortable: true, width: '130px' },
  { key: 'status', header: 'Status', width: '110px' },
  /* An account that is off says why. Last, and unwidthed, because a
     reason is a sentence. */
  { key: 'statusReason', header: 'Reason' },
  { key: 'actions', header: '', width: '120px', align: 'right' },
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
    TimelineComponent,
    ModalComponent,
    IconComponent,
    UppercaseDirective,
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
      <!-- Two registers behind one screen, and two permissions with them:
           appointing a coordinator is not the same authority as appointing
           an Admin, and a tier may hold one without the other. -->
      <button
        *appCan="isCoordinatorView() ? 'coordinators.manage' : 'users.manage'"
        type="button" class="btn btn--primary" (click)="openForm()"
      >
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
                @for (role of filterRoles(); track role.id) {
                  <option [value]="role.id">{{ role.name }}</option>
                }
              </select>
            </div>
          }
          <!-- Agency and State/UT only where they say something. A staff
               account belongs to no agency, so the column and both filters
               were a column of dashes and two pickers that matched
               everything. -->
          @if (isCoordinatorView()) {
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
          }
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
        [columns]="columns()"
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
        <ng-template appCell="userCode" let-row>
          <button type="button" class="cell-link tabular" (click)="details.set($any(row))">
            {{ $any(row).userCode }}
          </button>
        </ng-template>
        <ng-template appCell="createdOn" let-row>
          <span class="cell-muted">{{ $any(row).createdOn | date: 'dd MMM yyyy' }}</span>
        </ng-template>
        <!-- Only where there is one. An account nobody has switched either
             way has no event and no reason, and a dash in every row of a
             register where most accounts are fine is noise. -->
        <ng-template appCell="statusReason" let-row>
          @if ($any(row).statusReason) {
            <div class="stack stack-xs">
              <span
                class="text-sm wrap-text"
                [class.text-danger]="$any(row).status !== 'Active'"
                [class.cell-muted]="$any(row).status === 'Active'"
              >{{ $any(row).statusReason }}</span>
              <span class="text-xs cell-muted">
                {{ $any(row).statusChangedOn | date: 'dd MMM yyyy' }}
                @if ($any(row).statusChangedBy) { · {{ $any(row).statusChangedBy }} }
              </span>
            </div>
          }
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
                <app-icon name="send" [size]="15" />
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
              title="History"
              (click)="openHistory($any(row))"
            >
              <app-icon name="clock" [size]="15" />
            </button>
            <app-status-toggle [status]="$any(row).status" (toggled)="setStatus($any(row), $event)" />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (details(); as row) {
      <app-modal
        [title]="row.fullName"
        [subtitle]="row.userCode + ' · ' + row.roleName"
        size="md"
        (closed)="details.set(null)"
      >
        <!-- Read in the order somebody needs it: how to reach them, who
             they are on the record, where they sit, and how the account
             itself stands. A single ten-value grid made all ten look
             equally important, which left the eye to do the sorting. -->
        <div class="stack stack-md">
          <div class="sheet-id">
            <div class="sheet-id__who">
              <span class="avatar avatar--lg">{{ initialsOf(row.fullName) }}</span>
              <div class="stack stack-xs">
                <strong>{{ row.roleName }}</strong>
                <span class="text-xs text-muted">
                  Signing in as <code>{{ row.userCode }}</code>
                </span>
              </div>
            </div>
            <app-status-badge [value]="row.status" />
          </div>

          <div>
            <h4 class="section-title">Contact</h4>
            <div class="dl">
              <div>
                <div class="dl__term">Email</div>
                <div class="dl__value">
                  <a [href]="'mailto:' + row.email">{{ row.email }}</a>
                </div>
              </div>
              <div>
                <div class="dl__term">Mobile</div>
                <div class="dl__value">
                  @if (row.mobile) {
                    <a [href]="'tel:' + row.mobile">{{ row.mobile }}</a>
                  } @else {
                    —
                  }
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 class="section-title">On the record</h4>
            <div class="dl">
              <div>
                <div class="dl__term">Designation</div>
                <div class="dl__value">{{ row.designation || '—' }}</div>
              </div>
              <div>
                <div class="dl__term">Organization</div>
                <div class="dl__value">{{ row.organisationName || row.agencyName || '—' }}</div>
              </div>
              <div>
                <div class="dl__term">PAN</div>
                <div class="dl__value tabular">{{ row.pan || '—' }}</div>
              </div>
              <div>
                <div class="dl__term">Aadhaar</div>
                <div class="dl__value tabular">
                  {{ row.aadhaarLast4 ? masked(row.aadhaarLast4) : '—' }}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 class="section-title">Posting</h4>
            <div class="dl">
              <div>
                <div class="dl__term">Location</div>
                <div class="dl__value">
                  {{ row.city || '—' }}@if (row.state) {, {{ row.state }}}@if (row.district) {
                    ({{ row.district }})
                  }@if (row.pincode) { — {{ row.pincode }} }
                </div>
              </div>
              <div>
                <div class="dl__term">Agency</div>
                <div class="dl__value">{{ row.agencyName || '—' }}</div>
              </div>
              <div>
                <div class="dl__term">Reports to</div>
                <div class="dl__value">{{ row.reportsToName || '—' }}</div>
              </div>
            </div>
          </div>

          <!-- What the account can actually reach. The register used to
               carry two chips counting these, which told nobody which
               ones; the counting column was dropped on the grounds that
               this sheet showed them in full, and then it did not. -->
          <div>
            <h4 class="section-title">Allocated scope</h4>
            <div class="stack stack-sm">
              <div class="fact">
                <span class="fact__term">Categories</span>
                <span class="fact__value">{{ named(row.categoryIds, categories()) }}</span>
              </div>
              <div class="fact">
                <span class="fact__term">Sub-categories</span>
                <span class="fact__value">
                  {{ named(row.subCategoryIds, allSubCategories()) }}
                </span>
              </div>
              <div class="fact">
                <span class="fact__term">Program types</span>
                <span class="fact__value">
                  {{ named(row.programTypeIds, allProgramTypes()) }}
                </span>
              </div>
              <div class="fact">
                <span class="fact__term">States/UTs</span>
                <span class="fact__value">{{ named(row.stateCodes, scopeStates()) }}</span>
              </div>
              @if (row.districtCodes.length) {
                <div class="fact">
                  <span class="fact__term">Districts</span>
                  <span class="fact__value">{{ named(row.districtCodes, allDistricts()) }}</span>
                </div>
              }
            </div>
          </div>

          <div>
            <h4 class="section-title">The account itself</h4>
            <div class="dl">
              <div>
                <div class="dl__term">Created on</div>
                <div class="dl__value">
                  {{ row.createdOn | date: 'dd MMM yyyy, HH:mm' }}
                  @if (row.createdBy) {
                    <span class="text-xs text-muted">by {{ row.createdBy }}</span>
                  }
                </div>
              </div>
              <div>
                <div class="dl__term">Last signed in</div>
                <div class="dl__value">
                  {{
                    row.lastLoginOn
                      ? (row.lastLoginOn | date: 'dd MMM yyyy, HH:mm')
                      : 'Never signed in'
                  }}
                </div>
              </div>
              @if (row.statusReason) {
                <div>
                  <div class="dl__term">
                    {{ row.status === 'Active' ? 'Switched back on' : 'Switched off' }}
                  </div>
                  <div class="dl__value" [class.text-danger]="row.status !== 'Active'">
                    {{ row.statusReason }}
                    <span class="text-xs text-muted">
                      {{ row.statusChangedOn | date: 'dd MMM yyyy' }}
                      @if (row.statusChangedBy) { · {{ row.statusChangedBy }} }
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="details.set(null)">Close</button>
        </div>
      </app-modal>
    }

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
              <label class="field-label" for="uDesignation">
                Designation @if (needsFullRecord()) { <span class="req">*</span> }
              </label>
              <input id="uDesignation" class="input" formControlName="designation"
                [class.is-invalid]="invalid('designation')" />
              @if (invalid('designation')) {
                <span class="field-error">{{ errorFor('designation', 'Designation') }}</span>
              }
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
              <label class="field-label" for="uState">
                State/UT @if (needsFullRecord()) { <span class="req">*</span> }
              </label>
              <select id="uState" class="select" formControlName="stateCode" (change)="onStateChange()">
                <option [ngValue]="null">Select</option>
                @for (state of addressStates(); track state.id) {
                  <option [ngValue]="state.id">{{ state.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="uDistrict">
                District @if (needsFullRecord()) { <span class="req">*</span> }
              </label>
              <select id="uDistrict" class="select" formControlName="districtCode">
                <option [ngValue]="null">Select</option>
                @for (district of districts(); track district.id) {
                  <option [ngValue]="district.id">{{ district.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="uCity">
                City @if (needsFullRecord()) { <span class="req">*</span> }
              </label>
              <input id="uCity" class="input" formControlName="city"
                [class.is-invalid]="invalid('city')" />
              @if (invalid('city')) { <span class="field-error">{{ errorFor('city', 'City') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="uPin">
                Pincode @if (needsFullRecord()) { <span class="req">*</span> }
              </label>
              <input id="uPin" class="input" formControlName="pincode" maxlength="6" inputmode="numeric"
                [class.is-invalid]="invalid('pincode')" />
              @if (invalid('pincode')) { <span class="field-error">{{ errorFor('pincode', 'Pincode') }}</span> }
            </div>
            @if (needsFullRecord()) {
              <div class="field">
                <label class="field-label" for="uOrg">Organization name <span class="req">*</span></label>
                <input id="uOrg" class="input" formControlName="organisationName" maxlength="200"
                  placeholder="The body this account belongs to"
                  [class.is-invalid]="invalid('organisationName')" />
                @if (invalid('organisationName')) {
                  <span class="field-error">
                    {{ errorFor('organisationName', 'Organization name') }}
                  </span>
                }
              </div>
            }
            <div class="field">
              <label class="field-label" for="uPan">
                PAN (Organization's PAN) @if (needsFullRecord()) { <span class="req">*</span> }
              </label>
              <input id="uPan" class="input" formControlName="pan" maxlength="10"
                placeholder="ABCDE1234F" appUppercase
                [class.is-invalid]="invalid('pan')" />
              @if (invalid('pan')) { <span class="field-error">{{ errorFor('pan', 'PAN') }}</span> }
            </div>
            <div class="field">
              <label class="field-label" for="uAadhaar">Aadhaar</label>
              <input id="uAadhaar" class="input" formControlName="aadhaar" maxlength="12"
                inputmode="numeric" placeholder="12 digits"
                [class.is-invalid]="invalid('aadhaar')" />
              @if (invalid('aadhaar')) {
                <span class="field-error">{{ errorFor('aadhaar', 'Aadhaar') }}</span>
              }
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
                emptyMessage="Nothing has been allocated to you to pass on."
              />
              <!-- Shown, not chosen. Granting the category separately would
                   leave two answers to what this account covers; the program
                   types are the answer and the rest is read off them. -->
              @if (impliedScope().categories.length) {
                <div class="field">
                  <span class="field-label">This covers</span>
                  <div class="row row-sm row-wrap">
                    @for (name of impliedScope().categories; track name) {
                      <span class="chip">{{ name }}</span>
                    }
                    @for (name of impliedScope().subCategories; track name) {
                      <span class="chip chip--muted">{{ name }}</span>
                    }
                  </div>
                </div>
              }
            }
            @if (axes().state) {
              <app-scope-picker
                label="States/UTs"
                [options]="scopeStates()"
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
      <app-modal
        [title]="record.fullName"
        [subtitle]="record.userCode + ' · ' + record.roleName"
        (closed)="history.set(null)"
      >
        <div class="stack stack-md">
          <!-- Where the account stands now, set off from what has happened
               to it: the header already says who this is, so the panel
               answers the two questions the register cannot. -->
          <div class="card">
            <div class="card__body card__body--tight">
              <div class="dl">
                <div>
                  <div class="dl__term">Status</div>
                  <div class="dl__value"><app-status-badge [value]="record.status" /></div>
                </div>
                <div>
                  <div class="dl__term">Last signed in</div>
                  <div class="dl__value">
                    {{
                      record.lastLoginOn
                        ? (record.lastLoginOn | date: 'dd MMM yyyy, HH:mm')
                        : 'Never signed in'
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- The whole life of the account rather than only the times
               it was switched on and off, and the same shape the applicant
               and agency histories use. -->
          <div>
            <h4 class="section-title">History</h4>
            <app-timeline
              [events]="record.timeline ?? []"
              emptyMessage="Nothing has happened to this account yet."
            />
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="history.set(null)">Close</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      /* Who this is and how the account stands, before the particulars. */
      .sheet-id {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--surface-muted);
      }

      .sheet-id__who {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
      }
    `,
  ],
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

  protected readonly columns = computed(() =>
    this.isCoordinatorView() ? COLUMNS : COLUMNS.filter((c) => c.key !== 'agencyName'),
  );

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly isCoordinatorView = computed(() => this.scope() === 'coordinators');

  /** What may be assigned when creating somebody: the tier below this one. */
  protected readonly roles = toSignal(this.roleService.all(), { initialValue: [] as AdminRole[] });

  /** What the register can hold, which reaches further down than that. */
  protected readonly visibleRoles = toSignal(this.roleService.visible(), {
    initialValue: [] as AdminRole[],
  });

  /* The role filter offers only what the list can hold. Coordinators and
     agency logins have registers of their own, and the Super Admin is not
     listed at all — so offering any of the three is a filter that can only
     ever return nothing. */
  protected readonly filterRoles = computed(() =>
    this.isCoordinatorView()
      ? this.visibleRoles().filter((r) => r.baseRole === 'Coordinator')
      : this.visibleRoles().filter(
          (r) => r.baseRole !== 'Coordinator'
            && r.baseRole !== 'AgencyAdmin'
            && r.baseRole !== 'SuperAdmin',
        ),
  );
  protected readonly agencies = toSignal(this.lookups.agencies(), { initialValue: [] as LookupItem[] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });

  /* The whole LGD master, for the postal address. Not narrowed:
     where somebody lives is a fact about them, not a slice of the
     estate, and the person appointed may well live outside it. */
  protected readonly addressStates = toSignal(this.lookups.addressStates(), {
    initialValue: [] as LookupItem[],
  });
  protected readonly districts = signal<LookupItem[]>([]);
  /* The scope pickers read what this account may hand down, not the whole
     master. An Admin holding one category used to be shown all of them and
     refused on Save; the boundary is the same either way, but now it is
     visible before anything is typed. */
  private readonly allocatable = toSignal(this.lookups.allocatableScope(), {
    initialValue: {
      categories: [], subCategories: [], programTypes: [], states: [], districts: [],
    } as AllocatableScope,
  });

  protected readonly categories = computed(() => this.allocatable().categories);
  /* Each picker narrows to what the axis above it allows, the way
     districts have always narrowed to the chosen states - but starting
     from this account's own allocation rather than from the whole
     master. */
  protected readonly allSubCategories = computed(() => this.allocatable().subCategories);
  protected readonly allProgramTypes = computed(() => this.allocatable().programTypes);
  protected readonly allDistricts = computed(() => this.allocatable().districts);

  /** Allocatable states, for the scope picker. */
  protected readonly scopeStates = computed(() => this.allocatable().states);
  protected readonly managers = toSignal(this.lookups.operationManagers(), {
    initialValue: [] as LookupItem[],
  });

  /**
   * Ids as the names somebody recognises.
   *
   * The account carries ids; the pickers that set them carry the names,
   * and they are already loaded for the form. An id with no match is
   * dropped rather than printed raw — it means the master moved under
   * the account, which is a gap to notice, not a number to show.
   */
  protected named(ids: readonly number[] | null | undefined, from: LookupItem[]): string {
    if (!ids?.length) return 'All';
    const names = ids
      .map((id) => from.find((item) => item.id === id)?.name)
      .filter((name): name is string => !!name);
    return names.length > 0 ? names.join(', ') : '—';
  }

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

  /* Newest first. The register is read to see who has lately been given an
     account far more often than to look somebody up by name, and the Name
     column still sorts both ways for when it is the other way round. */
  protected readonly list = new ListState<PortalUser>((request) => this.service.list(request), {
    sortBy: 'createdOn',
    sortDir: 'desc',
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
  /**
   * Which allocation axes the chosen role is given, as the server sends
   * them with the role.
   *
   * This used to be a switch over the base role, written out again here -
   * a second copy of RoleHierarchy.Axes kept in step by hand. The two
   * drifted: an Operation Manager kept categories and sub-categories on
   * both sides long after the role had stopped being allocated on them,
   * and nothing could have caught it, because nothing ever compared them.
   * There is one definition now and this reads it.
   */
  protected readonly axes = computed<ScopeAxes>(() => {
    const roleId = this.roleIdSignal();
    return (
      this.roles().find((r) => r.id === roleId)?.axes ?? {
        category: false,
        subCategory: false,
        programType: false,
        state: false,
        district: false,
        none: true,
      }
    );
  });

  /* Read off the server's own answer rather than by counting truthy
     fields on the object: that counted `none` itself, so the one tier
     the message exists for was the one that would not have seen it. */
  protected readonly anyAxis = computed(() => !this.axes().none);

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
  /*
   * Program types offered, cascaded only where sub-categories are themselves
   * being allocated.
   *
   * An Operation Manager is allocated on program types and states; the
   * category it works in is read off the types rather than granted
   * separately. So its form has no sub-category picker — and this list, which
   * filtered by the chosen sub-categories, could only ever come back empty.
   * The picker said "0 of 0, select at least one sub-category first" about a
   * control that was not on the screen, and no Operation Manager could be
   * created at all.
   *
   * Everything here is already narrowed to what the creator holds, so an
   * Admin offers exactly the program types the Super Admin gave it.
   */
  protected readonly programTypeOptions = computed(() => {
    if (!this.axes().subCategory) return this.allProgramTypes();
    const chosen = this.subCategoryIds();
    return this.allProgramTypes().filter((p) => chosen.includes(Number(p.parentId)));
  });

  /* The category and sub-category each chosen program type belongs to. Shown
     rather than chosen: granting them separately would leave two answers to
     the question of what this account covers, and the program types are the
     answer. */
  protected readonly impliedScope = computed(() => {
    const chosen = this.programTypeIds().map(Number);
    const subs = new Map(this.allSubCategories().map((s) => [Number(s.id), s]));
    const cats = new Map(this.allocatable().categories.map((c) => [Number(c.id), c.name]));

    const subNames = new Set<string>();
    const catNames = new Set<string>();
    for (const type of this.allProgramTypes().filter((p) => chosen.includes(Number(p.id)))) {
      const sub = subs.get(Number(type.parentId));
      if (!sub) continue;
      subNames.add(sub.name);
      const cat = cats.get(Number(sub.parentId));
      if (cat) catNames.add(cat);
    }
    return { categories: [...catNames], subCategories: [...subNames] };
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
    pincode: ['', formatValidator('pincode')],
    /* Optional, and checked where given. */
    pan: ['', formatValidator('pan')],
    /* Never required of anybody. */
    aadhaar: ['', formatValidator('aadhaar')],
    organisationName: [''],
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
          'excludeBaseRoles', coordinatorsOnly ? null : 'Coordinator,AgencyAdmin,SuperAdmin');
      });
    });
  }

  /** Districts follow the LGD state that was picked. */
  protected onStateChange(): void {
    const stateCode = this.form.value.stateCode ?? null;
    this.form.patchValue({ districtCode: null }, { emitEvent: false });
    this.lookups.addressDistricts(stateCode).subscribe((items) => this.districts.set(items));
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
      pincode: row?.pincode ?? '',
      pan: row?.pan ?? '',
      /* Filled below from its own call: the register does not carry it. */
      aadhaar: '',
      organisationName: row?.organisationName ?? '',
      status: row?.status ?? 'Active',
    });
    this.lookups.addressDistricts(row?.stateCode ?? null).subscribe((items) => this.districts.set(items));

    /* Fetched here rather than carried on the row, so the number reaches
       only the account that may edit this one. A reader without that key
       gets nothing back and the field opens empty. */
    if (row?.hasAadhaar && row.id) {
      this.service.aadhaar(row.id).subscribe({
        next: (full) => this.form.controls.aadhaar.setValue(full ?? ''),
        error: () => this.form.controls.aadhaar.setValue(''),
      });
    }

    /* The dialog may open on a role already chosen -- editing, or the
       coordinator screen, which picks the only role there is. */
    this.applyRecordRules();
    this.formOpen.set(true);
  }

  /**
   * The allocation axes follow the tier, so a change of role clears selections
   * that no longer apply — leaving them behind would submit an allocation the
   * form is no longer showing.
   */
  /**
   * Whether this account is opened with the whole record.
   *
   * An Admin, a Ministry account or an Operation Manager is a named person
   * at a named body: the scheme is administered from that record, and half
   * of it filled in is a record nobody can act on later. A coordinator is
   * lighter on purpose -- the agency that appoints them already carries the
   * organisation and its PAN. Aadhaar is asked of nobody.
   */
  protected readonly needsFullRecord = computed(() => {
    const tier = this.chosenBaseRole();
    return tier === 'Admin' || tier === 'Ministry' || tier === 'OperationManager';
  });

  /**
   * Holds the form to that, as the role is chosen.
   *
   * The rules cannot sit on the controls: the same form opens for a
   * coordinator, where asking for an organisation's PAN would be asking the
   * agency to repeat itself.
   */
  private applyRecordRules(): void {
    const full = this.needsFullRecord();
    const c = this.form.controls;

    const plain: [typeof c.designation, ValidatorFn[]][] = [
      [c.designation, [Validators.required]],
      [c.city, [Validators.required]],
      [c.organisationName, [Validators.required]],
    ];
    for (const [control, rules] of plain) {
      control.setValidators(full ? rules : []);
      control.updateValueAndValidity({ emitEvent: false });
    }

    c.stateCode.setValidators(full ? [Validators.required] : []);
    c.stateCode.updateValueAndValidity({ emitEvent: false });
    c.districtCode.setValidators(full ? [Validators.required] : []);
    c.districtCode.updateValueAndValidity({ emitEvent: false });

    c.pincode.setValidators(full ? requiredFormat('pincode') : [formatValidator('pincode')]);
    c.pincode.updateValueAndValidity({ emitEvent: false });
    c.pan.setValidators(full ? requiredFormat('pan') : [formatValidator('pan')]);
    c.pan.updateValueAndValidity({ emitEvent: false });
  }

  protected onRoleChanged(): void {
    this.roleIdSignal.set(this.form.controls.roleId.value ?? null);
    this.applyRecordRules();
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

  /**
   * The last four digits of an Aadhaar, the way everything else prints it.
   *
   * Enough to tell two records apart, which is all the sheet is read for.
   * The whole number is in the form for whoever may edit the account.
   */
  /** The avatar's letters, the same two the topbar shows. */
  protected initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  /**
   * The last four, as the server sends them.
   *
   * The server masks it now. This used to take the whole number and hide
   * the front of it, which hid it from the page and not from the response
   * the page was drawn from.
   */
  protected masked(last4: string): string {
    return `XXXX XXXX ${last4}`;
  }

  /** The account whose details are on screen, or null. */
  protected readonly details = signal<PortalUser | null>(null);

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
