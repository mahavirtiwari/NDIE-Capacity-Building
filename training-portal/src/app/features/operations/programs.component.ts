import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ExamPaper,
  LookupItem,
  PROGRAM_MODES,
  PROGRAM_STATUSES,
  PROGRAM_STATUS_LABELS,
  Program,
  ProgramStatus,
  programActions,
} from '../../core/models';
import { ExamPaperService } from '../../core/services/academics.service';
import { AuthService } from '../../core/services/auth.service';
import { LookupService, ProgramTypeService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgramService } from '../../core/services/workflow.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { requiredFormat } from '../../core/validation/formats';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'serial', header: 'S.No', width: '64px', align: 'center' },
  { key: 'programmeId', header: 'Program ID', sortable: true, width: '140px' },
  { key: 'agencyName', header: 'Agency name', width: '210px' },
  { key: 'programmeName', header: 'Program', variant: 'primary', width: '230px' },
  { key: 'venue', header: 'Venue', width: '190px', variant: 'muted' },
  { key: 'state', header: 'State/UT', width: '130px' },
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
    CanDirective,
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
      [title]="copy.text('page.programmes.title')"
      [subtitle]="copy.text('page.programmes.subtitle')"
      icon="calendar"
      [breadcrumbs]="[{ label: 'Operations' }, { label: copy.text('page.programmes.title') }]"
    >
      <!-- Raising a batch is the implementing agency's job and permitting
           it is the operation manager's, so this is its own permission
           rather than the one that covers running a batch. Super Admin
           does not hold it. -->
      @if (canCreate()) {
        <button type="button" class="btn btn--primary" (click)="openForm()">
          <app-icon name="plus" [size]="15" /> New program
        </button>
      }
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--two-rows">
          <!-- The server already searched on these three; there was simply
               no box to type into. -->
          <div class="field field--search">
            <label class="field-label" for="pgSearch">Search</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                id="pgSearch"
                class="input"
                placeholder="Program ID, name or agency"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="pgState">State/UT</label>
            <select
              id="pgState"
              class="select"
              [value]="list.stagedValue('state')"
              (change)="list.stageFilter('state', value($event))"
            >
              <option value="">All</option>
              @for (state of states(); track state.id) {
                <option [value]="state.name.toUpperCase()">{{ state.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="pgType">Type</label>
            <select
              id="pgType"
              class="select"
              [value]="list.stagedValue('mode')"
              (change)="list.stageFilter('mode', value($event))"
            >
              <option value="">All</option>
              @for (mode of modes; track mode) {
                <option [value]="mode">{{ mode }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="pgAgency">Agency</label>
            <select
              id="pgAgency"
              class="select"
              [value]="list.stagedValue('agencyId')"
              (change)="list.stageFilter('agencyId', value($event))"
            >
              <option value="">All</option>
              @for (agency of agencies(); track agency.id) {
                <option [value]="agency.id">{{ agency.name }}</option>
              }
            </select>
          </div>
          <div class="field field--range">
            <label class="field-label" for="pgStart">Start and end date</label>
            <div class="field-range__inputs">
              <input
                id="pgStart"
                type="date"
                class="input"
                aria-label="Start date"
                [value]="list.stagedValue('startDate')"
                (change)="list.stageFilter('startDate', value($event))"
              />
              <span class="field-range__dash">&ndash;</span>
              <input
                id="pgEnd"
                type="date"
                class="input"
                aria-label="End date"
                [value]="list.stagedValue('endDate')"
                (change)="list.stageFilter('endDate', value($event))"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="pgStatus">Status</label>
            <select
              id="pgStatus"
              class="select"
              [value]="list.stagedValue('status')"
              (change)="list.stageFilter('status', value($event))"
            >
              <option value="">All</option>
              @for (status of statuses; track status) {
                <option [value]="status">{{ statusLabels[status] }}</option>
              }
            </select>
          </div>
          <!-- Applied on the button rather than on every change. Six
               filters including a date range meant a query per keystroke,
               and a part-typed year narrowed the list to nothing before
               anybody had finished choosing. -->
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--primary" (click)="list.applyFilters()">
              <app-icon name="search" [size]="15" /> Apply filters
            </button>
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
            @if (list.dirty()) {
              <span class="text-muted text-sm">Not applied yet</span>
            }
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Programs"
        [exportRows]="exportRows"
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
        emptyTitle="No programs"
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
            <app-icon
              [name]="
                $any(row).mode === 'Virtual'
                  ? 'monitor'
                  : $any(row).mode === 'Hybrid'
                    ? 'layers'
                    : 'map-pin'
              "
              [size]="14"
            />
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
            <!-- An ask that has not been answered sits on the row, so the
                 manager reads the reason beside the decision. -->
            @if ($any(row).postponementRequestedOn) {
              <div class="stack stack-xs">
                <span class="chip">Postponement asked for</span>
                <span class="text-xs text-muted">{{ $any(row).postponementReason }}</span>
              </div>
            }
            @if (canManage()) {
              <div class="row row-sm row-wrap">
                @if (canApprove() && actions($any(row)).canAcceptPermission) {
                  <button type="button" class="btn btn--sm btn--secondary" (click)="advance($any(row), 'PermissionAccepted')">
                    Permission accepted
                  </button>
                }
                @if (actions($any(row)).canReopenRegistrations) {
                  <button type="button" class="btn btn--sm btn--secondary" (click)="openReopen($any(row))">
                    Reopen registrations
                  </button>
                }
                @if (actions($any(row)).canSetExamTime) {
                  <button type="button" class="btn btn--sm btn--secondary" (click)="openExam($any(row))">
                    Set exam time
                  </button>
                }
                @if (canApprove() && actions($any(row)).canPostpone) {
                  <button type="button" class="btn btn--sm btn--subtle-danger" (click)="postpone($any(row))">
                    Postpone
                  </button>
                }
                @if (!canApprove() && actions($any(row)).canAskToPostpone) {
                  <button type="button" class="btn btn--sm btn--secondary" (click)="openAskPostpone($any(row))">
                    Ask to postpone
                  </button>
                }
              </div>
            }
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (askPostponeFor(); as programme) {
      <app-modal title="Ask to postpone this batch?" size="sm" (closed)="askPostponeFor.set(null)">
        <div class="stack stack-sm">
          <p class="text-sm">
            {{ programme.programmeId }} is due to start
            {{ programme.startDate | date: 'dd MMM yyyy' }}. It stays where it is until
            the operation manager puts it off.
          </p>
          <div class="field">
            <label class="field-label" for="askReason">Reason <span class="req">*</span></label>
            <textarea
              id="askReason"
              class="textarea"
              rows="3"
              maxlength="500"
              [value]="askReason()"
              (input)="askReason.set(textValue($event))"
              placeholder="e.g. The venue has flooded and no other hall is free that week"
            ></textarea>
            <span class="field-hint">Sent to the operation manager with the batch.</span>
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="askPostponeFor.set(null)">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="askReason().trim().length === 0 || asking()"
            (click)="confirmAskPostpone()"
          >
            @if (asking()) { <span class="spinner"></span> }
            Send request
          </button>
        </div>
      </app-modal>
    }

    @if (reopenFor(); as programme) {
      <!-- Reopening says how many places, because the old number answered a
           question that has already been asked and settled. -->
      <app-modal title="Reopen registrations?" size="sm" (closed)="reopenFor.set(null)">
        <div class="stack stack-sm">
          <p class="text-sm">
            {{ programme.programmeId }} starts on
            {{ programme.startDate | date: 'dd MMM yyyy' }}. Registration closes again
            the day before, or as soon as the places are taken.
          </p>
          <div class="field">
            <label class="field-label" for="reopenPlaces">
              Places <span class="req">*</span>
            </label>
            <input
              id="reopenPlaces"
              type="number"
              class="input"
              min="1"
              [value]="reopenPlaces()"
              (input)="reopenPlaces.set(+numberValue($event))"
            />
            <span class="field-hint">
              Counted from nobody, not added on. {{ programme.participantCount }}
              are already enrolled.
            </span>
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="reopenFor.set(null)">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="reopenPlaces() <= 0 || reopening()"
            (click)="confirmReopen()"
          >
            @if (reopening()) { <span class="spinner"></span> }
            Reopen
          </button>
        </div>
      </app-modal>
    }

    @if (formOpen()) {
      <app-modal title="New program" size="lg" (closed)="formOpen.set(false)">
        <form [formGroup]="form" id="programme-form" (ngSubmit)="save()" class="form-grid">
          <div class="field">
            <label class="field-label" for="npProgramType">Program type <span class="req">*</span></label>
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
            <select id="npMode" class="select" formControlName="mode" (change)="onModeChange()">
              @for (mode of modes; track mode) {
                <option [value]="mode">{{ mode }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="npState">State/UT <span class="req">*</span></label>
            <select id="npState" class="select" formControlName="stateCode"
              (change)="onStateChange()">
              <option [ngValue]="null">Select</option>
              @for (state of states(); track state.id) {
                <option [ngValue]="state.id">{{ state.name }}</option>
              }
            </select>
          </div>

          <!-- Optional, but it is what the dashboard drills into: without it
               every district in the state reads zero however many programmes
               have run there. -->
          <div class="field">
            <label class="field-label" for="npDistrict">District</label>
            <select id="npDistrict" class="select" formControlName="districtCode">
              <option [ngValue]="null">
                {{ form.value.stateCode ? 'Select' : 'Choose a state first' }}
              </option>
              @for (district of districts(); track district.id) {
                <option [ngValue]="district.id">{{ district.name }}</option>
              }
            </select>
          </div>

          <!-- A hybrid batch asks for both: somebody turning up at the door
               needs an address and somebody joining from their desk needs a
               link, and a hybrid batch missing either fails half its intake
               on the day. -->
          @if (form.value.mode !== 'Virtual') {
            <div class="field field--span-2">
              <label class="field-label" for="npVenue">Venue <span class="req">*</span></label>
              <input id="npVenue" class="input" formControlName="venue" />
            </div>
            <div class="field">
              <label class="field-label" for="npPin">Pincode <span class="req">*</span></label>
              <input
                id="npPin"
                class="input"
                formControlName="pincode"
                maxlength="6"
                inputmode="numeric"
                placeholder="110001"
              />
              @if (form.controls.pincode.touched && form.controls.pincode.invalid) {
                <span class="field-error">Six digits, and it cannot start with a nought.</span>
              }
            </div>
          }
          @if (form.value.mode !== 'Physical') {
            <div class="field field--span-2">
              <label class="field-label" for="npLink">Meeting link <span class="req">*</span></label>
              <input id="npLink" class="input" formControlName="meetingLink" placeholder="https://" />
              <span class="field-hint">Where the candidates join. Sent out with the batch.</span>
            </div>
          }

          <!-- A batch is raised to be run, so the picker opens on today and
               the end date cannot be dragged behind the start. -->
          <div class="field">
            <label class="field-label" for="npStart">Start date <span class="req">*</span></label>
            <input id="npStart" type="date" class="input" [min]="today" formControlName="startDate" />
          </div>
          <div class="field">
            <label class="field-label" for="npEnd">End date <span class="req">*</span></label>
            <input
              id="npEnd"
              type="date"
              class="input"
              [min]="form.value.startDate || today"
              formControlName="endDate"
            />
          </div>

          <!-- The hours the batch runs each day. They go on the joining
               letter, so they are asked for once, here. -->
          <div class="field">
            <label class="field-label" for="npStartTime">Start time <span class="req">*</span></label>
            <input id="npStartTime" type="time" class="input" formControlName="startTime" />
          </div>
          <div class="field">
            <label class="field-label" for="npEndTime">End time <span class="req">*</span></label>
            <input id="npEndTime" type="time" class="input" formControlName="endTime" />
            @if (form.value.endTime && form.value.startTime
                 && form.value.endTime <= form.value.startTime) {
              <span class="field-error">The day has to end after it starts.</span>
            }
          </div>
          <div class="field">
            <label class="field-label" for="npSeats">Maximum no. of participants</label>
            <input
              id="npSeats"
              type="number"
              class="input"
              [min]="minParticipants() || 1"
              formControlName="maxParticipants"
            />
            <!-- The floor belongs to the program type and is shown as a fact
                 about it; the ceiling is the agency's to set. -->
            @if (minParticipants() > 0) {
              <span class="field-hint">
                This program type runs for at least <strong>{{ minParticipants() }}</strong>
                candidates. Registration closes by itself once the maximum have enrolled.
              </span>
              @if (form.controls.maxParticipants.value !== null
                   && +form.controls.maxParticipants.value < minParticipants()) {
                <span class="field-error">
                  A batch cannot be opened for fewer than {{ minParticipants() }}.
                </span>
              }
            } @else {
              <span class="field-hint">Registration closes by itself once this many have enrolled.</span>
            }
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
        <div class="stack stack-md">
          <div class="field">
            <label class="field-label" for="examWhen">Examination date &amp; time</label>
            <input id="examWhen" type="datetime-local" class="input" [value]="examValue()" (change)="examValue.set(value($event))" />
            <span class="field-hint">The online paper opens to candidates at this time.</span>
          </div>

          <div class="field">
            <label class="field-label" for="examPaper">Question paper</label>
            <!-- Selected through the options rather than the select's value:
                 the options are rendered from a list that arrives after the
                 binding would run, and the choice would be dropped. -->
            <select id="examPaper" class="select"
              (change)="examPaperId.set(value($event) ? +value($event) : null)">
              <option value="" [selected]="examPaperId() === null">
                {{ papersFor(programme).length === 1 ? 'Use the only live paper' : 'Not set' }}
              </option>
              @for (paper of papersFor(programme); track paper.id) {
                <option [value]="paper.id" [selected]="paper.id === examPaperId()">
                  {{ paper.code }} · {{ paper.title }}
                </option>
              }
            </select>
            @if (papersFor(programme).length === 0) {
              <span class="field-hint">
                This program type has no live paper, so the written mark is entered by hand on
                the marksheet.
              </span>
            } @else {
              <span class="field-hint">
                Leave unset and the program type's single live paper is used; a type with
                several has to be told which.
              </span>
            }
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="examFor.set(null)">Cancel</button>
          <button *appCan="'programs.manage'" type="button" class="btn btn--primary" (click)="saveExam()">Save exam time</button>
        </div>
      </app-modal>
    }
  `,
})
export class ProgramsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ProgramService);
  private readonly lookups = inject(LookupService);
  private readonly programTypeService = inject(ProgramTypeService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly modes = PROGRAM_MODES;
  protected readonly statuses = PROGRAM_STATUSES;
  protected readonly statusLabels = PROGRAM_STATUS_LABELS;
  protected readonly actions = programActions;

  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });

  /* Every district, loaded once, and narrowed in the browser. There are around
     seven hundred and sixty; a request per state change would be slower and no
     more correct. */
  private readonly allDistricts = toSignal(this.lookups.districts(), {
    initialValue: [] as LookupItem[],
  });
  private readonly chosenState = signal<number | null>(null);

  protected readonly districts = computed(() => {
    const state = this.chosenState();
    return state ? this.allDistricts().filter((d) => d.parentId === state) : [];
  });

  /** A district belongs to one state, so changing the state clears it. */
  protected onStateChange(): void {
    this.chosenState.set(this.form.controls.stateCode.value);
    this.form.controls.districtCode.setValue(null);
  }
  protected readonly agencies = toSignal(this.lookups.agencies(), { initialValue: [] as LookupItem[] });
  protected readonly programTypes = toSignal(this.lookups.programTypes(null), { initialValue: [] as LookupItem[] });

  /** The floor the chosen program type sets, nought when it sets none. */
  protected readonly minParticipants = signal(0);

  /**
   * Reads the floor off the type the moment it is chosen.
   *
   * The dropdown is a lookup of names and codes, so the number has to be
   * fetched; it is a fact about the type rather than something the form
   * can carry, and the server refuses a batch under it either way.
   */
  private applyFloor(id: number | null): void {
    if (!id) {
      this.minParticipants.set(0);
      return;
    }
    this.programTypeService.getById(id).subscribe((type) => {
      this.minParticipants.set(type.minParticipants ?? 0);
      const seats = Number(this.form.controls.maxParticipants.value ?? 0);
      if (type.minParticipants > 0 && seats < type.minParticipants) {
        this.form.controls.maxParticipants.setValue(type.minParticipants);
      }
    });
  }
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
  protected readonly examPaperId = signal<number | null>(null);

  /* Every live paper, filtered per batch when the modal opens: the list is
     short and fetched once rather than on each programme. */
  private readonly papers = toSignal(inject(ExamPaperService).all({ status: 'Active' }), {
    initialValue: [] as ExamPaper[],
  });

  protected papersFor(programme: Program): ExamPaper[] {
    return this.papers().filter((paper) => paper.programTypeId === programme.programTypeId);
  }

  /** Raise a batch: the agency that will deliver it. */
  protected readonly canCreate = computed(() => this.auth.hasPermission('programs.create'));

  /** Run one that exists: permission, registrations, exam time, postponement. */
  protected readonly canManage = computed(() => this.auth.hasPermission('programs.manage'));

  /* Deciding whether a batch may run is not the same as running it. The
     agency that raised it holds the second and never the first. */
  protected readonly canApprove = computed(() => this.auth.hasPermission('programs.approve'));

  protected readonly form = this.fb.group({
    programTypeId: [null as number | null, Validators.required],
    agencyId: [null as number | null, Validators.required],
    coordinatorId: [null as number | null, Validators.required],
    mode: ['Virtual'],
    stateCode: [null as number | null, Validators.required],
    districtCode: [null as number | null],
    venue: [''],
    pincode: [''],
    meetingLink: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    startTime: ['10:00', Validators.required],
    endTime: ['17:00', Validators.required],
    maxParticipants: [30],
  });

  /** Today, as the picker wants it. Nothing before it may be chosen. */
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value;

  constructor() {
    this.list.sortDir.set('desc');

    /* The control, not the element: the options carry ids through ngValue,
       so the DOM value is an Angular token, and a (change) handler reads
       the control before the form has been written to. */
    this.form.controls.programTypeId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.applyFloor(id));
  }

  /**
   * Holds the joining link to the mode.
   *
   * A virtual or hybrid batch is joined by its link, so it is not raised
   * without one; a physical batch has nothing to join and the control is
   * let go, rather than left invalid and blocking the form.
   */
  protected onModeChange(): void {
    const mode = this.form.value.mode;

    const link = this.form.controls.meetingLink;
    if (mode === 'Physical') {
      link.clearValidators();
      link.setValue('');
    } else {
      link.setValidators([Validators.required]);
    }
    link.updateValueAndValidity();

    const pin = this.form.controls.pincode;
    if (mode === 'Virtual') {
      pin.clearValidators();
      pin.setValue('');
    } else {
      pin.setValidators(requiredFormat('pincode'));
    }
    pin.updateValueAndValidity();
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
      districtCode: null,
      venue: '',
      pincode: '',
      meetingLink: '',
      startDate: '',
      endDate: '',
      startTime: '10:00',
      endTime: '17:00',
      maxParticipants: 30,
    });
    this.coordinators.set([]);
    this.chosenState.set(null);
    this.minParticipants.set(0);
    /* The form opens on Virtual, so the link is asked for from the outset. */
    this.onModeChange();
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
        /* A hybrid batch keeps its real venue; only a purely virtual one
           has no room to name. */
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
          this.toast.success('Program submitted', 'Awaiting permission from the operation manager.');
          this.formOpen.set(false);
          this.list.reload();
        },
        error: () => this.saving.set(false),
      });
  }

  /**
   * Accepting an agency's request to run a batch.
   *
   * Asked for first, like closing registrations and postponing beside it.
   * This was the one of the three that fired on the first click, and it is
   * the consequential one: it opens the batch for enrolment and lets it
   * run. Postponing — which can be undone — stopped to ask, while
   * approving did not.
   */
  protected async advance(programme: Program, status: ProgramStatus): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Accept permission for this program?',
      message:
        `${programme.programmeId} may then run, and registrations open for it. `
        + 'The agency and its coordinator are told.',
      confirmLabel: 'Accept permission',
    });
    if (!confirmed) return;

    /* The status route, not a full update. Update carries the whole record
       and leaves the status where it was by design, so this reported
       success and moved nothing. */
    this.service.advance(programme.id, status).subscribe(() => {
      this.toast.success('Permission accepted', programme.programmeId);
      this.list.reload();
    });
  }

  /** The batch the agency is asking to have put off, and why. */
  protected readonly askPostponeFor = signal<Program | null>(null);
  protected readonly askReason = signal('');
  protected readonly asking = signal(false);

  protected openAskPostpone(programme: Program): void {
    this.askReason.set(programme.postponementReason ?? '');
    this.askPostponeFor.set(programme);
  }

  protected confirmAskPostpone(): void {
    const programme = this.askPostponeFor();
    const reason = this.askReason().trim();
    if (!programme || reason.length === 0 || this.asking()) return;

    this.asking.set(true);
    this.service.requestPostponement(programme.id, reason).subscribe({
      next: () => {
        this.asking.set(false);
        this.askPostponeFor.set(null);
        this.toast.success('Sent to the operation manager', programme.programmeId);
        this.list.reload();
      },
      error: () => this.asking.set(false),
    });
  }

  protected textValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected numberValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** The batch being reopened, and for how many. */
  protected readonly reopenFor = signal<Program | null>(null);
  protected readonly reopenPlaces = signal(0);
  protected readonly reopening = signal(false);

  protected openReopen(programme: Program): void {
    this.reopenPlaces.set(programme.maxParticipants ?? 0);
    this.reopenFor.set(programme);
  }

  protected confirmReopen(): void {
    const programme = this.reopenFor();
    const places = Number(this.reopenPlaces());
    if (!programme || places <= 0 || this.reopening()) return;

    this.reopening.set(true);
    this.service.reopenRegistrations(programme.id, places).subscribe({
      next: () => {
        this.reopening.set(false);
        this.reopenFor.set(null);
        this.toast.success('Registrations open again', `${programme.programmeId} · ${places} places`);
        this.list.reload();
      },
      error: () => this.reopening.set(false),
    });
  }

  protected openExam(programme: Program): void {
    this.examFor.set(programme);
    this.examValue.set(
      programme.examDateTime
        ? localInput(programme.examDateTime)
        : `${programme.endDate}T15:00`,
    );
    this.examPaperId.set(programme.examPaperId ?? null);
  }

  protected saveExam(): void {
    const programme = this.examFor();
    if (!programme) return;
    /* The dedicated endpoint, not the programme update: the update contract
       carries neither the exam time nor the paper, so sending them there was
       quietly doing nothing. */
    this.service.setExamTime(programme.id, this.examValue(), this.examPaperId()).subscribe(() => {
      this.toast.success('Exam time set', programme.programmeId);
      this.examFor.set(null);
      this.list.reload();
    });
  }

  protected async postpone(programme: Program): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Postpone program?',
      message: `${programme.programmeId} moves to the postponed list and drops off the calendar.`,
      confirmLabel: 'Postpone',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.service
      .advance(programme.id, 'Postponed', 'Postponed by operations.')
      .subscribe(() => {
        this.toast.success('Program postponed', programme.programmeId);
        this.list.reload();
      });
  }
}

/**
 * An instant as a `datetime-local` input wants it: local time, to the minute,
 * with no zone marker. A stored UTC string handed straight to the input is
 * rejected by the browser, and the field comes up blank.
 */
function localInput(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
    `T${pad(when.getHours())}:${pad(when.getMinutes())}`
  );
}
