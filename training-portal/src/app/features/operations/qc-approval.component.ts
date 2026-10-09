import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import {
  LookupItem,
  QC_STATUS_LABELS,
  QcCounts,
  QcProgramme,
  QcStatus,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/masters.service';
import { QcService } from '../../core/services/workflow.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { ListState } from '../../shared/list-state';

/*
 * The columns the scheme's own QC screen uses, in its order. A manager
 * moving between the two should not have to re-learn where the agency is.
 */
const COLUMNS: ColumnDef[] = [
  { key: 'serial', header: 'S.No', width: '64px', align: 'center' },
  { key: 'report', header: 'Report', width: '80px', align: 'center' },
  { key: 'programmeCode', header: 'Programme ID', width: '150px' },
  { key: 'agencyName', header: 'Agency name', width: '200px' },
  { key: 'programmeName', header: 'Programme', variant: 'primary', width: '230px' },
  { key: 'venue', header: 'Venue', width: '170px' },
  { key: 'startDate', header: 'Start date', width: '120px' },
  { key: 'endDate', header: 'End date', width: '120px' },
  { key: 'submitted', header: 'Submitted', width: '180px' },
];

/**
 * Quality control on conducted programmes.
 *
 * A coordinator closes a programme from the app; that seals the record
 * and puts it here. The Operation Manager reads what was actually done —
 * the report opens in a tab — and either accepts it, which makes the
 * report readable from Reports, or sends it back saying why.
 *
 * Three queues, because the question "what is waiting" and the question
 * "what did we decide" are different questions and a single list with a
 * status column answers neither well.
 */
@Component({
  selector: 'app-qc-approval',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      title="QC approval"
      subtitle="Programmes that have been conducted and whose report is waiting to be checked."
      icon="shield"
      [breadcrumbs]="[{ label: 'Operations' }, { label: 'QC approval' }]"
    />

    <section class="card">
      <div class="tabs" style="padding: 0 1rem">
        @for (queue of queues; track queue) {
          <button
            type="button"
            class="tab"
            [class.is-active]="tab() === queue"
            (click)="show(queue)"
          >
            {{ label(queue) }}
            <span class="chip" [class.chip--warn]="queue === 'Pending' && count(queue) > 0">
              {{ count(queue) }}
            </span>
          </button>
        }
      </div>

      <div class="card__body">
        <form [formGroup]="filters" class="filter-bar">
          <div class="field">
            <label class="field-label" for="qcType">Type</label>
            <select id="qcType" class="select" formControlName="programTypeId">
              <option [ngValue]="null">All types</option>
              @for (type of programTypes(); track type.id) {
                <option [ngValue]="type.id">{{ type.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="qcAgency">Agency</label>
            <select id="qcAgency" class="select" formControlName="agencyId">
              <option [ngValue]="null">All agencies</option>
              @for (agency of agencies(); track agency.id) {
                <option [ngValue]="agency.id">{{ agency.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="qcSearch">Search</label>
            <input
              id="qcSearch"
              class="input"
              type="search"
              formControlName="search"
              placeholder="Programme ID, name or agency"
            />
          </div>
        </form>
      </div>

      <app-data-table
        exportName="QC approval"
        minWidth="1260px"
        [columns]="columns"
        [rows]="rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [emptyTitle]="emptyTitle()"
        [emptyMessage]="emptyMessage()"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
      >
        <ng-template appCell="serial" let-row>
          <span class="cell-muted tabular">{{ $any(row).serial }}</span>
        </ng-template>

        <!-- The report is the thing being checked, so it is the first
             thing on the row rather than something found inside it. -->
        <ng-template appCell="report" let-row>
          <button
            type="button"
            class="btn btn--icon"
            title="Open the report"
            [disabled]="busy()"
            (click)="openReport($any(row))"
          >
            <app-icon name="file" [size]="16" />
          </button>
        </ng-template>

        <ng-template appCell="programmeCode" let-row>
          <button type="button" class="cell-link" (click)="read($any(row))">
            {{ $any(row).programmeCode }}
          </button>
        </ng-template>

        <ng-template appCell="venue" let-row>
          <span>{{ $any(row).venue || '—' }}</span>
          @if ($any(row).state) {
            <div class="cell-muted">{{ $any(row).state }}</div>
          }
        </ng-template>

        <ng-template appCell="startDate" let-row>
          {{ $any(row).startDate ? ($any(row).startDate | date: 'dd MMM yyyy') : '—' }}
        </ng-template>
        <ng-template appCell="endDate" let-row>
          {{ $any(row).endDate ? ($any(row).endDate | date: 'dd MMM yyyy') : '—' }}
        </ng-template>

        <ng-template appCell="submitted" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).submittedOn | date: 'dd MMM yyyy' }}</span>
            @if ($any(row).submittedBy) {
              <span class="cell-muted">{{ $any(row).submittedBy }}</span>
            }
            @if ($any(row).qcOn) {
              <span class="text-xs cell-muted">
                Checked {{ $any(row).qcOn | date: 'dd MMM yyyy' }}
                @if ($any(row).qcBy) { · {{ $any(row).qcBy }} }
              </span>
            }
          </div>
        </ng-template>
      </app-data-table>
    </section>

    <!-- ------------------------------------------------- the sheet ---- -->
    @if (reading(); as row) {
      <app-modal
        [title]="row.programmeName"
        [subtitle]="row.programmeCode + ' · ' + (row.agencyName ?? '')"
        size="lg"
        (closed)="reading.set(null)"
      >
        <div class="stack stack-md">
          <div class="dl">
            <div><span class="dl__term">Programme</span><span>{{ row.programmeName }}</span></div>
            <div><span class="dl__term">Type</span><span>{{ row.programTypeName ?? '—' }}</span></div>
            <div><span class="dl__term">Agency</span><span>{{ row.agencyName ?? '—' }}</span></div>
            <div>
              <span class="dl__term">Venue</span>
              <span>{{ row.venue ?? '—' }}{{ row.state ? ', ' + row.state : '' }}</span>
            </div>
            <div>
              <span class="dl__term">Ran</span>
              <span>
                {{ row.startDate ? (row.startDate | date: 'dd MMM yyyy') : '—' }}
                – {{ row.endDate ? (row.endDate | date: 'dd MMM yyyy') : '—' }}
              </span>
            </div>
            <div>
              <span class="dl__term">Closed by</span>
              <span>
                {{ row.submittedBy ?? '—' }},
                {{ row.submittedOn | date: 'dd MMM yyyy, h:mm a' }}
              </span>
            </div>
            @if (row.remarks) {
              <div>
                <span class="dl__term">Coordinator's remarks</span><span>{{ row.remarks }}</span>
              </div>
            }
          </div>

          <!-- What is in the record, counted. A report with no
               photographs or nobody present is one to open before
               deciding, and the counts say so at a glance. -->
          <div class="row row-sm row-wrap">
            <span class="chip">{{ row.trainerCount }} trainer(s)</span>
            <span class="chip">{{ row.sessionCount }} session(s)</span>
            <span class="chip">{{ row.presentCount }} of {{ row.participantCount }} present</span>
            <span class="chip" [class.chip--warn]="row.photoCount === 0">
              {{ row.photoCount }} photograph(s)
            </span>
          </div>

          <div>
            <button type="button" class="btn btn--secondary" (click)="openReport(row)">
              <app-icon name="file" [size]="15" /> Open the full report
            </button>
            <button
              type="button"
              class="btn btn--secondary"
              style="margin-left: 0.5rem"
              (click)="openReport(row, true)"
            >
              <app-icon name="download" [size]="15" /> Download
            </button>
          </div>

          @if (row.qcStatus !== 'Pending') {
            <div class="card">
              <div class="card__header">
                <span class="card__title">Quality check</span>
                <app-status-badge [value]="row.qcStatus" />
              </div>
              <div class="card__body">
                <div class="dl">
                  <div>
                    <span class="dl__term">Checked</span>
                    <span>{{ row.qcOn | date: 'dd MMM yyyy, h:mm a' }}</span>
                  </div>
                  <div><span class="dl__term">By</span><span>{{ row.qcBy ?? '—' }}</span></div>
                  @if (row.qcRemarks) {
                    <div>
                      <span class="dl__term">Remarks</span><span>{{ row.qcRemarks }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- The decision is asked for only of the manager who holds it,
               and only while there is one to take. -->
          @if (canDecide(row)) {
            <div class="field">
              <label class="field-label" for="qcRemarks">Remarks</label>
              <textarea
                id="qcRemarks"
                class="input"
                rows="3"
                [formControl]="remarks"
                placeholder="Required when sending a report back"
              ></textarea>
            </div>
          }
        </div>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="reading.set(null)">Close</button>
          @if (canDecide(row)) {
            <button
              type="button"
              class="btn btn--danger"
              [disabled]="busy()"
              (click)="decide(row, 'reject')"
            >
              <app-icon name="x" [size]="15" /> Send back
            </button>
            <button
              type="button"
              class="btn btn--success"
              [disabled]="busy()"
              (click)="decide(row, 'approve')"
            >
              <app-icon name="check" [size]="15" /> {{ busy() ? 'Working…' : 'Approve' }}
            </button>
          }
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .dl > div {
        display: grid;
        grid-template-columns: minmax(150px, 220px) 1fr;
        gap: 0.75rem;
        padding: 0.45rem 0;
        border-top: 1px solid var(--border);
      }
      .dl__term { color: var(--ink-500); font-size: var(--fs-sm); }
      .tab .chip { margin-left: 0.4rem; }
    `,
  ],
})
export class QcApprovalComponent {
  private readonly service = inject(QcService);
  private readonly lookups = inject(LookupService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = COLUMNS;
  protected readonly queues: QcStatus[] = ['Pending', 'Approved', 'Rejected'];
  protected readonly label = (queue: QcStatus) => QC_STATUS_LABELS[queue];

  protected readonly tab = signal<QcStatus>('Pending');
  protected readonly reading = signal<QcProgramme | null>(null);
  protected readonly busy = signal(false);

  protected readonly remarks = this.fb.control('');

  protected readonly filters = this.fb.group({
    programTypeId: [null as number | null],
    agencyId: [null as number | null],
    search: [''],
  });

  protected readonly programTypes = toSignal(this.lookups.programTypes(null, null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly agencies = toSignal(this.lookups.agencies(), {
    initialValue: [] as LookupItem[],
  });

  private readonly counts = signal<QcCounts | null>(null);

  protected count(queue: QcStatus): number {
    const held = this.counts();
    if (!held) return 0;
    return queue === 'Pending' ? held.pending
      : queue === 'Approved' ? held.approved
        : held.rejected;
  }

  protected readonly list = new ListState<QcProgramme>(
    (request) => this.service.list({ ...request, status: this.tab() }),
    { pageSize: 25 },
  );

  /* Numbered down the page, continuing across pages rather than
     restarting at one on each. */
  protected readonly rows = computed(() =>
    this.list.rows().map((row, i) => ({
      ...row,
      serial: (this.list.page() - 1) * this.list.pageSize() + i + 1,
    })),
  );

  /** The empty state says which queue is empty, not that nothing exists. */
  protected readonly emptyTitle = computed(() =>
    this.tab() === 'Pending' ? 'Nothing waiting' : `No ${this.tab().toLowerCase()} programmes`);

  protected readonly emptyMessage = computed(() =>
    this.tab() === 'Pending'
      ? 'Every conducted programme has been checked.'
      : 'Nothing has been ' + this.tab().toLowerCase() + ' under the current filters.');

  constructor() {
    /* The filters belong to the queue, not to a tab, so switching tabs
       keeps them and re-reads. */
    this.filters.valueChanges.subscribe((value) => {
      this.list.setFilter('programTypeId', value.programTypeId);
      this.list.setFilter('agencyId', value.agencyId);
      this.list.setSearch(value.search ?? '');
      this.loadCounts();
    });

    effect(() => {
      /* Reading the tab inside the effect is what subscribes it. */
      this.tab();
      this.list.reload();
    });

    this.loadCounts();
    this.destroyRef.onDestroy(() => this.revoke());
  }

  protected show(queue: QcStatus): void {
    if (this.tab() === queue) return;
    this.tab.set(queue);
  }

  protected read(row: QcProgramme): void {
    this.remarks.setValue('');
    this.reading.set(row);
  }

  /**
   * Whether this account may decide this report.
   *
   * Pending, and the account holds the quality-control key. The server
   * holds the same rule and the allocation besides; this only keeps the
   * screen from offering what would be refused.
   */
  protected canDecide(row: QcProgramme): boolean {
    return row.qcStatus === 'Pending' && this.auth.hasPermission('programs.qc');
  }

  /**
   * Opens the report in a tab, or saves it.
   *
   * Fetched rather than linked because the endpoint needs the bearer
   * token. The object URL is released when this screen closes, which is
   * why they are kept rather than created and forgotten.
   */
  protected openReport(row: QcProgramme, download = false): void {
    this.busy.set(true);

    this.service.report(row.programmeId, download).subscribe({
      next: (blob) => {
        this.busy.set(false);
        const url = URL.createObjectURL(blob);
        this.held.push(url);

        if (download) {
          const link = document.createElement('a');
          link.href = url;
          link.download = `${row.programmeCode}-report.html`;
          link.click();
        } else {
          window.open(url, '_blank', 'noopener');
        }
      },
      error: () => this.busy.set(false),
    });
  }

  private readonly held: string[] = [];

  private revoke(): void {
    for (const url of this.held) URL.revokeObjectURL(url);
    this.held.length = 0;
  }

  protected decide(row: QcProgramme, kind: 'approve' | 'reject'): void {
    const note = (this.remarks.value ?? '').trim();

    if (kind === 'reject' && !note) {
      this.toast.error(
        'Say why',
        'A report sent back has to tell the agency what to put right.');
      return;
    }

    this.busy.set(true);
    const call = kind === 'approve'
      ? this.service.approve(row.programmeId, { remarks: note })
      : this.service.reject(row.programmeId, { remarks: note });

    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.reading.set(null);
        this.toast.success(
          kind === 'approve' ? 'Quality check passed' : 'Report sent back',
          row.programmeCode);
        this.list.reload();
        this.loadCounts();
      },
      error: () => this.busy.set(false),
    });
  }

  private loadCounts(): void {
    const value = this.filters.getRawValue();
    this.service
      .counts({
        programTypeId: value.programTypeId ?? undefined,
        agencyId: value.agencyId ?? undefined,
      })
      .subscribe({
        next: (counts) => this.counts.set(counts),
        error: () => this.counts.set(null),
      });
  }
}
