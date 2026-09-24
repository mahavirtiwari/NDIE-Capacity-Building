import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CERTIFICATE_KIND_LABELS,
  CERTIFICATION_POLICIES,
  CertificateKind,
  CertificateTemplate,
  DELIVERY_MODES,
  LookupItem,
  ProgramType,
  RecordStatus,
} from '../../core/models';
import { LookupService, ProgramTypeService } from '../../core/services/masters.service';
import { ToastService } from '../../core/services/toast.service';
import { CascadeSelectComponent } from '../../shared/components/cascade-select.component';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
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

const COLUMNS: ColumnDef[] = [
  { key: 'code', header: 'Code', sortable: true, width: '130px' },
  { key: 'name', header: 'Program type', sortable: true, variant: 'primary' },
  { key: 'categoryName', header: 'Category' },
  { key: 'subCategoryName', header: 'Sub-category' },
  { key: 'durationDays', header: 'Days', align: 'center', sortable: true, width: '80px' },
  { key: 'deliveryMode', header: 'Mode', width: '120px' },
  { key: 'config', header: 'Configured', width: '180px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '140px', align: 'right' },
];

@Component({
  selector: 'app-program-types',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UppercaseDirective,
    RouterLink,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    StatusToggleComponent,
    ModalComponent,
    CascadeSelectComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      title="Program types"
      subtitle="The applicant facing track — Master Trainer, Assessor, Consultant and others. Each type drives its own registration form, fee, curriculum and exam paper."
      icon="layers"
      [breadcrumbs]="[{ label: 'Programme setup' }, { label: 'Program types' }]"
    >
      <button type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New program type
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Search program types" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="ptCategory">Category</label>
            <select
              id="ptCategory"
              class="select"
              [value]="filterCategoryId() ?? ''"
              (change)="onCategoryFilter($event)"
            >
              <option value="">All categories</option>
              @for (item of categories(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="ptSubCategory">Sub-category</label>
            <select
              id="ptSubCategory"
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
            <label class="field-label" for="ptMode">Delivery mode</label>
            <select id="ptMode" class="select" (change)="list.setFilter('deliveryMode', value($event))">
              <option value="">All modes</option>
              @for (mode of modes; track mode) {
                <option [value]="mode">{{ mode }}</option>
              }
            </select>
          </div>
          @if (list.hasFilters) {
            <button type="button" class="btn btn--ghost" (click)="resetFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          }
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No program types"
        emptyIcon="layers"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="deliveryMode" let-row>
          <app-status-badge [value]="$any(row).deliveryMode" />
        </ng-template>
        <ng-template appCell="config" let-row>
          <div class="row row-sm">
            <span class="chip" [class.is-off]="!$any(row).isExamMandatory">Exam</span>
            <span class="chip" [class.is-off]="!$any(row).isFeeApplicable">Fee</span>
            <span class="chip">{{ $any(row).certificateValidityMonths }} m validity</span>
          </div>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <a
              class="btn btn--icon"
              title="Registration form"
              [routerLink]="['/academics/registration-forms']"
              [queryParams]="{ programTypeId: $any(row).id }"
            >
              <app-icon name="form" [size]="15" />
            </a>
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
        [title]="editing() ? 'Edit program type' : 'New program type'"
        subtitle="Eligibility and delivery settings applied to every batch of this track."
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="pt-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid">
            <app-cascade-select [group]="form" [showProgramType]="false" [required]="true" anyLabel="Select" />
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="ptName">Name <span class="req">*</span></label>
              <input id="ptName" class="input" formControlName="name" [class.is-invalid]="invalid('name')" />
            </div>
            <div class="field">
              <label class="field-label" for="ptCode">Code</label>
              <input id="ptCode" class="input" formControlName="code" appUppercase maxlength="20"
                [placeholder]="suggestedCode()" [class.is-invalid]="invalid('code')" />
              @if (invalid('code')) {
                <span class="field-error">{{ errorFor('code', 'Code') }}</span>
              } @else {
                <span class="field-hint">Leave blank and we'll generate it.</span>
              }
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="ptDesc">Short description</label>
              <textarea id="ptDesc" class="textarea" formControlName="shortDescription"></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="ptDays">Duration (days) <span class="req">*</span></label>
              <input id="ptDays" type="number" class="input" formControlName="durationDays" />
            </div>
            <div class="field">
              <label class="field-label" for="ptModeSel">Delivery mode</label>
              <select id="ptModeSel" class="select" formControlName="deliveryMode">
                @for (mode of modes; track mode) {
                  <option [value]="mode">{{ mode }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="ptQual">Minimum educational qualification</label>
              <select id="ptQual" class="select" formControlName="minQualification">
                @for (level of qualifications(); track level.code) {
                  <option [value]="level.code">{{ level.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="ptExp">Minimum experience (years)</label>
              <input id="ptExp" type="number" class="input" formControlName="minExperienceYears" />
            </div>
            <div class="field">
              <label class="field-label" for="ptValidity">Certificate validity (months)</label>
              <input id="ptValidity" type="number" class="input" formControlName="certificateValidityMonths" />
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="ptCert">What this programme awards</label>
              <select id="ptCert" class="select" formControlName="certificationPolicy">
                @for (option of certificationPolicies; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              <span class="field-hint">{{ policyHint() }}</span>
            </div>
            <div class="field">
              <label class="field-label" for="ptStatus">Status</label>
              <select id="ptStatus" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div class="field field--span-2">
              <span class="field-label">Options</span>
              <div class="row row-md row-wrap">
                <label class="check">
                  <input type="checkbox" formControlName="isExamMandatory" />
                  <span>Certification exam is mandatory</span>
                </label>
                <label class="check">
                  <input type="checkbox" formControlName="isFeeApplicable" />
                  <span>Fee is applicable</span>
                </label>
              </div>
            </div>

            <!-- Templates hang off a saved programme type, so they appear once
                 there is a record to attach them to. -->
            @if (editing(); as row) {
              <div class="field field--span-2">
                <span class="field-label">Certificate templates</span>

                @if (templateKinds().length === 0) {
                  <span class="field-hint">
                    This programme awards no certificate, so there is nothing to upload.
                  </span>
                } @else {
                  <span class="field-hint">
                    The artwork each certificate is produced from — {{ templateFormats }}.
                  </span>

                  <div class="stack stack-sm mt-sm">
                    @for (kind of templateKinds(); track kind) {
                      <div class="tpl-row">
                        <div class="tpl-row__text">
                          <strong class="text-sm">{{ kindLabel(kind) }}</strong>
                          @if (templateFor(kind); as tpl) {
                            <span class="text-xs text-muted">
                              {{ tpl.fileName }} · {{ sizeOf(tpl.sizeBytes) }}
                            </span>
                          } @else {
                            <span class="text-xs text-muted">Not uploaded yet</span>
                          }
                        </div>

                        <div class="btn-row btn-row--end">
                          @if (templateFor(kind); as tpl) {
                            <a
                              class="btn btn--ghost btn--sm"
                              [href]="templateUrl(row.id, kind)"
                              target="_blank"
                              rel="noopener"
                              >View</a
                            >
                            <button
                              type="button"
                              class="btn btn--ghost btn--sm"
                              [disabled]="uploading() === kind"
                              (click)="removeTemplate(row.id, kind)"
                            >
                              Remove
                            </button>
                          }
                          <label class="btn btn--secondary btn--sm">
                            @if (uploading() === kind) { <span class="spinner"></span> }
                            {{ templateFor(kind) ? 'Replace' : 'Upload' }}
                            <input
                              type="file"
                              hidden
                              [accept]="templateAccept"
                              (change)="uploadTemplate(row.id, kind, $event)"
                            />
                          </label>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="pt-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Create program type' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [`.chip.is-off { opacity: 0.4; text-decoration: line-through; }`],
})
export class ProgramTypesComponent {
  private readonly service = inject(ProgramTypeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;
  protected readonly modes = DELIVERY_MODES;
  /* Ordered lowest to highest, straight from the server's catalogue, so the
     dropdown and the validation behind it cannot drift apart. */
  protected readonly qualifications = toSignal(this.lookups.qualifications(), {
    initialValue: [] as LookupItem[],
  });

  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] as LookupItem[] });
  protected readonly list = new ListState<ProgramType>((request) => this.service.list(request), {
    sortBy: 'code',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<ProgramType | null>(null);

  /* ------------------------------------------- certificate templates */

  protected readonly certificationPolicies = CERTIFICATION_POLICIES;
  protected readonly templateFormats = 'PDF, PNG, JPEG, HTML or DOCX, up to 10 MB';
  protected readonly templateAccept =
    '.pdf,.png,.jpg,.jpeg,.html,.docx,application/pdf,image/png,image/jpeg,text/html,' +
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  /** Which kind is mid-upload, so only that row shows a spinner. */
  protected readonly uploading = signal<CertificateKind | null>(null);

  /** The wording under the policy select, so the choice explains itself. */
  protected readonly policyHint = computed(() => {
    const chosen = this.formValue().certificationPolicy;
    return CERTIFICATION_POLICIES.find((p) => p.value === chosen)?.hint ?? '';
  });

  /* Read from the saved record rather than the form: the server decides which
     templates a policy allows, and it has not seen an unsaved change yet. */
  protected readonly templateKinds = computed<CertificateKind[]>(
    () => this.editing()?.certificateKinds ?? [],
  );

  protected kindLabel(kind: CertificateKind): string {
    return CERTIFICATE_KIND_LABELS[kind];
  }

  protected templateFor(kind: CertificateKind): CertificateTemplate | undefined {
    return this.editing()?.certificateTemplates?.find((t) => t.kind === kind);
  }

  protected templateUrl(id: number, kind: CertificateKind): string {
    return this.service.templateUrl(id, kind);
  }

  protected sizeOf(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected uploadTemplate(id: number, kind: CertificateKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    /* Cleared straight away so picking the same file twice still fires. */
    input.value = '';
    if (!file) return;

    this.uploading.set(kind);
    this.service.uploadTemplate(id, kind, file).subscribe({
      next: (updated) => {
        this.uploading.set(null);
        this.editing.set(updated);
        this.list.reload();
        this.toast.success('Template uploaded', `${this.kindLabel(kind)} saved.`);
      },
      error: () => this.uploading.set(null),
    });
  }

  protected async removeTemplate(id: number, kind: CertificateKind): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Remove this template?',
      message: `The ${this.kindLabel(kind).toLowerCase()} artwork will be deleted.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;

    this.service.removeTemplate(id, kind).subscribe((updated) => {
      this.editing.set(updated);
      this.list.reload();
      this.toast.success('Template removed', `${this.kindLabel(kind)} deleted.`);
    });
  }

  protected readonly form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    subCategoryId: [null as number | null, Validators.required],
    /* Optional: blank means the server derives it from the name. */
    code: ['', formatValidator('code')],
    name: ['', Validators.required],
    shortDescription: [''],
    durationDays: [5, [Validators.required, Validators.min(1)]],
    deliveryMode: ['Physical' as ProgramType['deliveryMode']],
    minQualification: ['NONE'],
    minExperienceYears: [0],
    certificateValidityMonths: [36],
    certificationPolicy: ['QualificationOnly' as ProgramType['certificationPolicy']],
    isExamMandatory: [true],
    isFeeApplicable: [true],
    status: ['Active' as ProgramType['status']],
  });

  /** Live preview of the code the server will derive, shown as placeholder text. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly allSubCategories = toSignal(this.lookups.subCategories(), {
    initialValue: [] as LookupItem[],
  });

  /* ------------------------------------------------------- list filters ----
     Sub-category narrows to the chosen category, and picking a category clears
     any sub-category beneath it so the pair can never contradict itself. */
  protected readonly filterCategoryId = signal<number | null>(null);
  protected readonly filterSubCategoryId = signal<number | null>(null);

  protected readonly filterSubCategories = computed(() => {
    const category = this.filterCategoryId();
    const all = this.allSubCategories();
    return category === null ? all : all.filter((sc) => sc.parentId === category);
  });

  protected onCategoryFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterCategoryId.set(raw ? Number(raw) : null);
    this.filterSubCategoryId.set(null);
    this.list.setFilter('categoryId', raw || null);
    this.list.setFilter('subCategoryId', null);
  }

  protected onSubCategoryFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterSubCategoryId.set(raw ? Number(raw) : null);
    this.list.setFilter('subCategoryId', raw || null);
  }

  protected resetFilters(): void {
    this.filterCategoryId.set(null);
    this.filterSubCategoryId.set(null);
    this.list.clearFilters();
  }

  protected readonly suggestedCode = computed(() => {
    const draft = this.formValue();
    if (!draft?.name?.trim()) return 'ZED-BRO-MT';
    const parent = this.allSubCategories().find((item) => item.id === draft.subCategoryId);
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

  protected openForm(row?: ProgramType): void {
    this.editing.set(row ?? null);
    this.form.reset({
      categoryId: row?.categoryId ?? null,
      subCategoryId: row?.subCategoryId ?? null,
      code: row?.code ?? '',
      name: row?.name ?? '',
      shortDescription: row?.shortDescription ?? '',
      durationDays: row?.durationDays ?? 5,
      deliveryMode: row?.deliveryMode ?? 'Physical',
      minQualification: row?.minQualification ?? 'NONE',
      minExperienceYears: row?.minExperienceYears ?? 0,
      certificateValidityMonths: row?.certificateValidityMonths ?? 36,
      certificationPolicy: row?.certificationPolicy ?? 'QualificationOnly',
      isExamMandatory: row?.isExamMandatory ?? true,
      isFeeApplicable: row?.isFeeApplicable ?? true,
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
        this.toast.success(current ? 'Program type updated' : 'Program type created', payload.name);
        this.lookups.invalidate('program-types');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: { id: number; status: string; name?: string }, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} program type?`,
      message:
        status === 'Active'
          ? 'The record becomes available again for new transactions.'
          : 'The record stays in history but can no longer be selected for new transactions.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Program type ${status === 'Active' ? 'enabled' : 'disabled'}`, row.name);
      this.lookups.invalidate();
      this.list.reload();
    });
  }
}
