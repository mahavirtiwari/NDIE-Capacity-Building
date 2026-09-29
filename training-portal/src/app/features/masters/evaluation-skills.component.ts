import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EvaluationSkill, Id, ProgramType, RecordStatus } from '../../core/models';
import { EvaluationSkillService, ProgramTypeService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';

const COLUMNS: ColumnDef[] = [
  { key: 'displayOrder', header: '#', align: 'center', width: '60px' },
  { key: 'name', header: 'Skill', variant: 'primary' },
  { key: 'description', header: 'What the trainer is looking for', variant: 'muted' },
  { key: 'maxMarks', header: 'Marks', align: 'center', width: '90px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '120px', align: 'right' },
];

/**
 * The skills a trainer marks each candidate against in the viva or practical,
 * kept per program type.
 *
 * Its own screen rather than a panel inside the program type form, because the
 * marksheet is the thing being designed here: it is read down a column, checked
 * against the marks the viva carries, and reordered until it reads the way a
 * trainer will work through it.
 */
@Component({
  selector: 'app-evaluation-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    RouterLink,
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
      [title]="copy.text('skills.title')"
      [subtitle]="copy.text('skills.subtitle')"
      icon="clipboard"
      [breadcrumbs]="[{ label: 'Programme setup' }, { label: copy.text('skills.title') }]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" [disabled]="!selected()" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New skill
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--inline">
          <div class="field">
            <label class="field-label" for="esType">Program type</label>
            <select
              id="esType"
              class="select"
              [value]="programTypeId() ?? ''"
              (change)="choose($event)"
            >
              <option value="">Select a program type</option>
              @for (type of vivaTypes(); track type.id) {
                <option [value]="type.id">{{ type.name }} ({{ type.code }})</option>
              }
            </select>
            <span class="field-hint">{{ copy.text('skills.typeHint') }}</span>
          </div>

          @if (selected(); as type) {
            <div class="field">
              <span class="field-label">Viva marks</span>
              <p class="tally" [class.tally--off]="marksMismatch()">
                {{ allocated() }} of {{ type.evaluation.vivaMarks }} allocated
              </p>
              @if (marksMismatch()) {
                <span class="field-error">
                  {{
                    copy.text('skills.shortfall', {
                      allocated: allocated(),
                      viva: type.evaluation.vivaMarks,
                    })
                  }}
                </span>
              }
            </div>
          }
        </div>
      </div>

      @if (!selected()) {
        <div class="card__body">
          <p class="text-muted">
            {{ copy.text('skills.pick') }}
            @if (vivaTypes().length === 0 && !loadingTypes()) {
              No program type is examined by viva or practical yet — set one up under
              <a routerLink="/masters/program-types">Program types</a> first.
            }
          </p>
        </div>
      } @else {
        <app-data-table
          [columns]="columns"
          [rows]="skills()"
          [total]="skills().length"
          [showPager]="false"
          [loading]="loading()"
          emptyTitle="No skills yet"
          emptyIcon="clipboard"
        >
          <ng-template appCell="status" let-row>
            <app-status-badge [value]="$any(row).status" />
          </ng-template>
          <ng-template appCell="description" let-row>
            {{ $any(row).description || '-' }}
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
      }
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit skill' : 'New skill'"
        [subtitle]="'Marked by the trainer for every candidate on ' + (selected()?.name ?? '')"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="es-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid">
            <div class="field field--span-2">
              <label class="field-label" for="esName">Skill <span class="req">*</span></label>
              <input
                id="esName"
                class="input"
                formControlName="name"
                placeholder="e.g. Handling of measuring instruments"
              />
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="esDesc">What the trainer is looking for</label>
              <textarea id="esDesc" class="textarea" formControlName="description"></textarea>
              <span class="field-hint">
                Shown to the trainer beside the mark, so two trainers mark the same thing.
              </span>
            </div>
            <div class="field">
              <label class="field-label" for="esMarks">Marks <span class="req">*</span></label>
              <input id="esMarks" type="number" min="1" class="input" formControlName="maxMarks" />
            </div>
            <div class="field">
              <label class="field-label" for="esOrder">Order on the sheet</label>
              <input
                id="esOrder"
                type="number"
                min="0"
                class="input"
                formControlName="displayOrder"
              />
              <span class="field-hint">Leave at 0 to add it at the end.</span>
            </div>
            <div class="field">
              <label class="field-label" for="esStatus">Status</label>
              <select id="esStatus" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="es-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Add skill' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .tally {
        font-weight: 600;
        margin: 0.3rem 0 0;
      }
      .tally--off {
        color: var(--danger, #b3261e);
      }
    `,
  ],
})
export class EvaluationSkillsComponent {
  private readonly service = inject(EvaluationSkillService);
  private readonly programTypes = inject(ProgramTypeService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly copy = inject(SiteTextService);

  protected readonly columns = COLUMNS;

  protected readonly loadingTypes = signal(true);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<EvaluationSkill | null>(null);

  protected readonly skills = signal<EvaluationSkill[]>([]);
  protected readonly allTypes = signal<ProgramType[]>([]);

  /* Arrived at from the program type form, which links straight to the type it
     was showing. */
  protected readonly programTypeId = signal<Id | null>(
    Number(this.route.snapshot.queryParamMap.get('programTypeId')) || null,
  );

  /** Only types with a viva: the others have nothing to mark skills against. */
  protected readonly vivaTypes = computed(() =>
    this.allTypes().filter((t) => t.evaluation?.hasViva),
  );

  protected readonly selected = computed(
    () => this.vivaTypes().find((t) => t.id === this.programTypeId()) ?? null,
  );

  /** What the live skills add up to — what a candidate can actually be given. */
  protected readonly allocated = computed(() =>
    this.skills()
      .filter((s) => s.status === 'Active')
      .reduce((sum, s) => sum + s.maxMarks, 0),
  );

  /**
   * Whether the sheet can award what the viva is worth.
   *
   * Only flagged once there is something to add up: a type whose skills have
   * not been entered yet is unfinished, not wrong.
   */
  protected readonly marksMismatch = computed(() => {
    const viva = this.selected()?.evaluation?.vivaMarks ?? 0;
    return this.skills().length > 0 && viva > 0 && this.allocated() !== viva;
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    maxMarks: [10, [Validators.required, Validators.min(1)]],
    displayOrder: [0],
    status: ['Active' as RecordStatus],
  });

  constructor() {
    this.programTypes.all().subscribe((types) => {
      this.allTypes.set(types);
      this.loadingTypes.set(false);
      if (this.programTypeId()) this.load();
    });
  }

  private load(): void {
    const id = this.programTypeId();
    if (!id) {
      this.skills.set([]);
      return;
    }
    this.loading.set(true);
    this.service.byProgramType(id).subscribe({
      next: (rows) => {
        this.skills.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected choose(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.programTypeId.set(raw ? Number(raw) : null);
    this.load();
  }

  protected openForm(row?: EvaluationSkill): void {
    this.editing.set(row ?? null);
    this.form.reset({
      name: row?.name ?? '',
      description: row?.description ?? '',
      maxMarks: row?.maxMarks ?? 10,
      displayOrder: row?.displayOrder ?? 0,
      status: row?.status ?? 'Active',
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    const programTypeId = this.programTypeId();
    if (!programTypeId) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const payload = { ...this.form.getRawValue(), programTypeId };
    const current = this.editing();
    const request = current
      ? this.service.update(current.id, payload)
      : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Skill updated' : 'Skill added', payload.name);
        this.closeForm();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: EvaluationSkill, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} this skill?`,
      message:
        status === 'Active'
          ? 'Trainers will be asked to mark it again on new batches.'
          : 'Trainers stop being asked to mark it. Marks already given against it are kept.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;

    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Skill ${status === 'Active' ? 'enabled' : 'disabled'}`, row.name);
      this.load();
    });
  }
}
