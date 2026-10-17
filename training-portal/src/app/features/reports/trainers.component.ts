import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Faculty, Id, LookupItem, TrainerField } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { FacultyService } from '../../core/services/report.service';
import { TrainerFormService } from '../../core/services/academics.service';
import { LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ListState, searchTerm } from '../../shared/list-state';
import { describeError, formatValidator, requiredFormat, describeFirstError } from '../../core/validation/formats';

const COLUMNS: ColumnDef[] = [
  { key: 'fullName', header: 'Trainer', sortable: true, variant: 'primary' },
  /* The implementing agency, by name. It is settled by the programme the
     trainer took, so there is nothing here to assign. */
  { key: 'agencyName', header: 'Agency', sortable: true },
  { key: 'organisation', header: 'Organisation', sortable: true },
  { key: 'contact', header: 'Contact', width: '190px' },
  { key: 'experience', header: 'Experience', align: 'center', width: '110px' },
  { key: 'qualification', header: 'Qualification', width: '150px' },
  { key: 'programme', header: 'Program', sortable: true },
  { key: 'conducted', header: 'Conducted', sortable: true, width: '190px' },
  { key: 'actions', header: '', align: 'right', width: '90px' },
];

@Component({
  selector: 'app-trainers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.trainers.title')"
      [subtitle]="copy.text('page.trainers.subtitle')"
      icon="user-check"
      [breadcrumbs]="[{ label: 'Reports' }, { label: copy.text('page.trainers.title') }]"
    >
      <!-- No adding from here, by anybody. A trainer is registered at
           the venue by the coordinator who is standing in front of them,
           from the app, which records where and when. A web form offering
           the same thing from an office is a trainer nobody saw. What the
           web keeps is the correcting of one already taken down. -->
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                class="input"
                placeholder="Search by name, mobile or organisation"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="trCategory">Category</label>
            <select
              id="trCategory"
              class="select"
              [value]="list.stagedValue('categoryId')"
              (change)="onCategory(numberOrNull($event))"
            >
              <option value="">All categories</option>
              @for (option of categories(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="trType">Program type</label>
            <select id="trType" class="select"
              [value]="list.stagedValue('programTypeId')"
              (change)="list.stageFilter('programTypeId', value($event))"
            >
              <option value="">All program types</option>
              @for (option of programTypes(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="trAgency">Agency</label>
            <select id="trAgency" class="select"
              [value]="list.stagedValue('agencyId')"
              (change)="list.stageFilter('agencyId', value($event))"
            >
              <option value="">All agencies</option>
              @for (option of agencies(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="trState">State/UT</label>
            <select id="trState" class="select"
              [value]="list.stagedValue('stateCode')"
              (change)="list.stageFilter('stateCode', value($event))"
            >
              <option value="">All states/UTs</option>
              @for (option of states(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
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
        exportName="Trainers"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No trainers recorded"
        emptyMessage="A trainer appears here once a coordinator registers them from the app, at the venue."
        emptyIcon="user-check"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="fullName" let-row>
          <div class="stack stack-xs">
            <strong>{{ $any(row).fullName }}</strong>
            @if ($any(row).designation) {
              <span class="text-xs text-muted">{{ $any(row).designation }}</span>
            }
          </div>
        </ng-template>

        <ng-template appCell="agencyName" let-row>
          {{ $any(row).agencyName || '—' }}
        </ng-template>

        <ng-template appCell="experience" let-row>
          <span class="tabular">
            {{ $any(row).yearsExperience != null ? $any(row).yearsExperience + ' yrs' : '—' }}
          </span>
        </ng-template>

        <ng-template appCell="qualification" let-row>
          <span class="cell-muted">{{ $any(row).qualification || '—' }}</span>
        </ng-template>

        <ng-template appCell="contact" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).mobile }}</span>
            @if ($any(row).email) {
              <span class="text-xs text-muted">{{ $any(row).email }}</span>
            }
          </div>
        </ng-template>

        <ng-template appCell="programme" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).programmeCode }}</span>
            <span class="text-xs text-muted">{{ $any(row).programTypeName }}</span>
          </div>
        </ng-template>

        <ng-template appCell="conducted" let-row>
          <div class="stack stack-xs">
            <!-- Dated the way every other register dates a batch. These
                 two came straight off the wire, so this was the one screen
                 that said 2026-10-15 where the rest say 15 Oct 2026. -->
            <span class="tabular">
              {{ $any(row).startDate | date: 'dd MMM yyyy' }} –
              {{ $any(row).endDate | date: 'dd MMM yyyy' }}
            </span>
            <span class="text-xs text-muted">{{ $any(row).stateName }}</span>
          </div>
        </ng-template>

        <ng-template appCell="actions" let-row>
          @if (canWrite()) {
          <button type="button" class="btn btn--icon" title="Edit"
            (click)="openForm($any(row))">
            <app-icon name="edit" [size]="15" />
          </button>
          }
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        title="Edit trainer"
        subtitle="Recorded against one program — the batch they delivered."
        (closed)="closeForm()"
      >
        <form [formGroup]="form" class="form-grid" id="trainer-form" (ngSubmit)="save()">
          @if (editing(); as held) {
            <div class="field field--span-2">
              <span class="field-label">Program</span>
              <p class="text-sm">
                {{ editing()!.programmeCode }} · {{ editing()!.programmeName }}
              </p>
              <span class="field-hint">
                A trainer belongs to the program they took, so this cannot be moved. The
                coordinator registers them against the other one from the app.
              </span>
            </div>
          }

          <div class="field field--span-2">
            <label class="field-label" for="tfName">Full name <span class="req">*</span></label>
            <input id="tfName" class="input" formControlName="fullName" [class.is-invalid]="invalid('fullName')" />
            @if (invalid('fullName')) { <span class="field-error">Name is required.</span> }
          </div>

          <div class="field">
            <label class="field-label" for="tfMobile">Mobile <span class="req">*</span></label>
            <input id="tfMobile" class="input" formControlName="mobile" maxlength="10"
              [class.is-invalid]="invalid('mobile')" />
            @if (invalid('mobile')) {
              <span class="field-error">{{ errorFor('mobile', 'Mobile') }}</span>
            }
          </div>

          @if (asks('email')) {
            <div class="field">
              <label class="field-label" for="tfEmail">
                {{ label('email', 'Email') }}
                @if (mustHave('email')) { <span class="req">*</span> }
              </label>
              <input id="tfEmail" class="input" formControlName="email" [class.is-invalid]="invalid('email')" />
              @if (invalid('email')) {
                <span class="field-error">{{ errorFor('email', 'Email') }}</span>
              }
            </div>
          }

          <div class="field">
            <label class="field-label" for="tfDesignation">Designation</label>
            <input id="tfDesignation" class="input" formControlName="designation" />
          </div>

          <div class="field">
            <label class="field-label" for="tfOrg">Organisation</label>
            <input id="tfOrg" class="input" formControlName="organisation" />
          </div>

          @if (asks('experience')) {
            <div class="field">
              <label class="field-label" for="tfYears">
                {{ label('experience', 'Years of experience') }}
                @if (mustHave('experience')) { <span class="req">*</span> }
              </label>
              <input
                id="tfYears"
                class="input"
                type="number"
                min="0"
                max="70"
                formControlName="yearsExperience"
              />
            </div>
          }

          @if (asks('qualification')) {
            <div class="field">
              <label class="field-label" for="tfQual">
                {{ label('qualification', 'Qualification') }}
                @if (mustHave('qualification')) { <span class="req">*</span> }
              </label>
              <select id="tfQual" class="select" formControlName="qualification">
                <option [ngValue]="null">Not stated</option>
                @for (option of qualifications(); track option.id) {
                  <option [value]="option.name">{{ option.name }}</option>
                }
              </select>
            </div>
          }

          @if (asks('aadhaar')) {
          <div class="field">
            <label class="field-label" for="tfAadhaar">
              {{ label('aadhaar', 'Aadhaar') }}
              @if (mustHave('aadhaar')) { <span class="req">*</span> }
            </label>
            <input
              id="tfAadhaar"
              class="input"
              formControlName="aadhaar"
              inputmode="numeric"
              maxlength="12"
              [placeholder]="editing()?.aadhaarLast4
                ? 'Held, ending ' + editing()!.aadhaarLast4
                : '12 digit number'"
            />
            <!-- The stored number is never sent back, so the box starts
                 empty on an edit and leaving it empty keeps what is
                 there. Typing replaces it. -->
            <span class="field-hint">
              {{ editing()?.aadhaarLast4
                ? 'Leave blank to keep the number already held.'
                : 'Shown as the last four digits everywhere.' }}
            </span>
          </div>
          }

          <!-- Whatever else the office decided to ask. Stored against the
               field rather than as a column, so switching one off keeps
               what was already answered. -->
          @for (field of extras(); track field.key) {
            <div class="field">
              <label class="field-label" [attr.for]="'tfx-' + field.key">
                {{ field.label }}
                @if (field.required) { <span class="req">*</span> }
              </label>
              @if (field.type === 'select' && field.options.length > 0) {
                <select [id]="'tfx-' + field.key" class="select" [formControlName]="field.key">
                  <option value="">Not stated</option>
                  @for (option of field.options; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              } @else {
                <input
                  [id]="'tfx-' + field.key"
                  class="input"
                  [formControlName]="field.key"
                  [placeholder]="field.placeholder || ''"
                />
              }
              @if (field.helpText) { <span class="field-hint">{{ field.helpText }}</span> }
            </div>
          }
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="trainer-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save changes
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class TrainersComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly auth = inject(AuthService);

  /**
   * Whether this account writes trainers here.
   *
   * The permission alone is not the answer: a coordinator holds it, and
   * registers trainers from the app rather than from this screen. What
   * they get here is their own list, to read.
   */
  protected readonly canWrite = computed(
    () => this.auth.hasPermission('trainers.manage') && !this.auth.hasRole('Coordinator'),
  );
  private readonly service = inject(FacultyService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);


  protected readonly columns = COLUMNS;
  protected readonly list = new ListState<Faculty>((request) => this.service.list(request), {
    sortBy: 'fullName',
  });
  /* Held rather than written inline: an arrow in the template is a new
     function on every change detection pass. */
  protected readonly exportRows = () => this.list.fetchAll();

  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] });
  protected readonly agencies = toSignal(this.lookups.agencies(), { initialValue: [] });
  protected readonly programTypes = signal<{ id: Id; name: string }[]>([]);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Faculty | null>(null);

  /**
   * The questions the office configured, which the app already renders.
   *
   * This screen asked a fixed set of its own: it went on asking for a
   * field that had been switched off, never asked for one that had been
   * added, and let a field marked required be skipped by adding the
   * trainer from here instead of from the app. One record, asked for
   * twice, two different ways.
   *
   * Photographs are the exception and stay out: they are taken on the
   * day and uploaded against a record that already exists, so the server
   * does not insist on them here either.
   */
  private readonly trainerForm = inject(TrainerFormService);

  protected readonly asked = toSignal(this.trainerForm.active(), { initialValue: [] as TrainerField[] });

  protected readonly extras = computed(() =>
    this.asked().filter((f) => !f.isBuiltIn && f.type !== 'photos' && f.type !== 'file'),
  );

  /** Whether the configured form asks this built-in at all. */
  protected asks(key: string): boolean {
    const fields = this.asked();
    /* Until the form has loaded, show what this screen always showed
       rather than an empty dialog. */
    return fields.length === 0 || fields.some((f) => f.key === key);
  }

  /** Whether it insists on an answer. */
  protected mustHave(key: string): boolean {
    return this.asked().some((f) => f.key === key && f.required);
  }

  protected label(key: string, fallback: string): string {
    return this.asked().find((f) => f.key === key)?.label ?? fallback;
  }

  protected readonly form = this.fb.group({
    programmeId: [null as number | null, Validators.required],
    fullName: ['', Validators.required],
    mobile: ['', requiredFormat('mobile')],
    email: [''],
    designation: [''],
    organisation: [''],
    yearsExperience: [null as number | null],
    qualification: [null as string | null],
    aadhaar: ['', formatValidator('aadhaar')],
  });

  /* The same ladder the app offers, so the two agree. */
  /**
   * The qualification ladder, from the lookup rather than from the master.
   *
   * A trainer is put on the record by the coordinator who was in the room,
   * and a coordinator holds none of the masters keys - the masters are not
   * theirs to read, let alone edit. Asking the master endpoint for them
   * came back refused, which left the Qualification dropdown empty for the
   * one role that fills this form most often, and offered them no way to
   * record what they plainly knew.
   *
   * The lookup is the same ladder, live rungs only, and is open to
   * everybody: it already feeds the sign-up form, which is read by people
   * with no account at all. The stored value is unchanged - the label, as
   * before.
   */
  protected readonly qualifications = toSignal(this.lookups.qualifications(), {
    initialValue: [] as LookupItem[],
  });

  constructor() {
    this.loadProgramTypes(null);
    this.keepControlsInStep();
  }

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected numberOrNull(event: Event): number | null {
    const raw = (event.target as HTMLSelectElement).value;
    return raw ? Number(raw) : null;
  }

  protected onCategory(categoryId: number | null): void {
    this.list.stageFilter('categoryId', categoryId ? String(categoryId) : '');
    this.list.stageFilter('programTypeId', '');
    this.loadProgramTypes(categoryId);
  }

  private loadProgramTypes(categoryId: number | null): void {
    this.lookups.programTypes(null, categoryId).subscribe((items) => {
      this.programTypes.set(items.map((item) => ({ id: item.id, name: item.name })));
    });
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected errorFor(control: string, label: string): string {
    return describeError(this.form.get(control)?.errors ?? null, label);
  }

  protected openForm(row: Faculty): void {
    this.editing.set(row);

    this.form.reset({
      programmeId: row.programmeId,
      fullName: row.fullName,
      mobile: row.mobile,
      email: row.email ?? '',
      designation: row.designation ?? '',
      organisation: row.organisation ?? '',
      yearsExperience: row.yearsExperience ?? null,
      qualification: row.qualification ?? null,
      /* Always blank. The stored number is never sent to a screen, so
         there is nothing to put here; blank on save means keep it. */
      aadhaar: '',
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  /**
   * Adds a control for each question the office added, and takes away
   * the ones it has since removed.
   *
   * Run as an effect rather than once at startup, because the form
   * arrives over the wire after the component does, and can change under
   * a screen that is left open.
   */
  private keepControlsInStep(): void {
    effect(() => {
      const extras = this.extras();
      const group = this.form as unknown as FormGroup;

      for (const field of extras) {
        if (!group.contains(field.key)) {
          group.addControl(
            field.key,
            this.fb.control('', field.required ? [Validators.required] : []),
          );
      }
      }

      for (const name of Object.keys(group.controls)) {
        if (this.built.has(name)) continue;
        if (!extras.some((f) => f.key === name)) group.removeControl(name);
      }

      /* A built-in the office marked required is required here too, and one
         it relaxed stops being. The two that the record cannot do without
         keep their own validators whatever the form says. */
      const asked = this.asked();
      if (asked.length === 0) return;

      for (const key of ['email', 'qualification', 'yearsExperience'] as const) {
        const control = group.get(key);
        if (!control) continue;

        const field = key === 'yearsExperience' ? 'experience' : key;
        const must = asked.some((f) => f.key === field && f.required);
        const base = key === 'email' ? [formatValidator('email')] : [];

        control.setValidators(must ? [...base, Validators.required] : base);
        control.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  /** The controls this screen has always had, which are never removed. */
  private readonly built = new Set([
    'programmeId', 'fullName', 'mobile', 'email', 'designation',
    'organisation', 'yearsExperience', 'qualification', 'aadhaar',
  ]);

  protected save(): void {
    /* Only ever an edit now: a trainer is registered at the venue from the
       app, so the only thing this screen writes is a correction to one
       already taken down. */
    const editing = this.editing();
    if (!editing) return;

    /* The programme is fixed on an existing record, so its validator must
       not decide whether the rest may be saved. */
    this.form.controls.programmeId.clearValidators();
    this.form.controls.programmeId.updateValueAndValidity({ emitEvent: false });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Check the form', describeFirstError(this.form));
      return;
    }

    const raw = this.form.getRawValue();
    const body = {
      fullName: raw.fullName ?? '',
      mobile: raw.mobile ?? '',
      email: raw.email || null,
      designation: raw.designation || null,
      organisation: raw.organisation || null,
      yearsExperience: raw.yearsExperience ?? null,
      qualification: raw.qualification || null,
      /* Sent only when something was typed. An empty box on an edit
         means "leave the number alone", not "delete it" — the screen
         never had it to show back, so treating blank as a clear would
         wipe it every time anybody corrected a telephone number. */
      aadhaar: raw.aadhaar?.trim() || undefined,

      /* Keyed by the field, which is how the server stores them and how
         the app sends them, so a trainer added here and one registered
         on the day read the same afterwards. */
      answers: Object.fromEntries(
        this.extras().map((f) => [f.key, String((raw as Record<string, unknown>)[f.key] ?? '')]),
      ),
    };

    this.saving.set(true);

    this.service.update(editing.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Trainer updated', body.fullName);
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }
}
