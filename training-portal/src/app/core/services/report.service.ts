import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Id, PagedRequest, PagedResult, ProgrammeReport, ReportProgramme } from '../models';
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
