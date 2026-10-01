import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Faculty, Id } from '../../core/models';
import { FacultyService } from '../../core/services/report.service';
import { LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ListState, searchTerm } from '../../shared/list-state';
import { describeError, requiredFormat } from '../../core/validation/formats';

const COLUMNS: ColumnDef[] = [
  { key: 'fullName', header: 'Trainer', sortable: true, variant: 'primary' },
  { key: 'organisation', header: 'Organisation', sortable: true },
  { key: 'contact', header: 'Contact', width: '200px' },
  { key: 'programme', header: 'Program', sortable: true },
  { key: 'conducted', header: 'Conducted', sortable: true, width: '190px' },
  { key: 'actions', header: '', align: 'right', width: '90px' },
];

@Component({
  selector: 'app-trainers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
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
      <button *appCan="'trainers.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> Add trainer
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <p class="text-muted text-sm">
          One row per delivery: a trainer who took three workshops appears three times, because
          each row is that programme's own record of who turned up. Coordinators add them from
          the app on the day; you can add or correct one here.
        </p>

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
            <select id="trCategory" class="select" (change)="onCategory(numberOrNull($event))">
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
        emptyMessage="A trainer appears here once a coordinator registers them, or when you add one."
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
            <span class="tabular">{{ $any(row).startDate }} – {{ $any(row).endDate }}</span>
            <span class="text-xs text-muted">{{ $any(row).stateName }}</span>
          </div>
        </ng-template>

        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
            <app-icon name="edit" [size]="15" />
          </button>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit trainer' : 'Add trainer'"
        subtitle="Recorded against one program — the batch they delivered."
        (closed)="closeForm()"
      >
        <form [formGroup]="form" class="form-grid" id="trainer-form" (ngSubmit)="save()">
          @if (!editing()) {
            <div class="field field--span-2">
              <label class="field-label" for="tfProgramme">Program <span class="req">*</span></label>
              <select id="tfProgramme" class="select" formControlName="programmeId">
                <option [ngValue]="null">Select the program they delivered</option>
                @for (option of programmes(); track option.id) {
                  <option [ngValue]="option.id">{{ option.name }}</option>
                }
              </select>
              @if (invalid('programmeId')) {
                <span class="field-error">Choose the program this trainer took.</span>
              }
            </div>
          } @else {
            <div class="field field--span-2">
              <span class="field-label">Program</span>
              <p class="text-sm">
                {{ editing()!.programmeCode }} · {{ editing()!.programmeName }}
              </p>
              <span class="field-hint">
                A trainer belongs to the programme they took, so this cannot be moved. Add them
                to the other programme instead.
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

          <div class="field">
            <label class="field-label" for="tfEmail">Email</label>
            <input id="tfEmail" class="input" formControlName="email" [class.is-invalid]="invalid('email')" />
            @if (invalid('email')) {
              <span class="field-error">{{ errorFor('email', 'Email') }}</span>
            }
          </div>

          <div class="field">
            <label class="field-label" for="tfDesignation">Designation</label>
            <input id="tfDesignation" class="input" formControlName="designation" />
          </div>

          <div class="field">
            <label class="field-label" for="tfOrg">Organisation</label>
            <input id="tfOrg" class="input" formControlName="organisation" />
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="trainer-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Add trainer' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class TrainersComponent {
  protected readonly copy = inject(SiteTextService);
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
  protected readonly programmes = signal<{ id: Id; name: string }[]>([]);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Faculty | null>(null);

  protected readonly form = this.fb.group({
    programmeId: [null as number | null, Validators.required],
    fullName: ['', Validators.required],
    mobile: ['', requiredFormat('mobile')],
    email: [''],
    designation: [''],
    organisation: [''],
  });

  constructor() {
    this.loadProgramTypes(null);
  }

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected numberOrNull(event: Event): number | null {
    const raw = (event.target as HTMLSelectElement).value;
    return raw ? Number(raw) : null;
  }

  protected onCategory(categoryId: number | null): void {
    this.list.setFilter('categoryId', categoryId ? String(categoryId) : '');
    this.list.setFilter('programTypeId', '');
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

  protected openForm(row?: Faculty): void {
    this.editing.set(row ?? null);

    /* Only needed when adding: an existing trainer's programme is fixed, so
       the list is not fetched for an edit. */
    if (!row) this.loadProgrammes();

    this.form.reset({
      programmeId: row?.programmeId ?? null,
      fullName: row?.fullName ?? '',
      mobile: row?.mobile ?? '',
      email: row?.email ?? '',
      designation: row?.designation ?? '',
      organisation: row?.organisation ?? '',
    });
    this.formOpen.set(true);
  }

  private loadProgrammes(): void {
    this.service.programmeOptions().subscribe((items) => this.programmes.set(items));
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    const editing = this.editing();

    /* The programme is not on the form when editing, so its validator must
       not decide whether the rest may be saved. */
    if (editing) this.form.controls.programmeId.clearValidators();
    this.form.controls.programmeId.updateValueAndValidity({ emitEvent: false });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const body = {
      fullName: raw.fullName ?? '',
      mobile: raw.mobile ?? '',
      email: raw.email || null,
      designation: raw.designation || null,
      organisation: raw.organisation || null,
    };

    this.saving.set(true);
    const request = editing
      ? this.service.update(editing.id, body)
      : this.service.add(raw.programmeId!, body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(editing ? 'Trainer updated' : 'Trainer added', body.fullName);
        this.closeForm();
        this.list.reload();
        this.form.controls.programmeId.setValidators(Validators.required);
      },
      error: () => this.saving.set(false),
    });
  }
}
