import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Category,
  RecordStatus,
} from '../../core/models';
import { CategoryService, LookupService } from '../../core/services/masters.service';
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
import { abbreviate } from '../../core/validation/code-suggest';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'code', header: 'Code', sortable: true, width: '130px' },
  { key: 'name', header: 'Category', sortable: true, variant: 'primary' },
  { key: 'description', header: 'Description', variant: 'muted' },
  { key: 'subCategoryCount', header: 'Sub-categories', align: 'center', width: '130px' },
  { key: 'displayOrder', header: 'Order', align: 'center', sortable: true, width: '90px' },
  { key: 'status', header: 'Status', width: '120px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-categories',
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
      [title]="copy.text('page.categories.title')"
      [subtitle]="copy.text('page.categories.subtitle')"
      icon="folder"
      [breadcrumbs]="[{ label: 'Program setup' }, { label: copy.text('page.categories.title') }]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New category
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                class="input"
                placeholder="Search by code, name or description"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="status">Status</label>
            <select id="status" class="select" (change)="list.setFilter('status', value($event))">
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
        exportName="Categories"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No categories yet"
        emptyMessage="Create the first category to start configuring programs."
        emptyIcon="folder"
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
      <app-modal
        [title]="editing() ? 'Edit category' : 'New category'"
        subtitle="Categories drive every downstream master."
        (closed)="closeForm()"
      >
        <form [formGroup]="form" class="form-grid" id="category-form" (ngSubmit)="save()">
          <div class="field field--span-2">
            <label class="field-label" for="name">Name <span class="req">*</span></label>
            <input id="name" class="input" formControlName="name" [class.is-invalid]="invalid('name')" />
            @if (invalid('name')) { <span class="field-error">Name is required.</span> }
          </div>
          <div class="field">
            <label class="field-label" for="code">Code</label>
            <input id="code" class="input" formControlName="code" appUppercase maxlength="20"
              [placeholder]="suggestedCode()" [class.is-invalid]="invalid('code')" />
            @if (invalid('code')) {
              <span class="field-error">{{ errorFor('code', 'Code') }}</span>
            } @else {
              <span class="field-hint">Leave blank and we'll generate it.</span>
            }
          </div>
          <div class="field">
            <label class="field-label" for="displayOrder">Display order</label>
            <input id="displayOrder" type="number" class="input" formControlName="displayOrder" />
          </div>
          <div class="field field--span-2">
            <label class="field-label" for="description">Description</label>
            <textarea id="description" class="textarea" formControlName="description"></textarea>
          </div>
          <div class="field">
            <label class="field-label" for="catStatus">Status</label>
            <select id="catStatus" class="select" formControlName="status">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="category-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Create category' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class CategoriesComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(CategoryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly list = new ListState<Category>((request) => this.service.list(request), {
    sortBy: 'displayOrder',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Category | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    /* Optional: blank means the server derives it from the name. */
    code: ['', formatValidator('code')],
    name: ['', Validators.required],
    description: [''],
    displayOrder: [1],
    status: ['Active' as Category['status']],
  });

  /** Live preview of the code the server will derive, shown as placeholder text. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly suggestedCode = computed(() =>
    this.formValue()?.name?.trim() ? abbreviate(this.formValue()!.name) : 'ZED',
  );

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected errorFor(control: string, label: string): string {
    return describeError(this.form.get(control)?.errors ?? null, label);
  }

  protected openForm(row?: Category): void {
    this.editing.set(row ?? null);
    this.form.reset({
      code: row?.code ?? '',
      name: row?.name ?? '',
      description: row?.description ?? '',
      displayOrder: row?.displayOrder ?? this.list.total() + 1,
      status: row?.status ?? 'Active',
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
        this.toast.success(current ? 'Category updated' : 'Category created', payload.name);
        this.lookups.invalidate('categories');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: { id: number; status: string; name?: string }, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} category?`,
      message:
        status === 'Active'
          ? 'The record becomes available again for new transactions.'
          : 'The record stays in history but can no longer be selected for new transactions.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Category ${status === 'Active' ? 'enabled' : 'disabled'}`, row.name);
      this.lookups.invalidate();
      this.list.reload();
    });
  }
}
