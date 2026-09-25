import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { ApiService } from './api.service';

const CACHE_KEY = 'ntms.site-text';

/**
 * The wording of the screens that are not driven by data.
 *
 * The strings and their shipped defaults live on the server, in one registry,
 * so there is a single place they are written down. The portal reads the
 * resolved map once at start-up and every template asks for a key.
 *
 * The last good map is kept in localStorage, so a portal opened while the API
 * is unreachable still renders words rather than gaps. A key with nothing
 * behind it — a template asking for a string this release does not define —
 * returns empty rather than the key itself, because a stray `signin.heading`
 * on screen is worse than a missing line.
 */
@Injectable({ providedIn: 'root' })
export class SiteTextService {
  private readonly api = inject(ApiService);
  private readonly map = signal<Record<string, string>>(readCache());

  /** Called once at start-up, before the first screen renders. */
  load(): Observable<Record<string, string>> {
    return this.api.get<Record<string, string>>('site-text/map').pipe(
      tap((next) => {
        this.map.set(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          /* Private browsing, or a full store. The map still works in memory. */
        }
      }),
      catchError(() => of(this.map())),
    );
  }

  /** Re-reads after an edit, so the change shows without a reload. */
  refresh(): void {
    this.load().subscribe();
  }

  /**
   * The wording for a key, with `{name}` placeholders filled in.
   *
   * Substitution is on the resolved string, so somebody rewording a line keeps
   * whatever numbers it carried as long as they keep the placeholder.
   */
  text(key: string, values?: Record<string, string | number>): string {
    const raw = this.map()[key] ?? '';
    if (!values) return raw;

    return Object.entries(values).reduce(
      (out, [name, value]) => out.split(`{${name}}`).join(String(value)),
      raw,
    );
  }

  /**
   * Splits a string on its *emphasis* markers, so a template can render the
   * marked run differently without accepting HTML from a settings screen.
   * Anything an administrator types stays text.
   */
  parts(key: string): { text: string; emphasis: boolean }[] {
    const raw = this.text(key);
    if (!raw.includes('*')) return [{ text: raw, emphasis: false }];

    return raw
      .split(/\*([^*]+)\*/g)
      .map((piece, index) => ({ text: piece, emphasis: index % 2 === 1 }))
      .filter((piece) => piece.text.length > 0);
  }
}

function readCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
