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
import { RouterLink } from '@angular/router';
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
  { key: 'programmeCode', header: 'Program ID', width: '150px' },
  { key: 'agencyName', header: 'Agency name', width: '200px' },
  { key: 'programmeName', header: 'Program', variant: 'primary', width: '230px' },
  { key: 'venue', header: 'Venue', width: '170px' },
  { key: 'startDate', header: 'Start date', width: '120px' },
  { key: 'endDate', header: 'End date', width: '120px' },
  { key: 'submitted', header: 'Submitted', width: '180px' },
  /* The decision, where the decision is being read. */
  { key: 'decision', header: 'Decision', width: '190px', align: 'center' },
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
    RouterLink,
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
      subtitle="Programs that have been conducted and whose report is waiting to be checked."
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
              placeholder="Program ID, name or agency"
            />
          </div>
        </form>
      </div>

      <app-data-table
        exportName="QC approval"
        minWidth="1450px"
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

        <!-- Only where there is a report: it is generated once the batch
             has been accepted, and it is not the agency's to hand out.
             Before that, the thing to read is the field record, which the
             program ID beside this opens. -->
        <ng-template appCell="report" let-row>
          @if (canOpenReport($any(row))) {
            <button
              type="button"
              class="btn btn--icon"
              title="Open the report"
              [disabled]="busy()"
              (click)="openReport($any(row))"
            >
              <app-icon name="file" [size]="16" />
            </button>
          } @else {
            <span class="cell-muted">—</span>
          }
        </ng-template>

        <!-- The decision, on the row. It used to live only in the sheet
             behind the program ID, so a manager looking at a queue of
             forwarded reports had nothing on screen to act with and no
             reason to think the ID was a button. Approving and forwarding
             need no words and happen here; sending back needs a reason,
             so it opens the sheet where the box is. -->
        <ng-template appCell="decision" let-row>
          @if (canDecide($any(row))) {
            <div class="row row-sm" style="justify-content: center">
              <button
                type="button"
                class="btn btn--sm btn--success"
                [disabled]="busy()"
                (click)="approveNow($any(row))"
              >
                Approve
              </button>
              <button
                type="button"
                class="btn btn--sm btn--danger"
                [disabled]="busy()"
                (click)="read($any(row))"
              >
                Send back
              </button>
            </div>
          } @else if (canForward($any(row))) {
            <div class="row row-sm" style="justify-content: center">
              <button
                type="button"
                class="btn btn--sm btn--primary"
                [disabled]="busy()"
                (click)="read($any(row))"
              >
                Forward
              </button>
            </div>
          } @else {
            <span class="cell-muted">—</span>
          }
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
            <div><span class="dl__term">Program</span><span>{{ row.programmeName }}</span></div>
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

          <!-- What the coordinator actually recorded: the venue and its
               photographs, the faculty, every session with its picture,
               the register day by day. This is what the check is made
               against, and it had no link from here at all - so the
               agency reading its coordinator's work had a handful of
               counts and a report it could not open. -->
          <div class="row row-sm row-wrap">
            <a
              class="btn btn--secondary"
              [routerLink]="['/operations/programs', row.programmeId]"
              [queryParams]="{ view: 'monitoring' }"
            >
              <app-icon name="eye" [size]="15" /> What the coordinator captured
            </a>

            <!-- The report, once there is one. It is generated when the
                 batch is accepted; before that there is nothing to open,
                 and it is not the agency's to hand out afterwards. -->
            @if (canOpenReport(row)) {
              <button type="button" class="btn btn--secondary" (click)="openReport(row)">
                <app-icon name="file" [size]="15" /> Open the full report
              </button>
              <button type="button" class="btn btn--secondary" (click)="openReport(row, true)">
                <app-icon name="download" [size]="15" /> Download
              </button>
            }
          </div>

          @if (row.qcStatus === 'AwaitingAgency' || row.qcStatus === 'Pending') {
            <p class="text-sm text-muted">
              The report is generated once quality control accepts this program.
            </p>
          }

          @if (row.forwardedOn) {
            <div class="card">
              <div class="card__header">
                <span class="card__title">Forwarded by the agency</span>
              </div>
              <div class="card__body">
                <div class="dl">
                  <div>
                    <span class="dl__term">On</span>
                    <span>{{ row.forwardedOn | date: 'dd MMM yyyy, h:mm a' }}</span>
                  </div>
                  <div>
                    <span class="dl__term">By</span><span>{{ row.forwardedBy ?? '—' }}</span>
                  </div>
                </div>
              </div>
            </div>
          }

          @if (row.qcStatus !== 'Pending' && row.qcStatus !== 'AwaitingAgency') {
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
          @if (canDecide(row) || canForward(row)) {
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

          <!-- The agency's two, while it is still theirs. -->
          @if (canForward(row)) {
            <button
              type="button"
              class="btn btn--danger"
              [disabled]="busy()"
              (click)="decide(row, 'send-back')"
            >
              <app-icon name="x" [size]="15" /> Reject
            </button>
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="busy()"
              (click)="decide(row, 'forward')"
            >
              <app-icon name="send" [size]="15" />
              {{ busy() ? 'Working…' : 'Forward to QC' }}
            </button>
          }

          <!-- And the manager's, once it has been forwarded. -->
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
  protected readonly queues: QcStatus[] =
    ['AwaitingAgency', 'Pending', 'Approved', 'Rejected'];
  protected readonly label = (queue: QcStatus) => QC_STATUS_LABELS[queue];

  /* The agency opens on its own queue and the manager on theirs, so
     neither has to know the other's step exists to find their work. */
  protected readonly tab = signal<QcStatus>(
    this.auth.hasPermission('programs.qc') ? 'Pending' : 'AwaitingAgency',
  );
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
    return queue === 'AwaitingAgency' ? held.awaitingAgency
      : queue === 'Pending' ? held.pending
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

  /**
   * The empty state says which queue is empty, not that nothing exists.
   *
   * Written out rather than built from the queue's name: lower-casing
   * the enum produced "No awaitingagency programmes", which is a line of
   * code showing through onto a government screen.
   */
  protected readonly emptyTitle = computed(() => {
    switch (this.tab()) {
      case 'AwaitingAgency':
        return 'Nothing waiting to be forwarded';
      case 'Pending':
        return 'Nothing waiting';
      case 'Approved':
        return 'No approved programs';
      default:
        return 'No rejected programs';
    }
  });

  protected readonly emptyMessage = computed(() => {
    switch (this.tab()) {
      case 'AwaitingAgency':
        return 'A conducted program appears here until its agency forwards the report.';
      case 'Pending':
        return 'Every report that was forwarded has been checked.';
      case 'Approved':
        return 'No report has passed the quality check under the current filters.';
      default:
        return 'No report has been sent back under the current filters.';
    }
  });

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
   * Accepts from the row, without opening the sheet.
   *
   * Only approving: it is the one decision that needs no words, and a
   * manager working through a queue of forwarded reports should not have
   * to open each one to say yes to it. Sending back needs a reason, so
   * that button opens the sheet where the box is.
   */
  protected approveNow(row: QcProgramme): void {
    this.remarks.setValue('');
    this.decide(row, 'approve');
  }

  /**
   * Whether this account may decide this report.
   *
   * Pending, and the account holds the quality-control key. The server
   * holds the same rule and the allocation besides; this only keeps the
   * screen from offering what would be refused.
   */
  /** The manager's decision: only on a report the agency has forwarded. */
  protected canDecide(row: QcProgramme): boolean {
    return row.qcStatus === 'Pending' && this.auth.hasPermission('programs.qc');
  }

  /**
   * The agency's step: only while the report is still with them, and
   * only for the agency that ran the batch.
   *
   * Not gated on the quality-control key. This is the agency reading
   * its own coordinator's work before passing it on, which is a
   * different act from the manager's check - and the people who do it
   * do not hold that key, which is the whole reason the step exists.
   *
   * It was gated on nothing but the queue, so every account that could
   * see the row was offered the button: the Operation Manager, who would
   * then be handing a report to themselves, and the coordinator who
   * wrote it. The server now refuses both; this stops the screen asking.
   */
  protected canForward(row: QcProgramme): boolean {
    const mine = this.auth.user()?.agencyId;
    return row.qcStatus === 'AwaitingAgency' && !!mine && mine === row.agencyId;
  }

  /**
   * Whether the report exists to be opened.
   *
   * It is generated once quality control accepts the batch, and not
   * before: the report is the scheme's statement that a programme was
   * run and passed, and there is no such statement while the question is
   * open. What the coordinator captured is read on the programme itself,
   * which is how the check is actually made and is a link on this sheet.
   *
   * And not offered in the agency's own section at all. The agency's job
   * here is to read its coordinator's work and pass it on or send it
   * back; the finished report is the scheme's, and the agency reads it
   * from Reports like everybody else.
   */
  protected canOpenReport(row: QcProgramme): boolean {
    return row.qcStatus === 'Approved' && this.auth.hasPermission('programs.qc');
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

  protected decide(
    row: QcProgramme,
    kind: 'approve' | 'reject' | 'forward' | 'send-back',
  ): void {
    const note = (this.remarks.value ?? '').trim();

    /* A refusal has to say what to put right. Forwarding and approving
       are the two that need no words. */
    if ((kind === 'reject' || kind === 'send-back') && !note) {
      this.toast.error(
        'Say why',
        kind === 'reject'
          ? 'A report sent back has to tell the agency what to put right.'
          : 'A report sent back has to tell the coordinator what to put right.');
      return;
    }

    this.busy.set(true);
    const call =
      kind === 'approve' ? this.service.approve(row.programmeId, { remarks: note })
        : kind === 'reject' ? this.service.reject(row.programmeId, { remarks: note })
          : kind === 'forward' ? this.service.forward(row.programmeId, { remarks: note })
            : this.service.sendBack(row.programmeId, { remarks: note });

    const told: Record<typeof kind, string> = {
      approve: 'Quality check passed',
      reject: 'Report sent back',
      forward: 'Forwarded for quality check',
      'send-back': 'Sent back to the coordinator',
    };

    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.reading.set(null);
        this.remarks.setValue('');
        this.toast.success(told[kind], row.programmeCode);
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
