import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Application,
  AttendanceMark,
  Id,
  Program,
  ScrutinyDecision,
  StateCoverageResult,
} from '../models';
import { ApiService } from './api.service';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class ApplicationService extends CrudService<Application> {
  protected readonly resource = 'applications';

  decide(decision: ScrutinyDecision): Observable<Application> {
    return this.api.post<Application>(
      `${this.resource}/${decision.applicationId}/scrutiny`,
      decision,
    );
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
