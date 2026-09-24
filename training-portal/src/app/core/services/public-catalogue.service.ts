import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LookupItem, PagedResult, PublicProgramme } from '../models';
import { ApiService } from './api.service';

/** What narrows the public listing. Mirrors PublicProgrammeFilterDto. */
export interface PublicProgrammeQuery {
  programTypeId?: number;
  stateCode?: number;
  districtCode?: number;
  /** Upcoming, Ongoing or Completed. */
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PublicFilterOptions {
  programTypes: LookupItem[];
  states: LookupItem[];
  districts: LookupItem[];
}

/**
 * Batches as the public sees them.
 *
 * These routes need no token, so this service is usable from a page nobody has
 * signed in to — which is the whole point of the shareable link.
 */
@Injectable({ providedIn: 'root' })
export class PublicCatalogueService {
  private readonly api = inject(ApiService);

  /** One batch by its code. Rejects when the code matches nothing public. */
  byCode(code: string): Observable<PublicProgramme> {
    return this.api.get<PublicProgramme>(`public/programmes/${encodeURIComponent(code)}`);
  }

  /** The listing: every published batch, newest first, narrowed by the filters. */
  list(query: PublicProgrammeQuery): Observable<PagedResult<PublicProgramme>> {
    return this.api.get<PagedResult<PublicProgramme>>(
      'public/programmes',
      query as Record<string, unknown>,
    );
  }

  /** The names the listing's filters are built from. */
  filters(): Observable<PublicFilterOptions> {
    return this.api.get<PublicFilterOptions>('public/programmes/filters');
  }

  /** Just the batches taking registrations, soonest first. */
  open(query?: { programTypeId?: number; stateCode?: number }): Observable<PublicProgramme[]> {
    return this.api.get<PublicProgramme[]>('public/programmes/open', query);
  }
}
