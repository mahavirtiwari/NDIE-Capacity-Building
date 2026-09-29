import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  Faculty,
  FacultyUpsert,
  Id,
  PagedRequest,
  PagedResult,
  ProgrammeReport,
  ReportProgramme,
} from '../models';
import { ApiService } from './api.service';

/**
 * Reports are assembled on request and never stored, so there is nothing here
 * that creates, saves or deletes one.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiService);

  programmes(request: PagedRequest): Observable<PagedResult<ReportProgramme>> {
    return this.api.get<PagedResult<ReportProgramme>>('reports/programmes', request);
  }

  programme(id: Id): Observable<ProgrammeReport> {
    return this.api.get<ProgrammeReport>(`reports/programmes/${id}`);
  }
}

/**
 * The faculty register. Coordinators write the same rows from the app; this is
 * the portal's door to them, not a second store.
 */
@Injectable({ providedIn: 'root' })
export class FacultyService {
  private readonly api = inject(ApiService);

  list(request: PagedRequest): Observable<PagedResult<Faculty>> {
    return this.api.get<PagedResult<Faculty>>('trainers', request);
  }

  add(programmeId: Id, body: FacultyUpsert): Observable<Faculty> {
    return this.api.post<Faculty>(`trainers/programmes/${programmeId}`, body);
  }

  update(trainerId: Id, body: FacultyUpsert): Observable<Faculty> {
    return this.api.put<Faculty>(`trainers/${trainerId}`, body);
  }

  /**
   * The programmes a trainer can be attached to, as a picker list.
   *
   * Read off the report register rather than a lookup of its own: it is the
   * same scoped set of programmes, and a second endpoint returning the same
   * rows is a second thing to keep in step.
   */
  programmeOptions(): Observable<{ id: Id; name: string }[]> {
    return this.api
      .get<PagedResult<ReportProgramme>>('reports/programmes', { page: 1, pageSize: 200 })
      .pipe(
        map((result) =>
          result.items.map((p) => ({
            id: p.id,
            name: `${p.programmeCode} — ${p.programTypeName ?? p.programmeName}`,
          })),
        ),
      );
  }
}
