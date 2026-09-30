import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LookupItem,
  DIFFICULTY_LEVELS,
  ExamPaper,
  QUESTION_TYPES,
  RecordStatus,
  examTotalMarks,
} from '../../core/models';
import { ExamPaperService } from '../../core/services/academics.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgramTypeLinkageComponent } from '../../shared/components/program-type-linkage.component';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { LookupService } from '../../core/services/masters.service';
import { MasterFilterComponent } from '../../shared/components/master-filter.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'code', header: 'Paper code', sortable: true, width: '150px' },
  { key: 'title', header: 'Title', sortable: true, variant: 'primary' },
  { key: 'programTypeName', header: 'Program type', variant: 'muted' },
  { key: 'blueprint', header: 'Blueprint', width: '190px' },
  { key: 'durationMinutes', header: 'Duration', align: 'center', width: '110px' },
  { key: 'passPercentage', header: 'Pass %', align: 'center', width: '90px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-exam-papers',
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
    ProgramTypeLinkageComponent,
    IconComponent,
    MasterFilterComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.examPapers.title')"
      [subtitle]="copy.text('page.examPapers.subtitle')"
      icon="clipboard"
      [breadcrumbs]="[{ label: 'Program setup' }, { label: copy.text('page.examPapers.title') }]"
    >
      <button *appCan="'exams.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New exam paper
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--inline">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Search exam papers" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <app-master-filter [list]="list" programTypeLabel="Program type" #masters />
          <div class="field">
            <label class="field-label" for="examStatus">Status</label>
            <select id="examStatus" class="select" (change)="list.setFilter('status', value($event))">
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          @if (list.hasFilters) {
            <button type="button" class="btn btn--ghost" (click)="masters.clear(); list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          }
        </div>
      </div>

      <app-data-table
        exportName="Exam papers"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No exam papers"
        emptyIcon="clipboard"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="blueprint" let-row>
          <div class="row row-sm">
            <span class="chip">{{ $any(row).questions.length }} questions</span>
            <span class="chip">{{ marks($any(row)) }} marks</span>
          </div>
          @if ($any(row).negativeMarking) {
            <div class="cell-muted">Negative marking on</div>
          }
        </ng-template>
        <ng-template appCell="durationMinutes" let-row>{{ $any(row).durationMinutes }} min</ng-template>
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
        [title]="editing() ? 'Edit exam paper' : 'New exam paper'"
        [subtitle]="questions.length + ' questions · ' + liveMarks() + ' marks'"
        size="xl"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="exam-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid form-grid--3">
            <div class="field">
              <label class="field-label">Program type <span class="req">*</span></label>
              <select class="select" formControlName="programTypeId">
                <option [ngValue]="null">Select program type</option>
                @for (type of allProgramTypes(); track type.id) {
                  <option [ngValue]="type.id">{{ type.code }} — {{ type.name }}</option>
                }
              </select>
            </div>
            <app-program-type-linkage [programTypeId]="form.controls.programTypeId.value" />
          </div>
          <div class="form-grid form-grid--3">
            <div class="field">
              <label class="field-label" for="examCode">Paper code <span class="req">*</span></label>
              <input id="examCode" class="input" formControlName="code" />
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="examTitle">Title <span class="req">*</span></label>
              <input id="examTitle" class="input" formControlName="title" />
            </div>
            <div class="field">
              <label class="field-label" for="examDuration">Duration (minutes)</label>
              <input id="examDuration" type="number" class="input" formControlName="durationMinutes" />
            </div>
            <div class="field">
              <label class="field-label" for="examPass">Pass percentage</label>
              <input id="examPass" type="number" class="input" formControlName="passPercentage" />
            </div>
            <div class="field">
              <label class="field-label" for="examAttempts">Maximum attempts</label>
              <input id="examAttempts" type="number" class="input" formControlName="maxAttempts" />
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="examInstructions">Instructions</label>
              <textarea id="examInstructions" class="textarea" formControlName="instructions"></textarea>
            </div>
            <div class="field">
              <span class="field-label">Options</span>
              <label class="check"><input type="checkbox" formControlName="shuffleQuestions" /><span>Shuffle questions</span></label>
              <label class="check"><input type="checkbox" formControlName="negativeMarking" /><span>Negative marking</span></label>
            </div>
          </div>

          <div class="divider"></div>

          <div class="row row-between">
            <strong class="text-md">Questions</strong>
            <button type="button" class="btn btn--secondary btn--sm" (click)="addQuestion()">
              <app-icon name="plus" [size]="14" /> Add question
            </button>
          </div>

          <div class="stack stack-md" formArrayName="questions">
            @for (question of questions.controls; track $index; let qi = $index) {
              <fieldset class="question" [formGroupName]="qi">
                <div class="question__head">
                  <span class="question__index">Q{{ qi + 1 }}</span>
                  <input class="input" formControlName="text" placeholder="Question text" />
                  <button type="button" class="btn btn--icon is-danger" (click)="removeQuestion(qi)">
                    <app-icon name="trash" [size]="15" />
                  </button>
                </div>

                <div class="question__meta">
                  <select class="select" formControlName="type">
                    @for (type of types; track type) {
                      <option [value]="type">{{ type }}</option>
                    }
                  </select>
                  <select class="select" formControlName="difficulty">
                    @for (level of levels; track level) {
                      <option [value]="level">{{ level }}</option>
                    }
                  </select>
                  <input type="number" class="input" formControlName="marks" placeholder="Marks" (input)="touch()" />
                  <input type="number" step="0.25" class="input" formControlName="negativeMarks" placeholder="Negative" />
                </div>

                <div class="stack stack-xs mt-sm" formArrayName="options">
                  @for (option of optionsOf(qi).controls; track $index; let oi = $index) {
                    <div class="option" [formGroupName]="oi">
                      <label class="check">
                        <input type="checkbox" formControlName="isCorrect" />
                      </label>
                      <input class="input" formControlName="text" [placeholder]="'Option ' + (oi + 1)" />
                      <button type="button" class="btn btn--icon is-danger" (click)="removeOption(qi, oi)">
                        <app-icon name="x" [size]="14" />
                      </button>
                    </div>
                  }
                  <button type="button" class="btn btn--ghost btn--sm" (click)="addOption(qi)">
                    <app-icon name="plus" [size]="14" /> Add option
                  </button>
                </div>
              </fieldset>
            } @empty {
              <div class="alert alert--info">
                <app-icon name="info" [size]="16" />
                <span>Add questions to build the paper blueprint.</span>
              </div>
            }
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="exam-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save exam paper
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .question {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.85rem;
        margin: 0;
        background: var(--surface-muted);
      }
      .question__head { display: flex; align-items: center; gap: 0.5rem; }
      .question__index {
        min-width: 34px;
        height: 24px;
        padding: 0 0.4rem;
        display: grid;
        place-items: center;
        border-radius: var(--radius-sm);
        background: var(--brand-600);
        color: #fff;
        font-size: var(--fs-xs);
        font-weight: 700;
      }
      .question__meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.4rem;
        margin-top: 0.5rem;
      }
      .option { display: grid; grid-template-columns: 26px 1fr 32px; gap: 0.4rem; align-items: center; }
      @media (max-width: 760px) {
        .question__meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `,
  ],
})
export class ExamPapersComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ExamPaperService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly lookups = inject(LookupService);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly types = QUESTION_TYPES;
  protected readonly levels = DIFFICULTY_LEVELS;
  /* The form picks a programme type directly; category and sub-category are
     shown beside it, derived rather than chosen again. */
  protected readonly allProgramTypes = toSignal(this.lookups.programTypes(null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly list = new ListState<ExamPaper>((request) => this.service.list(request), {
    sortBy: 'code',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<ExamPaper | null>(null);
  private readonly tick = signal(0);

  protected readonly form = this.fb.group({
    programTypeId: [null as number | null, Validators.required],
    code: ['', Validators.required],
    title: ['', Validators.required],
    instructions: [''],
    durationMinutes: [60, Validators.min(5)],
    passPercentage: [60, [Validators.min(1), Validators.max(100)]],
    maxAttempts: [3, Validators.min(1)],
    shuffleQuestions: [true],
    negativeMarking: [false],
    status: ['Active'],
    questions: this.fb.array<FormGroup>([]),
  });

  protected readonly liveMarks = computed(() => {
    this.tick();
    return this.questions.controls.reduce((sum, q) => sum + Number(q.get('marks')?.value || 0), 0);
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;
  protected marks = examTotalMarks;

  get questions(): FormArray<FormGroup> {
    return this.form.get('questions') as FormArray<FormGroup>;
  }

  protected optionsOf(index: number): FormArray<FormGroup> {
    return this.questions.at(index).get('options') as FormArray<FormGroup>;
  }

  protected touch(): void {
    this.tick.update((v) => v + 1);
  }

  protected addQuestion(): void {
    this.questions.push(
      this.fb.group({
        id: [0],
        text: ['', Validators.required],
        type: ['SingleChoice'],
        difficulty: ['Moderate'],
        marks: [2, Validators.min(0.5)],
        negativeMarks: [0.5],
        options: this.fb.array<FormGroup>([this.newOption(), this.newOption()]),
      }),
    );
    this.touch();
  }

  protected removeQuestion(index: number): void {
    this.questions.removeAt(index);
    this.touch();
  }

  protected addOption(questionIndex: number): void {
    this.optionsOf(questionIndex).push(this.newOption());
  }

  protected removeOption(questionIndex: number, optionIndex: number): void {
    this.optionsOf(questionIndex).removeAt(optionIndex);
  }

  private newOption(): FormGroup {
    return this.fb.group({ id: [0], text: ['', Validators.required], isCorrect: [false] });
  }

  protected openForm(row?: ExamPaper): void {
    this.editing.set(row ?? null);
    this.questions.clear();
    this.form.patchValue({
      programTypeId: row?.programTypeId ?? null,
      code: row?.code ?? '',
      title: row?.title ?? '',
      instructions: row?.instructions ?? '',
      durationMinutes: row?.durationMinutes ?? 60,
      passPercentage: row?.passPercentage ?? 60,
      maxAttempts: row?.maxAttempts ?? 3,
      shuffleQuestions: row?.shuffleQuestions ?? true,
      negativeMarking: row?.negativeMarking ?? false,
      status: row?.status ?? 'Active',
    });
    for (const question of row?.questions ?? []) {
      this.questions.push(
        this.fb.group({
          id: [question.id],
          text: [question.text, Validators.required],
          type: [question.type],
          difficulty: [question.difficulty],
          marks: [question.marks, Validators.min(0.5)],
          negativeMarks: [question.negativeMarks],
          options: this.fb.array<FormGroup>(
            question.options.map((option) =>
              this.fb.group({
                id: [option.id],
                text: [option.text, Validators.required],
                isCorrect: [option.isCorrect],
              }),
            ),
          ),
        }),
      );
    }
    if (!this.questions.length) this.addQuestion();
    this.touch();
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Incomplete paper', 'Every question and option needs text.');
      return;
    }
    this.saving.set(true);
    const payload = this.form.getRawValue();
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Exam paper saved', `${this.questions.length} questions.`);
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: { id: number; status: string; title?: string }, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} exam paper?`,
      message:
        status === 'Active'
          ? 'The paper becomes available again for scheduling.'
          : 'The paper stays in history but can no longer be scheduled.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Exam paper ${status === 'Active' ? 'enabled' : 'disabled'}`, row.title);
      this.list.reload();
    });
  }
}
