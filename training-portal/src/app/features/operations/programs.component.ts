import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LookupItem,
  PROGRAM_MODES,
  PROGRAM_STATUSES,
  PROGRAM_STATUS_LABELS,
  Program,
  ProgramStatus,
  programActions,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/masters.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgramService } from '../../core/services/workflow.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { ListState } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'serial', header: 'S.No', width: '64px', align: 'center' },
  { key: 'programmeId', header: 'Programme ID', sortable: true, width: '140px' },
  { key: 'agencyName', header: 'Agency name', width: '210px' },
  { key: 'programmeName', header: 'Programme', variant: 'primary', width: '230px' },
  { key: 'venue', header: 'Venue', width: '190px', variant: 'muted' },
  { key: 'state', header: 'State', width: '130px' },
  { key: 'startDate', header: 'Start date', sortable: true, width: '120px' },
  { key: 'endDate', header: 'End date', width: '120px' },
  { key: 'participantCount', header: 'Participants', align: 'center', width: '110px' },
  { key: 'cumulativeFeedback', header: 'Cumulative feedback', align: 'center', width: '150px' },
  { key: 'comments', header: 'Comments', width: '260px' },
];

@Component({
  selector: 'app-programs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      title="Programmes"
      subtitle="Every batch conducted physically or virtually, with its permission, calendar and conduct status."
      icon="calendar"
      [breadcrumbs]="[{ label: 'Operations' }, { label: 'Programmes' }]"
    >
      @if (canManage()) {
        <button type="button" class="btn btn--primary" (click)="openForm()">
          <app-icon name="plus" [size]="15" /> New programme
        </button>
      }
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--two-rows">
          <div class="field">
            <label class="field-label" for="pgState">State</label>
            <select id="pgState" class="select" (change)="list.setFilter('state', value($event))">
              <option value="">All</option>
              @for (state of states(); track state.id) {
                <option [value]="state.name.toUpperCase()">{{ state.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="pgStart">Start date</label>
            <input id="pgStart" type="date" class="input" (change)="list.setFilter('startDate', value($event))" />
          </div>
          <div class="field">
            <label class="field-label" for="pgType">Type</label>
            <select id="pgType" class="select" (change)="list.setFilter('mode', value($event))">
              <option value="">All</option>
              @for (mode of modes; track mode) {
                <option [value]="mode">{{ mode }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="pgAgency">Agency</label>
            <select id="pgAgency" class="select" (change)="list.setFilter('agencyId', value($event))">
              <option value="">All</option>
              @for (agency of agencies(); track agency.id) {
                <option [value]="agency.id">{{ agency.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="pgEnd">End date</label>
            <input id="pgEnd" type="date" class="input" (change)="list.setFilter('endDate', value($event))" />
          </div>
          <div class="field">
            <label class="field-label" for="pgStatus">Status</label>
            <select id="pgStatus" class="select" (change)="list.setFilter('status', value($event))">
              <option value="">All</option>
              @for (status of statuses; track status) {
                <option [value]="status">{{ statusLabels[status] }}</option>
              }
            </select>
          </div>
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        [compact]="true"
        minWidth="1560px"
        emptyTitle="No programmes"
        emptyIcon="calendar"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="serial" let-row>
          <span class="cell-muted tabular">{{ $any(row).serial }}</span>
        </ng-template>
        <ng-template appCell="programmeId" let-row>
          <a class="cell-primary" [routerLink]="['/operations/programs', $any(row).id]">
            {{ $any(row).programmeId }}
          </a>
        </ng-template>
        <ng-template appCell="venue" let-row>
          <div class="row row-sm">
            <app-icon [name]="$any(row).mode === 'Virtual' ? 'monitor' : 'map-pin'" [size]="14" />
            <span>{{ $any(row).venue }}</span>
          </div>
        </ng-template>
        <ng-template appCell="startDate" let-row>
          {{ $any(row).startDate | date: 'dd MMM yyyy' }}
        </ng-template>
        <ng-template appCell="endDate" let-row>
          {{ $any(row).endDate | date: 'dd MMM yyyy' }}
        </ng-template>
        <ng-template appCell="cumulativeFeedback" let-row>
          @if ($any(row).cumulativeFeedback) {
            <span class="chip">{{ $any(row).cumulativeFeedback }} / 5</span>
          } @else {
            <span class="cell-muted">—</span>
          }
        </ng-template>
        <ng-template appCell="comments" let-row>
          <div class="stack stack-xs">
            <app-status-badge [value]="$any(row).status" />
            @if ($any(row).comments) {
              <span class="cell-muted">{{ $any(row).comments }}</span>
            }
            @if (canManage()) {
              <div class="row row-sm row-wrap">
                @if (actions($any(row)).canAcceptPermission) {
                  <button type="button" class="btn btn--sm btn--secondary" (click)="advance($any(row), 'PermissionAccepted')">
                    Permission accepted
                  </button>
                }
                @if (actions($any(row)).canCloseRegistrations) {
                  <button type="button" class="btn btn--sm btn--secondary" (click)="closeRegistrations($any(row))">
                    Close registrations
                  </button>
                }
                @if (actions($any(row)).canSetExamTime) {
                  <button type="button" class="btn btn--sm btn--secondary" (click)="openExam($any(row))">
                    Set exam time
                  </button>
                }
                @if (actions($any(row)).canPostpone) {
                  <button type="button" class="btn btn--sm btn--subtle-danger" (click)="postpone($any(row))">
                    Postpone
                  </button>
                }
              </div>
            }
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal title="New programme" size="lg" (closed)="formOpen.set(false)">
        <form [formGroup]="form" id="programme-form" (ngSubmit)="save()" class="form-grid">
          <div class="field">
            <label class="field-label" for="npProgramType">Programme type <span class="req">*</span></label>
            <select id="npProgramType" class="select" formControlName="programTypeId">
              <option [ngValue]="null">Select</option>
              @for (programType of programTypes(); track programType.id) {
                <option [ngValue]="programType.id">{{ programType.code }} — {{ programType.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="npAgency">Implementing agency <span class="req">*</span></label>
            <select id="npAgency" class="select" formControlName="agencyId" (change)="onAgencyChange()">
              <option [ngValue]="null">Select</option>
              @for (agency of agencies(); track agency.id) {
                <option [ngValue]="agency.id">{{ agency.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="npCoordinator">Coordinator <span class="req">*</span></label>
            <select id="npCoordinator" class="select" formControlName="coordinatorId">
              <option [ngValue]="null">Select</option>
              @for (coordinator of coordinators(); track coordinator.id) {
                <option [ngValue]="coordinator.id">{{ coordinator.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="npMode">Mode <span class="req">*</span></label>
            <select id="npMode" class="select" formControlName="mode">
              @for (mode of modes; track mode) {
                <option [value]="mode">{{ mode }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="npState">State <span class="req">*</span></label>
            <select id="npState" class="select" formControlName="stateCode">
              <option [ngValue]="null">Select</option>
              @for (state of states(); track state.id) {
                <option [ngValue]="state.id">{{ state.name }}</option>
              }
            </select>
          </div>

          @if (form.value.mode === 'Virtual') {
            <div class="field">
              <label class="field-label" for="npPlatform">Meeting platform</label>
              <input id="npPlatform" class="input" formControlName="meetingPlatform" placeholder="Microsoft Teams" />
            </div>
            <div class="field">
              <label class="field-label" for="npLink">Meeting link</label>
              <input id="npLink" class="input" formControlName="meetingLink" placeholder="https://" />
            </div>
          } @else {
            <div class="field field--span-2">
              <label class="field-label" for="npVenue">Venue <span class="req">*</span></label>
              <input id="npVenue" class="input" formControlName="venue" />
            </div>
          }

          <div class="field">
            <label class="field-label" for="npStart">Start date <span class="req">*</span></label>
            <input id="npStart" type="date" class="input" formControlName="startDate" />
          </div>
          <div class="field">
            <label class="field-label" for="npEnd">End date <span class="req">*</span></label>
            <input id="npEnd" type="date" class="input" formControlName="endDate" />
          </div>
          <div class="field">
            <label class="field-label" for="npSeats">Seat capacity</label>
            <input id="npSeats" type="number" class="input" formControlName="seatCapacity" />
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="formOpen.set(false)">Cancel</button>
          <button type="submit" form="programme-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Submit for permission
          </button>
        </div>
      </app-modal>
    }

    @if (examFor(); as programme) {
      <app-modal
        title="Set exam time"
        [subtitle]="programme.programmeId + ' · ' + programme.programmeName"
        size="sm"
        (closed)="examFor.set(null)"
      >
        <div class="field">
          <label class="field-label" for="examWhen">Examination date &amp; time</label>
          <input id="examWhen" type="datetime-local" class="input" [value]="examValue()" (change)="examValue.set(value($event))" />
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="examFor.set(null)">Cancel</button>
          <button type="button" class="btn btn--primary" (click)="saveExam()">Save exam time</button>
        </div>
      </app-modal>
    }
  `,
})
export class ProgramsComponent {
  private readonly service = inject(ProgramService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;
  protected readonly modes = PROGRAM_MODES;
  protected readonly statuses = PROGRAM_STATUSES;
  protected readonly statusLabels = PROGRAM_STATUS_LABELS;
  protected readonly actions = programActions;

  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });
  protected readonly agencies = toSignal(this.lookups.agencies(), { initialValue: [] as LookupItem[] });
  protected readonly programTypes = toSignal(this.lookups.programTypes(null), { initialValue: [] as LookupItem[] });
  protected readonly coordinators = signal<LookupItem[]>([]);

  protected readonly list = new ListState<Program>((request) => this.service.list(request), {
    sortBy: 'startDate',
    pageSize: 25,
  });

  protected readonly rows = computed(() =>
    this.list.rows().map((row, i) => ({
      ...row,
      serial: (this.list.page() - 1) * this.list.pageSize() + i + 1,
    })),
  );

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly examFor = signal<Program | null>(null);
  protected readonly examValue = signal('');

  protected readonly canManage = computed(() => this.auth.hasPermission('programs.manage'));

  protected readonly form = this.fb.group({
    programTypeId: [null as number | null, Validators.required],
    agencyId: [null as number | null, Validators.required],
    coordinatorId: [null as number | null, Validators.required],
    mode: ['Virtual'],
    stateCode: [null as number | null, Validators.required],
    venue: [''],
    meetingPlatform: ['Microsoft Teams'],
    meetingLink: [''],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    seatCapacity: [30],
  });

  protected value = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value;

  constructor() {
    this.list.sortDir.set('desc');
  }

  protected onAgencyChange(): void {
    const agencyId = this.form.value.agencyId ?? null;
    this.lookups.coordinators(agencyId).subscribe((items) => this.coordinators.set(items));
  }

  protected openForm(): void {
    this.form.reset({
      programTypeId: null,
      agencyId: null,
      coordinatorId: null,
      mode: 'Virtual',
      stateCode: null,
      venue: '',
      meetingPlatform: 'Microsoft Teams',
      meetingLink: '',
      startDate: '',
      endDate: '',
      seatCapacity: 30,
    });
    this.coordinators.set([]);
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.service
      .create({
        ...raw,
        /* The programme ID and name are the server's to set. It allocates the
           next ZEDTP number in sequence and names the batch from the programme
           type's real duration; the random id and hard-coded "5-Day" this sent
           before could collide and mislabel a ten-day programme. */
        venue: raw.mode === 'Virtual' ? 'Virtual' : raw.venue,
        participantCount: 0,
        registrationsOpen: false,
        examDateTime: null,
        status: 'New',
        sessions: [],
        participants: [],
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Programme submitted', 'Awaiting permission from the operation manager.');
          this.formOpen.set(false);
          this.list.reload();
        },
        error: () => this.saving.set(false),
      });
  }

  protected advance(programme: Program, status: ProgramStatus): void {
    this.service.update(programme.id, { ...programme, status, registrationsOpen: true }).subscribe(() => {
      this.toast.success('Permission accepted', programme.programmeId);
      this.list.reload();
    });
  }

  protected async closeRegistrations(programme: Program): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Close registrations?',
      message: `No further applicants can enrol in ${programme.programmeId} once registrations close.`,
      confirmLabel: 'Close registrations',
    });
    if (!confirmed) return;
    this.service.update(programme.id, { ...programme, registrationsOpen: false }).subscribe(() => {
      this.toast.success('Registrations closed', programme.programmeId);
      this.list.reload();
    });
  }

  protected openExam(programme: Program): void {
    this.examFor.set(programme);
    this.examValue.set(programme.examDateTime ?? `${programme.endDate}T15:00`);
  }

  protected saveExam(): void {
    const programme = this.examFor();
    if (!programme) return;
    this.service
      .update(programme.id, { ...programme, examDateTime: this.examValue(), status: 'CalendarCreated' })
      .subscribe(() => {
        this.toast.success('Exam time set', programme.programmeId);
        this.examFor.set(null);
        this.list.reload();
      });
  }

  protected async postpone(programme: Program): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Postpone programme?',
      message: `${programme.programmeId} moves to the postponed list and drops off the calendar.`,
      confirmLabel: 'Postpone',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.service
      .update(programme.id, {
        ...programme,
        status: 'Postponed',
        comments: 'Postponed by operations.',
      })
      .subscribe(() => {
        this.toast.success('Programme postponed', programme.programmeId);
        this.list.reload();
      });
  }
}
