import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, PagedRequest, PagedResult } from '../models';

/**
 * Thin HTTP facade. Every backend response is wrapped in `ApiEnvelope<T>`;
 * this service unwraps it so callers only ever see the payload.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  get<T>(path: string, query?: Record<string, unknown>): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(this.url(path), { params: toParams(query) })
      .pipe(map((r) => r.data));
  }

  getPaged<T>(path: string, request: PagedRequest): Observable<PagedResult<T>> {
    return this.get<PagedResult<T>>(path, request as unknown as Record<string, unknown>);
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiEnvelope<T>>(this.url(path), body).pipe(map((r) => r.data));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<ApiEnvelope<T>>(this.url(path), body).pipe(map((r) => r.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<ApiEnvelope<T>>(this.url(path), body).pipe(map((r) => r.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiEnvelope<T>>(this.url(path)).pipe(map((r) => r.data));
  }

  /**
   * A multipart upload. The body is FormData, so no Content-Type is set —
   * the browser has to add its own boundary to it.
   */
  upload<T>(path: string, form: FormData): Observable<T> {
    return this.http.post<ApiEnvelope<T>>(this.url(path), form).pipe(map((r) => r.data));
  }

  /** Absolute URL for a file served by the API, for links and downloads. */
  fileUrl(path: string): string {
    return this.url(path);
  }

  private url(path: string): string {
    return `${this.base}/${path.replace(/^\//, '')}`;
  }
}

function toParams(query?: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  if (!query) return params;
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params = params.set(key, value.join(','));
    } else {
      params = params.set(key, String(value));
    }
  }
  return params;
}
