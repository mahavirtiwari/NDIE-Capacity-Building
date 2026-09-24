import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, debounceTime, switchMap } from 'rxjs';
import { PagedRequest, PagedResult } from '../core/models';

/**
 * Shared list-screen state: paging, sorting, search debounce and filters.
 * Instantiate it in a component field so it inherits the injection context.
 *
 *   protected readonly list = new ListState<Category>((req) => this.service.list(req));
 */
export class ListState<T> {
  readonly rows = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly search = signal('');
  readonly sortBy = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly filters = signal<Record<string, unknown>>({});

  private readonly trigger = new BehaviorSubject<void>(undefined);

  constructor(
    private readonly loader: (request: PagedRequest) => Observable<PagedResult<T>>,
    options: { pageSize?: number; sortBy?: string } = {},
  ) {
    if (options.pageSize) this.pageSize.set(options.pageSize);
    if (options.sortBy) this.sortBy.set(options.sortBy);

    this.trigger
      .pipe(
        debounceTime(120),
        switchMap(() => {
          this.loading.set(true);
          return this.loader(this.request());
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (result) => {
          this.rows.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  request(): PagedRequest {
    return {
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.search() || undefined,
      sortBy: this.sortBy() ?? undefined,
      sortDir: this.sortDir(),
      ...this.filters(),
    };
  }

  reload(): void {
    this.trigger.next();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.reload();
  }

  setSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
    this.reload();
  }

  setSort(sort: { sortBy: string; sortDir: 'asc' | 'desc' }): void {
    this.sortBy.set(sort.sortBy);
    this.sortDir.set(sort.sortDir);
    this.reload();
  }

  /**
   * Sets or clears one filter.
   *
   * Returns early when the value is already what was asked for. Without that,
   * every call published a fresh object — a new reference, so the signal
   * always reported a change — and any caller inside an `effect` that also
   * read `filters` would retrigger itself endlessly.
   */
  setFilter(key: string, value: unknown): void {
    const current = this.filters();
    const clearing = value === null || value === undefined || value === '';

    if (clearing ? !(key in current) : current[key] === value) return;

    const next = { ...current };
    if (clearing) delete next[key];
    else next[key] = value;

    this.filters.set(next);
    this.page.set(1);
    this.reload();
  }

  clearFilters(): void {
    this.filters.set({});
    this.search.set('');
    this.page.set(1);
    this.reload();
  }

  get hasFilters(): boolean {
    return Object.keys(this.filters()).length > 0 || !!this.search();
  }
}

/** Debounce helper for search inputs bound with `(input)`. */
export function searchTerm(event: Event): string {
  return (event.target as HTMLInputElement).value.trim();
}
