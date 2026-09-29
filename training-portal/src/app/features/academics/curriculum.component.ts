import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LookupItem,
  Curriculum,
  RecordStatus,
  curriculumSessionCount,
  curriculumTopicCount,
} from '../../core/models';
import { CurriculumService } from '../../core/services/academics.service';
import { LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'serial', header: 'S.No', width: '70px', align: 'center' },
  { key: 'programTypeCode', header: 'Code', sortable: true, width: '160px' },
  { key: 'programTypeName', header: 'Programme type', sortable: true, variant: 'primary' },
  { key: 'structure', header: 'Sessions / topics', width: '180px' },
  { key: 'actions', header: '', width: '200px', align: 'right' },
];

@Component({
  selector: 'app-curriculum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.curriculum.title')"
      [subtitle]="copy.text('page.curriculum.subtitle')"
      icon="book"
      [breadcrumbs]="[{ label: 'Programme setup' }, { label: copy.text('page.curriculum.title') }]"
    >
      <button *appCan="'curriculum.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New curriculum
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--inline">
          <div class="field">
            <label class="field-label" for="curCategoryFilter">Category</label>
            <select
              id="curCategoryFilter"
              class="select"
              [value]="filterCategoryId() ?? ''"
              (change)="onCategoryFilter($event)"
            >
              <option value="">All categories</option>
              @for (category of categories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="curSubCategoryFilter">Sub-category</label>
            <select
              id="curSubCategoryFilter"
              class="select"
              [value]="filterSubCategoryId() ?? ''"
              (change)="onSubCategoryFilter($event)"
            >
              <option value="">All sub-categories</option>
              @for (sub of filterSubCategories(); track sub.id) {
                <option [value]="sub.id">{{ sub.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="curProgType">Programme type</label>
            <select
              id="curProgType"
              class="select"
              [value]="filterProgramTypeId() ?? ''"
              (change)="onProgramTypeFilter($event)"
            >
              <option value="">All programme types</option>
              @for (type of filterProgramTypes(); track type.id) {
                <option [value]="type.id">{{ type.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="curName">Programme name</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input id="curName" class="input" placeholder="Search programme" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--ghost" (click)="reset()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <div class="tabs" style="padding: 0 1rem">
        <button type="button" class="tab" [class.is-active]="view() === 'Active'" (click)="setView('Active')">
          Active curriculum
        </button>
        <button type="button" class="tab" [class.is-active]="view() === 'Inactive'" (click)="setView('Inactive')">
          Blocked curriculum
        </button>
      </div>

      <app-data-table
        exportName="Curriculum"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        [emptyTitle]="view() === 'Active' ? 'No active curriculum' : 'No blocked curriculum'"
        emptyIcon="book"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="serial" let-row>
          <span class="cell-muted tabular">{{ $any(row).serial }}</span>
        </ng-template>
        <ng-template appCell="programTypeCode" let-row>
          <a class="cell-primary" [routerLink]="['/academics/curriculum', $any(row).id]">
            {{ $any(row).programTypeCode }}
          </a>
        </ng-template>
        <ng-template appCell="structure" let-row>
          <div class="row row-sm">
            <span class="chip">{{ sessionCount($any(row)) }} sessions</span>
            <span class="chip">{{ topicCount($any(row)) }} topics</span>
          </div>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <a class="btn btn--icon" title="Sessions" [routerLink]="['/academics/curriculum', $any(row).id]">
              <app-icon name="list" [size]="15" />
            </a>
            <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
              <app-icon name="edit" [size]="15" />
            </button>
            <button
              type="button"
              class="btn btn--sm"
              [class.btn--subtle-danger]="$any(row).status === 'Active'"
              [class.btn--secondary]="$any(row).status !== 'Active'"
              (click)="setStatus($any(row), $any(row).status === 'Active' ? 'Inactive' : 'Active')"
            >
              {{ $any(row).status === 'Active' ? 'Block' : 'Unblock' }}
            </button>
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit curriculum' : 'New curriculum'"
        subtitle="Sessions and topics are maintained from the programme detail screen."
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="curriculum-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid">
            <div class="field field--span-2">
              <label class="field-label" for="formProgType">
                Programme type <span class="req">*</span>
              </label>
              <select
                id="formProgType"
                class="select"
                formControlName="programTypeId"
                [class.is-invalid]="invalid('programTypeId')"
                (change)="onProgramTypeChange()"
              >
                <option [ngValue]="null">Select a programme type</option>
                @for (type of programTypes(); track type.id) {
                  <option [ngValue]="type.id">{{ type.code }} — {{ type.name }}</option>
                }
              </select>
              @if (invalid('programTypeId')) {
                <span class="field-error">Select the programme type.</span>
              } @else {
                <span class="field-hint">
                  The code and name come from Programme types; session codes are built from it.
                </span>
              }
            </div>
          </div>

          <!-- Shown, not editable: the linkage belongs to the programme type,
               so it is displayed here only to make the choice legible. -->
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="curCategory">Category</label>
              <input
                id="curCategory"
                class="input"
                [value]="linkedCategory()"
                disabled
                placeholder="Follows the programme type"
              />
            </div>
            <div class="field">
              <label class="field-label" for="curSubCategory">Sub-category</label>
              <input
                id="curSubCategory"
                class="input"
                [value]="linkedSubCategory()"
                disabled
                placeholder="Follows the programme type"
              />
            </div>
          </div>

          <div class="form-grid form-grid--3">
            <div class="field">
              <label class="field-label" for="formDays">Duration (days)</label>
              <input id="formDays" type="number" class="input" formControlName="durationDays" />
            </div>
            <div class="field">
              <label class="field-label" for="formFrom">Effective from</label>
              <input id="formFrom" type="date" class="input" formControlName="effectiveFrom" />
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="formObjective">Objective</label>
              <textarea id="formObjective" class="textarea" formControlName="objective"></textarea>
            </div>
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="curriculum-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Create curriculum' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class CurriculumComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(CurriculumService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly lookups = inject(LookupService);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  /* The Programme types master is the single source for this dropdown. */
  protected readonly programTypes = toSignal(this.lookups.programTypes(null), {
    initialValue: [] as LookupItem[],
  });

  /* The full masters, so the linkage can be resolved without another call:
     a programme type points at its sub-category, which points at its category. */
  protected readonly subCategories = toSignal(this.lookups.subCategories(null), {
    initialValue: [] as LookupItem[],
  });
  protected readonly categories = toSignal(this.lookups.categories(), {
    initialValue: [] as LookupItem[],
  });

  /** Follows the programme type control so the two read-only fields keep up. */
  private readonly chosenProgramTypeId = signal<number | null>(null);

  private readonly chosenSubCategory = computed(() => {
    const programType = this.programTypes().find((t) => t.id === this.chosenProgramTypeId());
    return this.subCategories().find((sc) => sc.id === programType?.parentId) ?? null;
  });

  protected readonly linkedSubCategory = computed(() => this.chosenSubCategory()?.name ?? '');

  /* --------------------------------------------------- list filters ----
     The three narrow each other, so a sub-category cannot be left selected
     under a category it does not belong to. Choosing a broader level clears
     the finer ones rather than leaving a contradictory pair behind. */
  protected readonly filterCategoryId = signal<number | null>(null);
  protected readonly filterSubCategoryId = signal<number | null>(null);
  protected readonly filterProgramTypeId = signal<number | null>(null);

  protected readonly filterSubCategories = computed(() => {
    const category = this.filterCategoryId();
    const all = this.subCategories();
    return category === null ? all : all.filter((sc) => sc.parentId === category);
  });

  protected readonly filterProgramTypes = computed(() => {
    const subCategory = this.filterSubCategoryId();
    const visible = this.filterSubCategories().map((sc) => sc.id);
    return this.programTypes().filter((pt) =>
      subCategory !== null ? pt.parentId === subCategory : visible.includes(pt.parentId as number),
    );
  });

  protected onCategoryFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterCategoryId.set(raw ? Number(raw) : null);
    this.filterSubCategoryId.set(null);
    this.filterProgramTypeId.set(null);
    this.list.setFilter('categoryId', raw || null);
    this.list.setFilter('subCategoryId', null);
    this.list.setFilter('programTypeId', null);
  }

  protected onSubCategoryFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterSubCategoryId.set(raw ? Number(raw) : null);
    this.filterProgramTypeId.set(null);
    this.list.setFilter('subCategoryId', raw || null);
    this.list.setFilter('programTypeId', null);
  }

  protected onProgramTypeFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterProgramTypeId.set(raw ? Number(raw) : null);
    this.list.setFilter('programTypeId', raw || null);
  }

  protected readonly linkedCategory = computed(() => {
    const parent = this.chosenSubCategory()?.parentId;
    return this.categories().find((c) => c.id === parent)?.name ?? '';
  });

  private programTypeName(id: number | null | undefined): string {
    return this.programTypes().find((t) => t.id === id)?.name ?? '';
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }
  protected readonly view = signal<RecordStatus>('Active');

  protected readonly list = new ListState<Curriculum>((request) => this.service.list(request), {
    sortBy: 'programTypeCode',
  });

  /** The register numbers rows within the current page, like the live screen. */
  protected readonly rows = computed(() =>
    this.list.rows().map((row, i) => ({
      ...row,
      serial: (this.list.page() - 1) * this.list.pageSize() + i + 1,
    })),
  );

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Curriculum | null>(null);

  protected readonly form = this.fb.group({
    /* The programme type is the curriculum's identity; code, name and category
       are read from that master rather than captured again here. */
    programTypeId: [null as number | null, Validators.required],
    durationDays: [5, Validators.min(1)],
    objective: [''],
    effectiveFrom: [new Date().toISOString().slice(0, 10)],
    status: ['Active'],
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;
  protected sessionCount = curriculumSessionCount;
  protected topicCount = curriculumTopicCount;

  constructor() {
    this.list.setFilter('status', 'Active');
  }

  protected setView(status: RecordStatus): void {
    this.view.set(status);
    this.list.setFilter('status', status);
  }

  protected reset(): void {
    this.filterCategoryId.set(null);
    this.filterSubCategoryId.set(null);
    this.filterProgramTypeId.set(null);
    this.list.clearFilters();
    this.list.setFilter('status', this.view());
  }

  protected openForm(row?: Curriculum): void {
    this.editing.set(row ?? null);
    this.form.reset({
      programTypeId: row?.programTypeId ?? null,
      durationDays: row?.durationDays ?? 5,
      objective: row?.objective ?? '',
      effectiveFrom: row?.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      status: row?.status ?? 'Active',
    });
    this.chosenProgramTypeId.set(row?.programTypeId ?? null);
    this.formOpen.set(true);
  }

  /** Keeps the read-only Category and Sub-category in step with the choice. */
  protected onProgramTypeChange(): void {
    this.chosenProgramTypeId.set(this.form.controls.programTypeId.value ?? null);
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
    const payload = { ...this.form.getRawValue(), sessions: this.editing()?.sessions ?? [] };
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(
          current ? 'Curriculum updated' : 'Curriculum created',
          this.programTypeName(payload.programTypeId),
        );
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: Curriculum, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Unblock' : 'Block';
    const confirmed = await this.confirm.ask({
      title: `${verb} curriculum?`,
      message:
        status === 'Active'
          ? 'The programme becomes available again for scheduling new batches.'
          : 'The programme moves to the blocked list. Running batches keep their syllabus.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Curriculum ${verb.toLowerCase()}ed`, row.programTypeName ?? '');
      this.list.reload();
    });
  }
}
