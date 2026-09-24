import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AttendanceMark, Program, ProgramSession } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgramService } from '../../core/services/workflow.service';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type Tab = 'sessions' | 'participants';

@Component({
  selector: 'app-program-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    PageHeaderComponent,
    StatusBadgeComponent,
    ModalComponent,
    IconComponent,
  ],
  template: `
    @if (programme(); as batch) {
      <app-page-header
        [title]="batch.programmeName"
        [subtitle]="batch.programmeId + ' · ' + batch.agencyName"
        icon="calendar"
        [breadcrumbs]="[
          { label: 'Operations' },
          { label: 'Programmes', link: '/operations/programs' },
          { label: batch.programmeId }
        ]"
      >
        <a class="btn btn--secondary" routerLink="/operations/programs">
          <app-icon name="chevron-left" [size]="15" /> Back
        </a>
        @if (canManage()) {
          <button type="button" class="btn btn--primary" (click)="openSession()">
            <app-icon name="plus" [size]="15" /> Add session
          </button>
        }
      </app-page-header>

      <section class="card mb-md">
        <div class="card__body">
          <div class="dl">
            <div>
              <div class="dl__term">Status</div>
              <div class="dl__value"><app-status-badge [value]="batch.status" /></div>
            </div>
            <div>
              <div class="dl__term">Mode</div>
              <div class="dl__value">
                <div class="row row-sm">
                  <app-icon [name]="batch.mode === 'Virtual' ? 'monitor' : 'map-pin'" [size]="15" />
                  <span>{{ batch.mode }}</span>
                </div>
              </div>
            </div>
            <div>
              <div class="dl__term">{{ batch.mode === 'Virtual' ? 'Platform' : 'Venue' }}</div>
              <div class="dl__value">
                {{ batch.mode === 'Virtual' ? batch.meetingPlatform : batch.venue }}
              </div>
            </div>
            <div>
              <div class="dl__term">State</div>
              <div class="dl__value">{{ batch.state }}</div>
            </div>
            <div>
              <div class="dl__term">Dates</div>
              <div class="dl__value">
                {{ batch.startDate | date: 'dd MMM yyyy' }} – {{ batch.endDate | date: 'dd MMM yyyy' }}
              </div>
            </div>
            <div>
              <div class="dl__term">Coordinator</div>
              <div class="dl__value">{{ batch.coordinatorName }}</div>
            </div>
            <div>
              <div class="dl__term">Operation manager</div>
              <div class="dl__value">{{ batch.operationManagerName }}</div>
            </div>
            <div>
              <div class="dl__term">Participants</div>
              <div class="dl__value tabular">{{ batch.participantCount }} / {{ batch.seatCapacity }}</div>
            </div>
            <div>
              <div class="dl__term">Exam</div>
              <div class="dl__value">
                {{ batch.examDateTime ? (batch.examDateTime | date: 'dd MMM yyyy, HH:mm') : 'Not scheduled' }}
              </div>
            </div>
            @if (batch.mode === 'Virtual' && batch.meetingLink) {
              <div>
                <div class="dl__term">Meeting link</div>
                <div class="dl__value">
                  <a [href]="batch.meetingLink" target="_blank" rel="noopener">
                    Join <app-icon name="external" [size]="13" />
                  </a>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <section class="card">
        <div class="tabs" style="padding: 0 1rem">
          <button type="button" class="tab" [class.is-active]="tab() === 'sessions'" (click)="tab.set('sessions')">
            Sessions ({{ batch.sessions.length }})
          </button>
          <button type="button" class="tab" [class.is-active]="tab() === 'participants'" (click)="tab.set('participants')">
            Participants ({{ batch.participants.length }})
          </button>
        </div>

        @if (tab() === 'sessions') {
          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th style="width: 180px">Session code</th>
                  <th>Session</th>
                  <th style="width: 130px">Date</th>
                  <th style="width: 130px">Time</th>
                  <th>Faculty</th>
                  <th style="width: 120px" class="text-center">Present</th>
                  <th class="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                @for (session of batch.sessions; track session.id) {
                  <tr>
                    <td class="cell-muted">{{ session.sessionCode || '—' }}</td>
                    <td class="cell-primary">{{ session.title }}</td>
                    <td>{{ session.sessionDate | date: 'dd MMM yyyy' }}</td>
                    <td class="cell-muted">{{ session.startTime }} – {{ session.endTime }}</td>
                    <td class="cell-muted">{{ session.facultyName || '—' }}</td>
                    <td class="text-center tabular">
                      {{ session.presentCount }} / {{ batch.participants.length }}
                    </td>
                    <td class="col-actions">
                      @if (canManage() && !session.isAttendanceLocked) {
                        <button type="button" class="btn btn--sm btn--secondary" (click)="openAttendance(session)">
                          Mark attendance
                        </button>
                      } @else {
                        <span class="chip">Locked</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="cell-muted text-center">No sessions captured yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th style="width: 170px">Application no.</th>
                  <th style="width: 120px" class="text-center">Attendance</th>
                  <th style="width: 100px" class="text-center">Score</th>
                  <th style="width: 110px">Result</th>
                  <th style="width: 190px">Certificate</th>
                </tr>
              </thead>
              <tbody>
                @for (participant of batch.participants; track participant.id) {
                  <tr>
                    <td>
                      <div class="cell-primary">{{ participant.name }}</div>
                      <div class="cell-muted">{{ participant.email }}</div>
                    </td>
                    <td class="cell-muted">{{ participant.applicationNo }}</td>
                    <td class="text-center tabular">{{ participant.attendancePercent }}%</td>
                    <td class="text-center tabular">{{ participant.examScore ?? '—' }}</td>
                    <td>
                      @if (participant.result) {
                        <app-status-badge [value]="participant.result" />
                      }
                    </td>
                    <td class="cell-muted">{{ participant.certificateNo || 'Not issued' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="cell-muted text-center">No participants enrolled yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    } @else {
      <div class="card" style="height: 240px"></div>
    }

    @if (sessionFormOpen()) {
      <app-modal title="Add session" size="sm" (closed)="sessionFormOpen.set(false)">
        <form [formGroup]="sessionForm" id="batch-session-form" (ngSubmit)="saveSession()" class="stack stack-md">
          <div class="field">
            <label class="field-label" for="bsTitle">Session title <span class="req">*</span></label>
            <input id="bsTitle" class="input" formControlName="title" />
          </div>
          <div class="field">
            <label class="field-label" for="bsDate">Date</label>
            <input id="bsDate" type="date" class="input" formControlName="sessionDate" />
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="bsStart">Start</label>
              <input id="bsStart" type="time" class="input" formControlName="startTime" />
            </div>
            <div class="field">
              <label class="field-label" for="bsEnd">End</label>
              <input id="bsEnd" type="time" class="input" formControlName="endTime" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="bsFaculty">Faculty</label>
            <input id="bsFaculty" class="input" formControlName="facultyName" />
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="sessionFormOpen.set(false)">Cancel</button>
          <button type="submit" form="batch-session-form" class="btn btn--primary">Add session</button>
        </div>
      </app-modal>
    }

    @if (attendanceFor(); as session) {
      <app-modal
        title="Mark attendance"
        [subtitle]="session.title"
        size="md"
        (closed)="attendanceFor.set(null)"
      >
        <div class="stack stack-sm">
          <div class="row row-between">
            <span class="text-sm text-muted">{{ presentCount() }} of {{ marks().length }} present</span>
            <div class="btn-row">
              <button type="button" class="btn btn--sm btn--secondary" (click)="setAll(true)">All present</button>
              <button type="button" class="btn btn--sm btn--secondary" (click)="setAll(false)">All absent</button>
            </div>
          </div>
          @for (mark of marks(); track mark.participantId) {
            <label class="attendance-row">
              <input type="checkbox" [checked]="mark.present" (change)="toggle(mark.participantId, $event)" />
              <span class="flex-1">{{ nameOf(mark.participantId) }}</span>
              <span class="chip">{{ mark.present ? 'Present' : 'Absent' }}</span>
            </label>
          }
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="attendanceFor.set(null)">Cancel</button>
          <button type="button" class="btn btn--primary" (click)="saveAttendance()">Save attendance</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .attendance-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        cursor: pointer;
      }
      .attendance-row:hover { background: var(--brand-50); }
      .attendance-row input { width: 16px; height: 16px; accent-color: var(--brand-600); }
    `,
  ],
})
export class ProgramDetailComponent {
  private readonly service = inject(ProgramService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly id = input.required<string>();

  protected readonly programme = signal<Program | null>(null);
  protected readonly tab = signal<Tab>('sessions');
  protected readonly sessionFormOpen = signal(false);
  protected readonly attendanceFor = signal<ProgramSession | null>(null);
  protected readonly marks = signal<AttendanceMark[]>([]);

  protected readonly canManage = computed(() => this.auth.hasPermission('programs.manage'));
  protected readonly presentCount = computed(() => this.marks().filter((m) => m.present).length);

  protected readonly sessionForm = this.fb.group({
    title: ['', Validators.required],
    sessionDate: [''],
    startTime: ['10:00'],
    endTime: ['17:00'],
    facultyName: [''],
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      if (!id) return;
      this.service.getById(id).subscribe((row) => this.programme.set(row));
    });
  }

  protected openSession(): void {
    const batch = this.programme();
    this.sessionForm.reset({
      title: '',
      sessionDate: batch?.startDate ?? '',
      startTime: '10:00',
      endTime: '17:00',
      facultyName: '',
    });
    this.sessionFormOpen.set(true);
  }

  protected saveSession(): void {
    const batch = this.programme();
    if (!batch || this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      return;
    }
    this.service.addSession(batch.id, this.sessionForm.getRawValue()).subscribe((updated) => {
      this.programme.set(updated);
      this.sessionFormOpen.set(false);
      this.toast.success('Session added', this.sessionForm.value.title ?? '');
    });
  }

  protected openAttendance(session: ProgramSession): void {
    const batch = this.programme();
    if (!batch) return;
    this.attendanceFor.set(session);
    this.marks.set(batch.participants.map((p) => ({ participantId: p.id, present: true })));
  }

  protected nameOf(participantId: number): string {
    return this.programme()?.participants.find((p) => p.id === participantId)?.name ?? '';
  }

  protected toggle(participantId: number, event: Event): void {
    const present = (event.target as HTMLInputElement).checked;
    this.marks.update((list) =>
      list.map((m) => (m.participantId === participantId ? { ...m, present } : m)),
    );
  }

  protected setAll(present: boolean): void {
    this.marks.update((list) => list.map((m) => ({ ...m, present })));
  }

  protected saveAttendance(): void {
    const batch = this.programme();
    const session = this.attendanceFor();
    if (!batch || !session) return;
    this.service.markAttendance(batch.id, session.id, this.marks()).subscribe((updated) => {
      this.programme.set(updated);
      this.attendanceFor.set(null);
      this.toast.success('Attendance saved', `${this.presentCount()} marked present.`);
    });
  }
}
