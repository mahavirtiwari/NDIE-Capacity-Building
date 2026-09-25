import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SiteText } from '../models';
import { ApiService } from './api.service';

/**
 * The editing side of the site wording.
 *
 * Separate from `SiteTextService`, which every screen injects to read a string:
 * that one holds the resolved map and is on the hot path, this one is only ever
 * used by the editor.
 */
@Injectable({ providedIn: 'root' })
export class SiteTextService {
  private readonly api = inject(ApiService);
  private readonly resource = 'site-text';

  list(): Observable<SiteText[]> {
    return this.api.get<SiteText[]>(this.resource);
  }

  /** Blank restores the shipped wording; the server decides, not the caller. */
  set(key: string, value: string): Observable<SiteText> {
    return this.api.put<SiteText>(`${this.resource}/${encodeURIComponent(key)}`, { value });
  }

  restoreAll(): Observable<SiteText[]> {
    return this.api.post<SiteText[]>(`${this.resource}/restore`, {});
  }
}
