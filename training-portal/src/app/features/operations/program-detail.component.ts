import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AttendanceMark,
  Certificate,
  Program,
  ProgramSession,
  ProgrammeCertificateSummary,
} from '../../core/models';
import { CertificateService } from '../../core/services/certificate.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ProgramService } from '../../core/services/workflow.service';
import { IconComponent } from '../../shared/components/icon.component';
import { MarksheetComponent } from './marksheet.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type Tab = 'sessions' | 'participants' | 'marksheet' | 'certificates';

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
    MarksheetComponent,
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
              <div class="dl__term">State/UT</div>
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
              <div class="dl__value tabular">
                {{ batch.participantCount }} / {{ batch.maxParticipants }}
                @if (batch.participantCount >= batch.maxParticipants) {
                  <span class="chip">Full — registration closed</span>
                } @else if (batch.registrationsOpen) {
                  <span class="text-xs text-muted">
                    {{ batch.maxParticipants - batch.participantCount }} place{{
                      batch.maxParticipants - batch.participantCount === 1 ? '' : 's'
                    }}
                    left
                  </span>
                }
              </div>
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

      @if (isPublic()) {
        <section class="card mb-md">
          <div class="card__body share">
            <div class="stack stack-xs share__text">
              <strong class="text-sm">Registration link</strong>
              <span class="text-xs text-muted">
                Anyone with this link can see the batch and how many places are left. It stops
                accepting registrations on its own once the batch is full.
              </span>
            </div>
            <div class="share__row">
              <input class="input share__url" readonly [value]="shareUrl()" (focus)="selectAll($event)" />
              <button type="button" class="btn btn--secondary" (click)="copyLink()">
                {{ copied() ? 'Copied' : 'Copy' }}
              </button>
              <a class="btn btn--ghost" [href]="shareUrl()" target="_blank" rel="noopener">Open</a>
            </div>
          </div>
        </section>
      }

      <section class="card">
        <div class="tabs" style="padding: 0 1rem">
          <button type="button" class="tab" [class.is-active]="tab() === 'sessions'" (click)="tab.set('sessions')">
            Sessions ({{ batch.sessions.length }})
          </button>
          <button type="button" class="tab" [class.is-active]="tab() === 'participants'" (click)="tab.set('participants')">
            Participants ({{ batch.participants.length }})
          </button>
          <button
            type="button"
            class="tab"
            [class.is-active]="tab() === 'marksheet'"
            (click)="tab.set('marksheet')"
          >
            {{ copy.text('marksheet.tab') }}
          </button>
          <button
            type="button"
            class="tab"
            [class.is-active]="tab() === 'certificates'"
            (click)="openCertificates()"
          >
            Certificates{{ certificates() ? ' (' + certificates()!.issued + ')' : '' }}
          </button>
        </div>

        <!-- Mounted only while the tab is open, so the sheet is fetched when
             somebody asks for it and re-read fresh next time. -->
        @if (tab() === 'marksheet') {
          <app-marksheet [programmeId]="batch.id" />
        }

        @if (tab() === 'certificates') {
          @if (certificates(); as certs) {
            <div class="card__body stack stack-md">
              <div class="cert-head">
                <div class="stack stack-xs">
                  <strong class="text-sm">{{ certs.certificationPolicyLabel }}</strong>
                  <span class="text-xs text-muted">
                    {{ certs.issued }} issued · {{ certs.pending }} ready to issue ·
                    {{ certs.notEligible }} not eligible
                  </span>
                </div>
                <div class="btn-row btn-row--end">
                  @if (certs.issued > 0) {
                    <a
                      class="btn btn--secondary"
                      [href]="programmeDocumentUrl(certs.programmeId)"
                      target="_blank"
                      rel="noopener"
                      >Print all</a
                    >
                  }
                  @if (certs.pending > 0) {
                    <button
                      type="button"
                      class="btn btn--primary"
                      [disabled]="issuing()"
                      (click)="issueAll(certs.programmeId)"
                    >
                      @if (issuing()) { <span class="spinner"></span> }
                      Issue {{ certs.pending }} certificate{{ certs.pending === 1 ? '' : 's' }}
                    </button>
                  }
                </div>
              </div>

              @if (certs.missingTemplates.length > 0) {
                <div class="alert alert--warning">
                  <app-icon name="alert" [size]="16" />
                  <span>
                    No artwork uploaded for
                    {{ certs.missingTemplates.join(' and ') }}. Certificates will print on a
                    plain layout until a template is added on the programme type.
                  </span>
                </div>
              }
            </div>

            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th style="width: 110px">Result</th>
                    <th style="width: 200px">Awards</th>
                    <th style="width: 190px">Number</th>
                    <th style="width: 210px"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of certs.participants; track row.participantId) {
                    <tr>
                      <td class="cell-primary">{{ row.name }}</td>
                      <td><app-status-badge [value]="row.result" /></td>
                      <td class="cell-muted">
                        {{ row.kindLabel || '—' }}
                        @if (row.blocker) {
                          <div class="text-xs text-muted">{{ row.blocker }}</div>
                        }
                      </td>
                      <td class="cell-muted tabular">{{ row.certificate?.number || '—' }}</td>
                      <td>
                        <div class="btn-row btn-row--end">
                          @if (row.certificate; as cert) {
                            <a
                              class="btn btn--ghost btn--sm"
                              [href]="documentUrl(cert.id)"
                              target="_blank"
                              rel="noopener"
                              >View</a
                            >
                            <button
                              type="button"
                              class="btn btn--ghost btn--sm"
                              (click)="revoke(cert)"
                            >
                              Revoke
                            </button>
                          } @else if (row.canIssue) {
                            <button
                              type="button"
                              class="btn btn--secondary btn--sm"
                              [disabled]="issuing()"
                              (click)="issueOne(row.participantId)"
                            >
                              Issue
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="cell-muted text-center">No participants enrolled yet.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="card__body"><span class="text-sm text-muted">Loading certificates…</span></div>
          }
        }

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
        } @else if (tab() === 'participants') {
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
      .share { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
      .share__text { flex: 1; min-width: 220px; }
      .share__row { display: flex; align-items: center; gap: 0.5rem; }
      .share__url { min-width: 300px; font-size: var(--fs-xs); font-family: ui-monospace, monospace; }
    `,
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
  protected readonly copy = inject(SiteTextService);
  private readonly fb = inject(FormBuilder);

  readonly id = input.required<string>();

  protected readonly programme = signal<Program | null>(null);
  protected readonly tab = signal<Tab>('sessions');

  /* ------------------------------------------------- registration link */

  protected readonly copied = signal(false);

  /** A batch only has a public page once somebody has approved it. */
  protected readonly isPublic = computed(() => {
    const status = this.programme()?.status;
    return status === 'PermissionAccepted' || status === 'CalendarCreated';
  });

  /**
   * The shareable address.
   *
   * Built from the browser's own origin rather than from configuration: the
   * portal is served from wherever it is deployed, and a link copied out of it
   * should point back at that same place.
   */
  protected readonly shareUrl = computed(() => {
    const code = this.programme()?.programmeId ?? '';
    /* Slashes in an older code cannot survive a path segment; the public
       endpoint accepts the hyphenated form of the same code. */
    return `${window.location.origin}/p/${code.replace(/\//g, '-')}`;
  });

  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      /* A blocked clipboard is not worth an error dialog — the field beside
         the button is readable and selectable for exactly this case. */
      this.toast.info('Copy the link', 'Select the address and copy it.');
    }
  }

  /* ---------------------------------------------------- certificates */

  private readonly certificateService = inject(CertificateService);
  private readonly confirm = inject(ConfirmService);

  protected readonly certificates = signal<ProgrammeCertificateSummary | null>(null);
  protected readonly issuing = signal(false);

  /** Loaded when the tab is first opened, not with the page: most visits never open it. */
  protected openCertificates(): void {
    this.tab.set('certificates');
    if (this.certificates()) return;
    this.loadCertificates();
  }

  private loadCertificates(): void {
    const batch = this.programme();
    if (!batch) return;
    this.certificateService.summary(batch.id).subscribe((summary) => this.certificates.set(summary));
  }

  protected documentUrl(id: number): string {
    return this.certificateService.documentUrl(id);
  }

  protected programmeDocumentUrl(programmeId: number): string {
    return this.certificateService.programmeDocumentUrl(programmeId);
  }

  protected issueOne(participantId: number): void {
    this.issuing.set(true);
    this.certificateService.issue(participantId).subscribe({
      next: (certificate) => {
        this.issuing.set(false);
        this.toast.success('Certificate issued', certificate.number);
        this.refreshAfterIssue();
      },
      error: () => this.issuing.set(false),
    });
  }

  protected async issueAll(programmeId: number): Promise<void> {
    const pending = this.certificates()?.pending ?? 0;
    const ok = await this.confirm.ask({
      title: `Issue ${pending} certificate${pending === 1 ? '' : 's'}?`,
      message:
        'Each one takes the next number in the series. A certificate issued in error can be ' +
        'revoked, but its number is not reused.',
      confirmLabel: 'Issue',
    });
    if (!ok) return;

    this.issuing.set(true);
    this.certificateService.issueProgramme(programmeId).subscribe({
      next: (summary) => {
        this.issuing.set(false);
        this.certificates.set(summary);
        this.toast.success('Certificates issued', `${summary.issued} in total.`);
        this.reloadProgramme();
      },
      error: () => this.issuing.set(false),
    });
  }

  protected async revoke(certificate: Certificate): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Revoke ${certificate.number}?`,
      message:
        `${certificate.recipientName}'s certificate will be marked revoked and will fail ` +
        'verification. The number stays spent; a corrected certificate takes a new one.',
      confirmLabel: 'Revoke',
      tone: 'danger',
    });
    if (!ok) return;

    /* A reason is required by the API, and a revocation with no stated cause is
       not worth recording. */
    const reason = window.prompt('Why is it being revoked?')?.trim();
    if (!reason) return;

    this.certificateService.revoke(certificate.id, reason).subscribe(() => {
      this.toast.success('Certificate revoked', certificate.number);
      this.refreshAfterIssue();
    });
  }

  private refreshAfterIssue(): void {
    this.loadCertificates();
    this.reloadProgramme();
  }

  /** The participants table shows the certificate number, so it reloads too. */
  private reloadProgramme(): void {
    const batch = this.programme();
    if (batch) this.service.getById(batch.id).subscribe((updated) => this.programme.set(updated));
  }
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
