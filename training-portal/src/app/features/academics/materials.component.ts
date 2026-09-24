import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppRole,
  MATERIAL_KINDS,
  ROLE_LABELS,
  RecordStatus,
  TrainingMaterial,
} from '../../core/models';
import { TrainingMaterialService } from '../../core/services/academics.service';
import { ToastService } from '../../core/services/toast.service';
import { CascadeSelectComponent } from '../../shared/components/cascade-select.component';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { IconComponent, IconName } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { DurationPipe, FileSizePipe } from '../../shared/pipes/format.pipes';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'title', header: 'Material', sortable: true, variant: 'primary' },
  { key: 'kind', header: 'Type', width: '130px' },
  { key: 'programTypeName', header: 'Program type', variant: 'muted' },
  { key: 'visibleToRoles', header: 'Visible to', width: '240px' },
  { key: 'size', header: 'Size / length', width: '130px' },
  { key: 'language', header: 'Language', width: '110px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

const ROLE_OPTIONS: AppRole[] = ['SuperAdmin', 'Admin', 'OperationManager', 'Coordinator', 'Applicant'];

const KIND_ICONS: Record<string, IconName> = {
  Document: 'file',
  Video: 'video',
  Presentation: 'monitor',
  Link: 'link',
};

@Component({
  selector: 'app-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    StatusToggleComponent,
    ModalComponent,
    CascadeSelectComponent,
    IconComponent,
    FileSizePipe,
    DurationPipe,
  ],
  template: `
    <app-page-header
      title="Training material"
      subtitle="Files and videos published against a program type, with role based visibility."
      icon="video"
      [breadcrumbs]="[{ label: 'Programme setup' }, { label: 'Training material' }]"
    >
      <button type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="upload" [size]="15" /> Publish material
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Search material" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="matKind">Type</label>
            <select id="matKind" class="select" (change)="list.setFilter('kind', value($event))">
              <option value="">All types</option>
              @for (kind of kinds; track kind) {
                <option [value]="kind">{{ kind }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="matRole">Visible to role</label>
            <select id="matRole" class="select" (change)="list.setFilter('visibleToRoles', value($event))">
              <option value="">Any role</option>
              @for (role of roleOptions; track role) {
                <option [value]="role">{{ roleLabels[role] }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="matStatus">Status</label>
            <select id="matStatus" class="select" (change)="list.setFilter('status', value($event))">
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
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No training material"
        emptyIcon="video"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="title" let-row>
          <div class="row row-sm">
            <span class="kind-icon" [class]="'kind-icon is-' + $any(row).kind.toLowerCase()">
              <app-icon [name]="iconFor($any(row).kind)" [size]="15" />
            </span>
            <span class="stack stack-xs">
              <strong>{{ $any(row).title }}</strong>
              <span class="cell-muted">{{ $any(row).fileName || $any(row).url }}</span>
            </span>
          </div>
        </ng-template>
        <ng-template appCell="kind" let-row>
          <span class="chip">{{ $any(row).kind }}</span>
        </ng-template>
        <ng-template appCell="visibleToRoles" let-row>
          <div class="row row-sm row-wrap">
            @for (role of $any(row).visibleToRoles; track role) {
              <span class="chip">{{ roleLabel(role) }}</span>
            }
          </div>
        </ng-template>
        <ng-template appCell="size" let-row>
          @if ($any(row).kind === 'Video') {
            {{ $any(row).durationMinutes | duration }}
          } @else {
            {{ $any(row).fileSizeKb | fileSize }}
          }
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
              <app-icon name="edit" [size]="15" />
            </button>
            <app-status-toggle [status]="$any(row).status" (toggled)="setStatus($any(row), $event)" />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit material' : 'Publish training material'"
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="material-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid form-grid--3">
            <app-cascade-select [group]="form" [required]="true" anyLabel="Select" />
          </div>
          <div class="form-grid">
            <div class="field field--span-2">
              <label class="field-label" for="matTitle">Title <span class="req">*</span></label>
              <input id="matTitle" class="input" formControlName="title" />
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="matDesc">Description</label>
              <textarea id="matDesc" class="textarea" formControlName="description"></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="matKindSel">Material type</label>
              <select id="matKindSel" class="select" formControlName="kind">
                @for (kind of kinds; track kind) {
                  <option [value]="kind">{{ kind }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="matLang">Language</label>
              <select id="matLang" class="select" formControlName="language">
                @for (language of languages; track language) {
                  <option [value]="language">{{ language }}</option>
                }
              </select>
            </div>

            @if (form.value.kind === 'Link') {
              <div class="field field--span-2">
                <label class="field-label" for="matUrl">URL <span class="req">*</span></label>
                <input id="matUrl" class="input" formControlName="url" placeholder="https://" />
              </div>
            } @else {
              <div class="field field--span-2">
                <label class="field-label" for="matFile">File</label>
                <div class="file-box">
                  <app-icon name="upload" [size]="16" />
                  <span class="text-sm">{{ form.value.fileName || 'Choose a file to upload' }}</span>
                  <input id="matFile" type="file" (change)="onFile($event)" />
                </div>
                <span class="field-hint">PDF, PPTX or MP4. Large videos are streamed, not downloaded.</span>
              </div>
            }

            @if (form.value.kind === 'Video') {
              <div class="field">
                <label class="field-label" for="matDuration">Runtime (minutes)</label>
                <input id="matDuration" type="number" class="input" formControlName="durationMinutes" />
              </div>
            }

            <div class="field">
              <label class="field-label" for="matVersion">Version</label>
              <input id="matVersion" class="input" formControlName="version" />
            </div>
            <div class="field">
              <label class="field-label" for="matPublished">Published on</label>
              <input id="matPublished" type="date" class="input" formControlName="publishedOn" />
            </div>
            <div class="field">
              <label class="field-label" for="matStatusSel">Status</label>
              <select id="matStatusSel" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div class="field field--span-2">
              <span class="field-label">Visible to roles <span class="req">*</span></span>
              <div class="check-grid">
                @for (role of roleOptions; track role) {
                  <label class="check">
                    <input
                      type="checkbox"
                      [checked]="isRoleSelected(role)"
                      (change)="toggleRole(role, $event)"
                    />
                    <span>{{ roleLabels[role] }}</span>
                  </label>
                }
              </div>
            </div>
            <div class="field field--span-2">
              <label class="check">
                <input type="checkbox" formControlName="downloadAllowed" />
                <span>Allow download (uncheck to restrict to in-app viewing)</span>
              </label>
            </div>
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="material-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save material
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .kind-icon {
        width: 28px;
        height: 28px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: var(--radius-sm);
        background: var(--ink-100);
        color: var(--ink-600);
      }
      .kind-icon.is-video { background: var(--danger-700); color: #fff; }
      .kind-icon.is-document { background: var(--brand-600); color: #fff; }
      .kind-icon.is-presentation { background: var(--warning-700); color: #fff; }
      .kind-icon.is-link { background: var(--info-700); color: #fff; }
      .file-box {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.7rem;
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius);
        color: var(--ink-500);
        background: var(--surface-muted);
      }
      .file-box input[type='file'] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    `,
  ],
})
export class MaterialsComponent {
  private readonly service = inject(TrainingMaterialService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;
  protected readonly kinds = MATERIAL_KINDS;
  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly languages = ['English', 'Hindi', 'Tamil', 'Marathi', 'Gujarati', 'Bengali'];

  protected readonly list = new ListState<TrainingMaterial>((request) => this.service.list(request), {
    sortBy: 'title',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<TrainingMaterial | null>(null);

  protected readonly form = this.fb.group({
    categoryId: [null as number | null, Validators.required],
    subCategoryId: [null as number | null, Validators.required],
    programTypeId: [null as number | null, Validators.required],
    title: ['', Validators.required],
    description: [''],
    kind: ['Document'],
    language: ['English'],
    fileName: [''],
    fileSizeKb: [0],
    url: [''],
    durationMinutes: [0],
    version: ['v1.0'],
    publishedOn: [new Date().toISOString().slice(0, 10)],
    visibleToRoles: [['SuperAdmin', 'Admin'] as AppRole[], Validators.required],
    downloadAllowed: [true],
    status: ['Active'],
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected roleLabel(role: string): string {
    return ROLE_LABELS[role as AppRole] ?? role;
  }

  protected iconFor(kind: string): IconName {
    return KIND_ICONS[kind] ?? 'file';
  }

  protected isRoleSelected(role: AppRole): boolean {
    return (this.form.value.visibleToRoles ?? []).includes(role);
  }

  protected toggleRole(role: AppRole, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.form.value.visibleToRoles ?? [];
    this.form.patchValue({
      visibleToRoles: checked ? [...current, role] : current.filter((r) => r !== role),
    });
  }

  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.form.patchValue({ fileName: file.name, fileSizeKb: Math.round(file.size / 1024) });
  }

  protected openForm(row?: TrainingMaterial): void {
    this.editing.set(row ?? null);
    this.form.reset({
      categoryId: row?.categoryId ?? null,
      subCategoryId: row?.subCategoryId ?? null,
      programTypeId: row?.programTypeId ?? null,
      title: row?.title ?? '',
      description: row?.description ?? '',
      kind: row?.kind ?? 'Document',
      language: row?.language ?? 'English',
      fileName: row?.fileName ?? '',
      fileSizeKb: row?.fileSizeKb ?? 0,
      url: row?.url ?? '',
      durationMinutes: row?.durationMinutes ?? 0,
      version: row?.version ?? 'v1.0',
      publishedOn: row?.publishedOn ?? new Date().toISOString().slice(0, 10),
      visibleToRoles: row?.visibleToRoles ?? (['SuperAdmin', 'Admin'] as AppRole[]),
      downloadAllowed: row?.downloadAllowed ?? true,
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
        this.toast.success('Training material saved', payload.title ?? '');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: { id: number; status: string; title?: string }, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} material?`,
      message:
        status === 'Active'
          ? 'The material becomes visible again to the selected roles.'
          : 'The material is hidden from every role but stays on record.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Material ${status === 'Active' ? 'enabled' : 'disabled'}`, row.title);
      this.list.reload();
    });
  }
}
