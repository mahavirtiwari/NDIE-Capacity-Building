import { inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { Id, PagedRequest, PagedResult, RecordStatus } from '../models';
import { ApiService } from './api.service';

/**
 * Generic CRUD base so every master screen gets the same contract without
 * repeating boilerplate. Concrete services only declare their resource path.
 */
export abstract class CrudService<
  T,
  TCreate = Record<string, unknown>,
  TUpdate = TCreate,
> {
  protected readonly api = inject(ApiService);
  protected abstract readonly resource: string;

  list(request: PagedRequest): Observable<PagedResult<T>> {
    return this.api.getPaged<T>(this.resource, request);
  }

  /**
   * The whole list, for dropdowns and pickers.
   *
   * A failure yields an empty list rather than an error. These feed
   * `toSignal`, which re-throws a failed source on every read — so one
   * unavailable lookup used to throw on each render pass and wedge the whole
   * screen. An empty dropdown is recoverable; a frozen tab is not. The error
   * interceptor has already told the user what failed.
   */
  all(query?: Record<string, unknown>): Observable<T[]> {
    return this.api.get<T[]>(`${this.resource}/all`, query).pipe(
      catchError((error: unknown) => {
        console.warn(`Lookup "${this.resource}/all" failed; continuing with an empty list.`, error);
        return of([] as T[]);
      }),
    );
  }

  getById(id: Id): Observable<T> {
    return this.api.get<T>(`${this.resource}/${id}`);
  }

  create(payload: TCreate): Observable<T> {
    return this.api.post<T>(this.resource, payload);
  }

  update(id: Id, payload: TUpdate): Observable<T> {
    return this.api.put<T>(`${this.resource}/${id}`, payload);
  }

  setStatus(id: Id, status: RecordStatus): Observable<T> {
    return this.api.patch<T>(`${this.resource}/${id}/status`, { status });
  }

  remove(id: Id): Observable<void> {
    return this.api.delete<void>(`${this.resource}/${id}`);
  }
}
