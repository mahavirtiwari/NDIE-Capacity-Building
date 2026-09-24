import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PublicProgramme } from '../models';
import { ApiService } from './api.service';

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

  /** Everything currently open, soonest first. */
  open(query?: { programTypeId?: number; stateCode?: number }): Observable<PublicProgramme[]> {
    return this.api.get<PublicProgramme[]>('public/programmes', query);
  }
}
