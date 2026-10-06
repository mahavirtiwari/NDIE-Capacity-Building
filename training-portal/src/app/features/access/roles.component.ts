import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ALL_PERMISSIONS,
  AdminRole,
  AppRole,
  PERMISSION_CATALOGUE,
  Permission,
  ROLE_LABELS,
  RecordStatus,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { RoleService } from '../../core/services/people.service';
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
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'name', header: 'Role', sortable: true, variant: 'primary' },
  { key: 'code', header: 'Code', width: '190px', variant: 'muted' },
  { key: 'baseRole', header: 'Base role', width: '170px' },
  { key: 'description', header: 'Description', variant: 'muted' },
  { key: 'permissionCount', header: 'Permissions', align: 'center', width: '120px' },
  { key: 'userCount', header: 'Users', align: 'center', width: '90px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

/**
 * The tiers a role can be attached to, in chain order.
 *
 * Ministry and Implementing Agency were added to the hierarchy after this list
 * was first written and never reached it, so neither could be chosen here or
 * filtered for — even though both have had seeded roles all along.
 *
 * Applicant is deliberately absent: applicants are not portal users and have
 * no role record.
 */
const BASE_ROLES = [
  'SuperAdmin',
  'Ministry',
  'Admin',
  'OperationManager',
  'AgencyAdmin',
  'Coordinator',
] as const satisfies readonly AppRole[];

/**
 * Which tiers each tier may write a role for, mirroring RoleHierarchy on
 * the server.
 *
 * Every tier settles the tier it appoints and no other, so a Super Admin
 * reaches Admin and the Ministry and stops there. The server has always
 * enforced this — it answers 403 with "A Super Admin does not settle what
 * a Coordinator may do" — but the form went on offering all six, so four
 * of the six choices were errors waiting to be pressed.
 */
const CREATES: Record<string, readonly AppRole[]> = {
  SuperAdmin: ['Admin', 'Ministry'],
  Admin: ['OperationManager'],
  /* An Operation Manager empanels agencies; the agency login comes with
     the agency rather than being written here. */
  OperationManager: ['AgencyAdmin'],
  AgencyAdmin: ['Coordinator'],
  Ministry: [],
  Coordinator: [],
};

/** The reader-facing name for a tier; the stored value stays the enum name. */
const labelFor = (base: string): string => ROLE_LABELS[base as AppRole] ?? base;

@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    StatusToggleComponent,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.roles.title')"
      [subtitle]="copy.text('page.roles.subtitle')"
      icon="shield"
      [breadcrumbs]="[{ label: 'Administration' }, { label: copy.text('page.roles.title') }]"
    >
      <button *appCan="'roles.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New role
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Search roles" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="roleBase">Base role</label>
            <select id="roleBase" class="select"
              [value]="list.stagedValue('baseRole')"
              (change)="list.stageFilter('baseRole', value($event))"
            >
              <option value="">All</option>
              @for (base of baseRoles(); track base) {
                <option [value]="base">{{ label(base) }}</option>
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
        exportName="Roles"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No roles defined"
        emptyIcon="shield"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="name" let-row>
          <div class="stack stack-xs">
            <strong>{{ $any(row).name }}</strong>
            @if ($any(row).isDefault) {
              <span class="chip">Default for its tier</span>
            } @else if ($any(row).isSystemRole) {
              <span class="chip">System role</span>
            }
          </div>
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <!-- Withheld rather than offered and refused. A default belongs
                 to no one and is shared by everyone who appoints at that
                 tier; a role somebody else shaped is theirs. -->
            @if ($any(row).canEdit) {
              <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
                <app-icon name="edit" [size]="15" />
              </button>
            } @else {
              <button type="button" class="btn btn--icon" title="Copy into a role of your own"
                (click)="copyFrom($any(row))">
                <app-icon name="plus" [size]="15" />
              </button>
            }
            <app-status-toggle
              [status]="$any(row).status"
              [disabled]="$any(row).isSystemRole || !$any(row).canEdit"
              (toggled)="setStatus($any(row), $event)"
            />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit role' : 'New role'"
        [subtitle]="selectedCount() + ' of ' + totalPermissions + ' permissions granted'"
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="role-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="roleName">Role name <span class="req">*</span></label>
              <input id="roleName" class="input" formControlName="name" />
            </div>
            <div class="field">
              <label class="field-label" for="roleCode">Code <span class="req">*</span></label>
              <input id="roleCode" class="input" formControlName="code" placeholder="SCRUTINY_OFFICER" />
            </div>
            <div class="field">
              <label class="field-label" for="roleBaseSel">Base role <span class="req">*</span></label>
              <select id="roleBaseSel" class="select" formControlName="baseRole"
                (change)="onBaseRoleChange($event)">
                @for (base of baseRoles(); track base) {
                  <option [value]="base">{{ label(base) }}</option>
                }
              </select>
              <span class="field-hint">
                @if (isSystemRole()) {
                  Fixed for a system role — only the description and permissions can change.
                } @else {
                  Decides the default landing screens and data scope.
                }
              </span>
            </div>
            <div class="field">
              <label class="field-label" for="roleStatus">Status</label>
              <select id="roleStatus" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="roleDesc">Description</label>
              <textarea id="roleDesc" class="textarea" formControlName="description"></textarea>
            </div>
          </div>

          <div class="divider"></div>

          <div class="row row-between">
            <strong class="text-md">Permissions</strong>
            <div class="btn-row">
              <button type="button" class="btn btn--sm btn--secondary" (click)="selectAll(true)">Select all</button>
              <button type="button" class="btn btn--sm btn--secondary" (click)="selectAll(false)">Clear all</button>
            </div>
          </div>

          @for (group of catalogue(); track group.group) {
            <fieldset class="perm-group">
              <div class="perm-group__head">
                <strong class="text-sm">{{ group.group }}</strong>
                <label class="check">
                  <input
                    type="checkbox"
                    [checked]="isGroupFull(group.group)"
                    (change)="toggleGroup(group.group, $event)"
                  />
                  <span class="text-xs">All</span>
                </label>
              </div>
              <div class="check-grid">
                @for (permission of group.permissions; track permission.key) {
                  <label class="check">
                    <input
                      type="checkbox"
                      [checked]="has(permission.key)"
                      (change)="toggle(permission.key, $event)"
                    />
                    <span>{{ permission.label }}</span>
                  </label>
                }
              </div>
            </fieldset>
          }
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="role-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save role
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .perm-group {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem 0.85rem;
        margin: 0;
        background: var(--surface-muted);
      }
      .perm-group__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }
    `,
  ],
})
export class RolesComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  /** The tiers this account may write a role for. */
  protected readonly baseRoles = computed<readonly AppRole[]>(
    () => CREATES[this.auth.role() ?? ''] ?? [],
  );

  /** Every tier, for reading back a role that already exists. */
  protected readonly allBaseRoles = BASE_ROLES;
  protected readonly label = labelFor;

  /** A seeded role: its name, code, tier and status are not ours to move. */
  protected readonly isSystemRole = computed(() => this.editing()?.isSystemRole ?? false);
  /** Which keys the server will accept on the role being shaped. */
  private readonly grantable = signal<string[] | null>(null);

  /**
   * The catalogue as this account may actually use it.
   *
   * The labels are ours and the authority is the server's: it says which
   * keys may go on this role, and the group headings and wording come from
   * here. Before the answer arrives nothing is offered, rather than
   * offering everything and taking some of it away a moment later.
   *
   * A group whose every key is withheld disappears rather than sitting
   * there empty.
   */
  protected readonly catalogue = computed(() => {
    const allowed = this.grantable();
    if (allowed === null) return [];
    const set = new Set(allowed);
    return PERMISSION_CATALOGUE
      .map((g) => ({ ...g, permissions: g.permissions.filter((p) => set.has(p.key)) }))
      .filter((g) => g.permissions.length > 0);
  });
  protected readonly totalPermissions = ALL_PERMISSIONS.length;

  protected readonly list = new ListState<AdminRole>((request) => this.service.list(request), {
    sortBy: 'name',
  });

  protected readonly rows = computed(() =>
    this.list.rows().map((row) => ({ ...row, permissionCount: row.permissions.length })),
  );

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<AdminRole | null>(null);
  protected readonly selected = signal<Permission[]>([]);
  protected readonly selectedCount = computed(() => this.selected().length);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    baseRole: ['Admin', Validators.required],
    description: [''],
    status: ['Active'],
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected has(permission: Permission): boolean {
    return this.selected().includes(permission);
  }

  protected toggle(permission: Permission, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selected.update((list) =>
      checked ? [...list, permission] : list.filter((p) => p !== permission),
    );
  }

  protected isGroupFull(group: string): boolean {
    const keys = this.catalogue().find((g) => g.group === group)?.permissions.map((p) => p.key) ?? [];
    return keys.length > 0 && keys.every((key) => this.selected().includes(key));
  }

  protected toggleGroup(group: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const keys = this.catalogue().find((g) => g.group === group)?.permissions.map((p) => p.key) ?? [];
    this.selected.update((list) =>
      checked
        ? [...new Set([...list, ...keys])]
        : list.filter((p) => !keys.includes(p)),
    );
  }

  protected selectAll(all: boolean): void {
    this.selected.set(all ? [...ALL_PERMISSIONS] : []);
  }

  /**
   * A new role of your own, starting from one you cannot change.
   *
   * The default for a tier is shared by everyone who appoints at it, so it
   * is nobody's to edit. Copying it is how a creator gets something of their
   * own to narrow — which is the whole point of the tier settling what the
   * tier beneath it may do.
   */
  protected copyFrom(row: AdminRole): void {
    this.editing.set(null);
    this.selected.set([...row.permissions]);
    this.form.reset({
      name: `${row.name} (mine)`,
      code: '',
      baseRole: row.baseRole,
      description: row.description ?? '',
      status: 'Active',
    });
    for (const control of ['name', 'code', 'baseRole', 'status'] as const) {
      this.form.controls[control].enable();
    }
    this.formOpen.set(true);
  }

  protected openForm(row?: AdminRole): void {
    this.editing.set(row ?? null);
    this.selected.set(row ? [...row.permissions] : []);
    this.form.reset({
      name: row?.name ?? '',
      code: row?.code ?? '',
      baseRole: row?.baseRole ?? 'Admin',
      description: row?.description ?? '',
      status: row?.status ?? 'Active',
    });

    /* The server keeps a system role's identity fixed and saves only its
       description and permissions. Leaving these enabled let someone change the
       base role of, say, Coordinator, press Save, and be told it worked while
       nothing moved. getRawValue still sends them, so the payload is unchanged. */
    const fixed = row?.isSystemRole ?? false;
    for (const control of ['name', 'code', 'baseRole', 'status'] as const) {
      if (fixed) this.form.controls[control].disable();
      else this.form.controls[control].enable();
    }

    this.loadGrantable(row?.baseRole ?? 'Admin', row?.id);
    this.formOpen.set(true);
  }

  /**
   * Asks what may go on a role of this tier, and drops any tick that the
   * answer no longer allows.
   *
   * Re-asked when the base role changes, because what an Operation Manager
   * may hold is not what an Admin may.
   */
  private loadGrantable(baseRole: string, roleId?: number): void {
    this.grantable.set(null);
    this.service.grantable(baseRole, roleId).subscribe((groups) => {
      const keys = groups.flatMap((g) => g.permissions);
      this.grantable.set(keys);
      const allowed = new Set(keys);
      this.selected.update((list) => list.filter((k) => allowed.has(k)));
    });
  }

  protected onBaseRoleChange(event: Event): void {
    const base = (event.target as HTMLSelectElement).value;
    this.loadGrantable(base, this.editing()?.id);
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
    if (!this.selected().length) {
      this.toast.warning('No permissions selected', 'A role needs at least one permission.');
      return;
    }
    this.saving.set(true);
    const payload = {
      ...this.form.getRawValue(),
      permissions: this.selected(),
      isSystemRole: this.editing()?.isSystemRole ?? false,
    };
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Role saved', `${this.selected().length} permissions granted.`);
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: AdminRole, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} role?`,
      message:
        status === 'Active'
          ? 'Users holding this role regain access.'
          : `${row.userCount ?? 0} user(s) hold this role and will lose access until it is enabled again.`,
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Role ${status === 'Active' ? 'enabled' : 'disabled'}`, row.name);
      this.list.reload();
    });
  }
}
