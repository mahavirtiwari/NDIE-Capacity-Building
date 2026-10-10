import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Application,
  ApplicationCounts,
  AttendanceMark,
  Id,
  PagedResult,
  ProfileDecision,
  ProfilePhoto,
  ProfileScrutinyCounts,
  ProfileSubmission,
  Program,
  ProgrammeMonitoring,
  QcCounts,
  QcDecision,
  QcProgramme,
  RejectionReason,
  RejectionReasonUpsert,
  ScrutinyDecision,
  StateCoverageResult,
} from '../models';
import { ApiService } from './api.service';
import { CrudService } from './crud.service';

/**
 * The profile queue: applicants waiting to be let into their discipline.
 *
 * Read before applications, because an applicant has none until their
 * profile has been accepted.
 */
@Injectable({ providedIn: 'root' })
export class ProfileSubmissionService extends CrudService<ProfileSubmission> {
  protected readonly resource = 'profile-submissions';

  /* Straight to HttpClient for the image bytes: ApiService unwraps the
     envelope every other call comes in, and a JPEG has no envelope. */
  private readonly http = inject(HttpClient);

  approve(id: Id, decision: ProfileDecision): Observable<ProfileSubmission> {
    return this.api.post<ProfileSubmission>(`${this.resource}/${id}/approve`, decision);
  }

  reject(id: Id, decision: ProfileDecision): Observable<ProfileSubmission> {
    return this.api.post<ProfileSubmission>(`${this.resource}/${id}/reject`, decision);
  }

  /** Moves a profile to another Operation Manager, or to nobody. */
  assign(id: Id, userId: Id | null): Observable<ProfileSubmission> {
    return this.api.patch<ProfileSubmission>(`${this.resource}/${id}/assign`, { userId });
  }

  /** The counters over the queue, under the same filters as the list. */
  counts(query: Record<string, unknown>): Observable<ProfileScrutinyCounts> {
    return this.api.get<ProfileScrutinyCounts>(`${this.resource}/counts`, query);
  }

  /**
   * The pictures held for one camera field, in the order they were taken.
   *
   * Metadata only. Each image is fetched separately, because the officer
   * may never scroll as far as the fifth one and a profile with twenty
   * photographs should not be twenty megabytes of response.
   */
  photos(id: Id, fieldKey: string): Observable<ProfilePhoto[]> {
    return this.api.get<ProfilePhoto[]>(
      `${this.resource}/${id}/photos/${encodeURIComponent(fieldKey)}`);
  }

  /**
   * One of those pictures.
   *
   * Fetched rather than pointed at: the endpoint needs the bearer token
   * and an <img src> would not carry one. The caller makes an object URL
   * of what comes back and revokes it when the screen closes.
   */
  photo(id: Id, fieldKey: string, displayOrder: number): Observable<Blob> {
    return this.http.get(
      this.api.fileUrl(
        `${this.resource}/${id}/photos/${encodeURIComponent(fieldKey)}/${displayOrder}`),
      { responseType: 'blob' });
  }
}

@Injectable({ providedIn: 'root' })
export class ApplicationService extends CrudService<Application> {
  protected readonly resource = 'applications';

  decide(decision: ScrutinyDecision): Observable<Application> {
    return this.api.post<Application>(
      `${this.resource}/${decision.applicationId}/scrutiny`,
      decision,
    );
  }

  /** The counters over the queue, under the same filters as the list. */
  counts(query: Record<string, unknown>): Observable<ApplicationCounts> {
    return this.api.get<ApplicationCounts>(`${this.resource}/counts`, query);
  }

  assign(id: Id, userId: Id): Observable<Application> {
    return this.api.patch<Application>(`${this.resource}/${id}/assign`, { userId });
  }

  verifyDocument(id: Id, documentId: Id, verified: boolean, remarks?: string) {
    return this.api.patch<Application>(`${this.resource}/${id}/documents/${documentId}`, {
      verified,
      remarks,
    });
  }
}

@Injectable({ providedIn: 'root' })
export class ProgramService extends CrudService<Program> {
  protected readonly resource = 'programs';

  /* Straight to HttpClient for the image bytes: ApiService unwraps the
     JSON envelope every other response comes in, and a JPEG has none. */
  private readonly http = inject(HttpClient);

  /**
   * What the coordinator recorded on the ground for this batch.
   *
   * A second call rather than part of the programme: the office's record
   * of a batch is read on every visit, and the field record — venue,
   * faculty, sessions, the register and the photographs — is read by the
   * manager checking it and by nobody else.
   */
  monitoring(id: Id): Observable<ProgrammeMonitoring> {
    return this.api.get<ProgrammeMonitoring>(`${this.resource}/${id}/monitoring`);
  }

  /**
   * One photograph off that record.
   *
   * Fetched rather than pointed at: the endpoint needs the bearer token
   * and an <img src> would not carry one. The caller makes an object URL
   * of what comes back and revokes it when the screen closes.
   */
  photo(id: Id, photoId: Id): Observable<Blob> {
    return this.http.get(
      this.api.fileUrl(`${this.resource}/${id}/photos/${photoId}`),
      { responseType: 'blob' });
  }

  /**
   * Moves a batch along its workflow: permission accepted, postponed, and
   * the rest.
   *
   * Its own route, because editing a batch and deciding one are different
   * acts. A full update carries the whole record and deliberately leaves
   * the status alone, so sending a decision that way changed nothing while
   * reporting success.
   */
  advance(id: Id, status: string, comments?: string): Observable<Program> {
    return this.api.patch<Program>(`${this.resource}/${id}/status`, { status, comments });
  }

  /**
   * Asks the operation manager to put a batch off, and says why.
   *
   * The batch does not move: the agency running it knows the hall has
   * flooded, and the manager that permitted it decides.
   */
  requestPostponement(programId: Id, reason: string): Observable<Program> {
    return this.api.post<Program>(
      `${this.resource}/${programId}/postponement-request`,
      { reason },
    );
  }

  /**
   * Opens a batch for registration again, for a stated number of places.
   *
   * There is no closing by hand: a batch closes itself when it fills.
   */
  reopenRegistrations(programId: Id, maxParticipants: number): Observable<Program> {
    return this.api.post<Program>(
      `${this.resource}/${programId}/reopen-registrations`,
      { maxParticipants },
    );
  }

  addSession(programId: Id, session: Record<string, unknown>): Observable<Program> {
    return this.api.post<Program>(`${this.resource}/${programId}/sessions`, session);
  }

  markAttendance(programId: Id, sessionId: Id, marks: AttendanceMark[]): Observable<Program> {
    return this.api.post<Program>(
      `${this.resource}/${programId}/sessions/${sessionId}/attendance`,
      { marks },
    );
  }

  enrol(programId: Id, applicationIds: Id[]): Observable<Program> {
    return this.api.post<Program>(`${this.resource}/${programId}/enrol`, { applicationIds });
  }

  /**
   * Schedules the examination, and says which paper the batch sits online.
   *
   * Its own endpoint rather than part of the programme update: the update
   * contract carries none of this, and sending it there was quietly doing
   * nothing.
   */
  setExamTime(programId: Id, examDateTime: string, examPaperId?: Id | null): Observable<Program> {
    return this.api.post<Program>(`${this.resource}/${programId}/exam-time`, {
      examDateTime,
      examPaperId: examPaperId ?? null,
    });
  }
}

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  suffix?: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  icon: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface DashboardData {
  kpis: DashboardKpi[];
  programsByMonth: SeriesPoint[];
  /** Counted over programme participants, matching the "Candidates participated" KPI. */
  participantsByGender: SeriesPoint[];
  participantsBySocialCategory: SeriesPoint[];
}

export interface DashboardFilters {
  categoryId?: number | null;
  subCategoryId?: number | null;
  programTypeId?: number | null;
  agencyId?: number | null;
  state?: string | null;
  mode?: string | null;
  /** Rolling window in months; 0 means the full history. */
  months?: number | null;
  /**
   * An explicit window, for periods a rolling one cannot express — a financial
   * year, a closed quarter, one campaign. Either end may be left open, and
   * when either is set it takes precedence over `months`.
   */
  fromDate?: string | null;
  toDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  load(filters: DashboardFilters = {}): Observable<DashboardData> {
    return this.api.get<DashboardData>('dashboard', filters as Record<string, unknown>);
  }

  /** Programme reach by state, for the map. */
  stateCoverage(filters: DashboardFilters = {}): Observable<StateCoverageResult> {
    return this.api.get<StateCoverageResult>(
      'dashboard/state-coverage',
      filters as Record<string, unknown>,
    );
  }
}

/**
 * The reasons an application may be turned down.
 *
 * Read by anyone who scrutinises, because they pick from it; written from
 * System Settings, because it is a list the scheme reports against.
 */
@Injectable({ providedIn: 'root' })
export class RejectionReasonService {
  private readonly api = inject(ApiService);
  private readonly resource = 'rejection-reasons';

  list(activeOnly = false): Observable<RejectionReason[]> {
    return this.api.get<RejectionReason[]>(this.resource, { activeOnly });
  }

  create(payload: RejectionReasonUpsert): Observable<RejectionReason> {
    return this.api.post<RejectionReason>(this.resource, payload);
  }

  update(id: Id, payload: RejectionReasonUpsert): Observable<RejectionReason> {
    return this.api.put<RejectionReason>(`${this.resource}/${id}`, payload);
  }

  remove(id: Id): Observable<boolean> {
    return this.api.delete<boolean>(`${this.resource}/${id}`);
  }
}

/**
 * Quality control on conducted programmes.
 *
 * Three queues over one register. The decision is the Operation
 * Manager's; everybody else reads, which is enforced on the server and
 * only reflected here.
 */
@Injectable({ providedIn: 'root' })
export class QcService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  list(query: Record<string, unknown>): Observable<PagedResult<QcProgramme>> {
    return this.api.get<PagedResult<QcProgramme>>('qc/programmes', query);
  }

  counts(query: Record<string, unknown>): Observable<QcCounts> {
    return this.api.get<QcCounts>('qc/counts', query);
  }

  get(programmeId: Id): Observable<QcProgramme> {
    return this.api.get<QcProgramme>(`qc/programmes/${programmeId}`);
  }

  approve(programmeId: Id, decision: QcDecision): Observable<QcProgramme> {
    return this.api.post<QcProgramme>(`qc/programmes/${programmeId}/approve`, decision);
  }

  reject(programmeId: Id, decision: QcDecision): Observable<QcProgramme> {
    return this.api.post<QcProgramme>(`qc/programmes/${programmeId}/reject`, decision);
  }

  /**
   * The report, as a page.
   *
   * Fetched rather than linked: the endpoint needs the bearer token,
   * which a plain anchor cannot carry. The caller makes an object URL of
   * what comes back — to open it in a tab, or to save it.
   */
  report(programmeId: Id, download = false): Observable<Blob> {
    return this.http.get(
      this.api.fileUrl(`qc/programmes/${programmeId}/report`),
      { params: download ? { download: true } : undefined, responseType: 'blob' });
  }
}
