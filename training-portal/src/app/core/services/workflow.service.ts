import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Application,
  RejectionReasonUpsert,
  RejectionReason,
  ApplicationCounts,
  AttendanceMark,
  Id,
  Program,
  ProfileDecision,
  ProfileScrutinyCounts,
  ProfileSubmission,
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
