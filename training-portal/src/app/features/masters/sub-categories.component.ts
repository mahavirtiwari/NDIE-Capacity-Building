import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LookupItem,
  RecordStatus,
  SubCategory,
} from '../../core/models';
import { LookupService, SubCategoryService } from '../../core/services/masters.service';
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
import {
  UppercaseDirective,
  describeError,
  formatValidator,
} from '../../core/validation/formats';
import { abbreviate, composeCode } from '../../core/validation/code-suggest';
import { ListState, searchTerm } from '../../shared/list-state';

/* The name leads, because that is what people scan for; the code follows the
   category it is derived from, where it reads as a reference rather than an
   identifier to memorise. */
const COLUMNS: ColumnDef[] = [
  { key: 'name', header: 'Sub-category', sortable: true, variant: 'primary' },
  { key: 'categoryName', header: 'Category', sortable: true },
  { key: 'code', header: 'Code', sortable: true, width: '140px' },
  { key: 'description', header: 'Description', variant: 'muted' },
  { key: 'displayOrder', header: 'Order', align: 'center', width: '90px' },
  { key: 'status', header: 'Status', width: '120px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-sub-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    UppercaseDirective,
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
      [title]="copy.text('page.subCategories.title')"
      [subtitle]="copy.text('page.subCategories.subtitle')"
      icon="tag"
      [breadcrumbs]="[{ label: 'Program setup' }, { label: copy.text('page.subCategories.title') }]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New sub-category
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Search sub-categories" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="catFilter">Category</label>
            <select id="catFilter" class="select" (change)="list.setFilter('categoryId', value($event))">
              <option value="">All categories</option>
              @for (item of categories(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="statusFilter">Status</label>
            <select id="statusFilter" class="select" (change)="list.setFilter('status', value($event))">
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          @if (list.hasFilters) {
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          }
        </div>
      </div>

      <app-data-table
        exportName="Sub-categories"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No sub-categories"
        emptyIcon="tag"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
              <app-icon name="edit" [size]="15" />
            </button>
            <app-status-toggle
              [status]="$any(row).status"
              (toggled)="setStatus($any(row), $event)"
            />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal [title]="editing() ? 'Edit sub-category' : 'New sub-category'" (closed)="closeForm()">
        <form [formGroup]="form" class="form-grid" id="sub-form" (ngSubmit)="save()">
          <div class="field field--span-2">
            <label class="field-label" for="categoryId">Category <span class="req">*</span></label>
            <select id="categoryId" class="select" formControlName="categoryId" [class.is-invalid]="invalid('categoryId')">
              <option [ngValue]="null">Select a category</option>
              @for (item of categories(); track item.id) {
                <option [ngValue]="item.id">{{ item.name }}</option>
              }
            </select>
            @if (invalid('categoryId')) { <span class="field-error">Select the parent category.</span> }
          </div>
          <div class="field field--span-2">
            <label class="field-label" for="subName">Name <span class="req">*</span></label>
            <input id="subName" class="input" formControlName="name" [class.is-invalid]="invalid('name')" />
          </div>
          <div class="field">
            <label class="field-label" for="subCode">Code</label>
            <input id="subCode" class="input" formControlName="code" appUppercase maxlength="20"
              [placeholder]="suggestedCode()" [class.is-invalid]="invalid('code')" />
            @if (invalid('code')) {
              <span class="field-error">{{ errorFor('code', 'Code') }}</span>
            } @else {
              <span class="field-hint">Leave blank and we'll generate it.</span>
            }
          </div>
          <div class="field">
            <label class="field-label" for="subOrder">Display order</label>
            <input id="subOrder" type="number" class="input" formControlName="displayOrder" />
          </div>
          <div class="field field--span-2">
            <label class="field-label" for="subDesc">Description</label>
            <textarea id="subDesc" class="textarea" formControlName="description"></textarea>
          </div>
          <div class="field">
            <label class="field-label" for="subStatus">Status</label>
            <select id="subStatus" class="select" formControlName="status">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <!-- --------------------------------------------------- the forms --
               What an applicant under this discipline has to fill in. It sits
               here rather than on the program type because the questions are
               about the person, not about one course they might take. -->
          <div class="field field--span-2">
            <span class="field-label">Forms</span>
            <div class="row row-md">
              <label class="check">
                <input type="checkbox" formControlName="requiresSignupForm" />
                <span>Sign-up form required</span>
              </label>
              <label class="check">
                <input type="checkbox" formControlName="requiresProfileForm" />
                <span>Profile form required</span>
              </label>
            </div>
            <span class="field-hint">
              @if (form.controls.requiresProfileForm.value) {
                An applicant completes the profile form and it is read on the scrutiny queue
                before any program under this sub-category opens to them.
              } @else {
                No profile form, so nothing to scrutinise: the programs under this
                sub-category are open as soon as somebody registers.
              }
            </span>
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="sub-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Create sub-category' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class SubCategoriesComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(SubCategoryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] as LookupItem[] });
  protected readonly list = new ListState<SubCategory>((request) => this.service.list(request), {
    sortBy: 'categoryName',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<SubCategory | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    /* Optional: blank means the server derives it from the name. */
    code: ['', formatValidator('code')],
    name: ['', Validators.required],
    description: [''],
    displayOrder: [1],
    status: ['Active' as SubCategory['status']],
    requiresSignupForm: [true],
    requiresProfileForm: [true],
  });

  /** Live preview of the code the server will derive, shown as placeholder text. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly suggestedCode = computed(() => {
    const draft = this.formValue();
    if (!draft?.name?.trim()) return 'ZED-BRO';
    const parent = this.categories().find((item) => item.id === draft.categoryId);
    return composeCode(parent?.code, abbreviate(draft.name));
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

  protected openForm(row?: SubCategory): void {
    this.editing.set(row ?? null);
    this.form.reset({
      categoryId: row?.categoryId ?? null,
      code: row?.code ?? '',
      name: row?.name ?? '',
      description: row?.description ?? '',
      displayOrder: row?.displayOrder ?? 1,
      status: row?.status ?? 'Active',
      requiresSignupForm: row?.requiresSignupForm ?? true,
      requiresProfileForm: row?.requiresProfileForm ?? true,
    });
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
    const payload = this.form.getRawValue();
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Sub-category updated' : 'Sub-category created', payload.name);
        this.lookups.invalidate('sub-categories');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: { id: number; status: string; name?: string }, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} sub-category?`,
      message:
        status === 'Active'
          ? 'The record becomes available again for new transactions.'
          : 'The record stays in history but can no longer be selected for new transactions.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Sub-category ${status === 'Active' ? 'enabled' : 'disabled'}`, row.name);
      this.lookups.invalidate();
      this.list.reload();
    });
  }
}
