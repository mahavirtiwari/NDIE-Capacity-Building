import { computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, debounceTime, firstValueFrom, switchMap } from 'rxjs';
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

  /** The keys the Apply bar has charge of; see {@link applyFilters}. */
  private readonly owned = new Set<string>();

  /**
   * Filter choices made on screen but not yet applied.
   *
   * Most screens apply a filter the moment it changes, which is right when
   * there is one dropdown. A screen with several, and a date range among
   * them, is a different thing: every half-finished choice fires a query,
   * and a part-typed date narrows the list to nothing before the year has
   * been reached. Those screens stage their choices here and commit them
   * together.
   */
  readonly staged = signal<Record<string, unknown>>({});

  /** True where a staged choice has not been applied yet. */
  readonly dirty = computed(
    () => JSON.stringify(this.staged()) !== JSON.stringify(this.filters()),
  );

  private readonly trigger = new BehaviorSubject<void>(undefined);

  constructor(
    private readonly loader: (request: PagedRequest) => Observable<PagedResult<T>>,
    options: { pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' } = {},
  ) {
    if (options.pageSize) this.pageSize.set(options.pageSize);
    if (options.sortBy) this.sortBy.set(options.sortBy);
    /* A register that only grows reads newest first; a master reads A to Z.
       Neither is right for both, so the screen says which it wants. */
    if (options.sortDir) this.sortDir.set(options.sortDir);

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

  /**
   * Every row the current filters match, not just the page on screen.
   *
   * An export of "what I am looking at" is the wrong thing almost every time:
   * somebody filters to a state, exports, and gets the first ten of four
   * hundred with nothing saying so. This walks the pages instead.
   *
   * Capped, because an unbounded fetch against a mistyped filter is a way to
   * take the server down from a button. The cap is reported so the caller can
   * say the export was cut rather than quietly hand over a short file.
   */
  async fetchAll(limit = 5000): Promise<{ rows: T[]; truncated: boolean }> {
    const size = 200;
    const base = this.request();
    const rows: T[] = [];

    for (let page = 1; rows.length < limit; page++) {
      const result = await firstValueFrom(
        this.loader({ ...base, page, pageSize: size }),
      );

      rows.push(...result.items);

      if (result.items.length < size || rows.length >= result.total) {
        return { rows, truncated: false };
      }
    }

    return { rows: rows.slice(0, limit), truncated: true };
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

  /**
   * Records a choice without running it. Nothing reloads until
   * {@link applyFilters} is called, so a screen can collect a whole row of
   * them and ask once.
   */
  stageFilter(key: string, value: unknown): void {
    this.owned.add(key);
    const current = this.staged();
    const clearing = value === null || value === undefined || value === '';

    if (clearing ? !(key in current) : current[key] === value) return;

    const next = { ...current };
    if (clearing) delete next[key];
    else next[key] = value;

    this.staged.set(next);
  }

  /**
   * Runs what was staged. Back to page one: page four of the old list.
   *
   * Only the keys the bar itself stages are replaced. It used to publish
   * the staged set whole, which quietly dropped every filter set any other
   * way on the same screen — the view tab above the table, the cascading
   * category select beside it — so choosing a category and then pressing
   * Apply showed the unfiltered list back again, which is the opposite of
   * what the button says. Clearing one of the bar's own boxes still
   * removes that filter, because the key is cleared here before whatever
   * the bar now holds is laid over the top.
   */
  applyFilters(): void {
    const next = { ...this.filters() };
    for (const key of this.owned) delete next[key];

    this.filters.set({ ...next, ...this.staged() });
    this.page.set(1);
    this.reload();
  }

  clearFilters(): void {
    this.filters.set({});
    this.staged.set({});
    this.search.set('');
    this.page.set(1);
    this.reload();
  }

  /** What a staged control should show, so Reset empties the boxes too. */
  stagedValue(key: string): string {
    const held = this.staged()[key];
    return held === null || held === undefined ? '' : String(held);
  }

  get hasFilters(): boolean {
    return Object.keys(this.filters()).length > 0 || !!this.search();
  }
}

/** Debounce helper for search inputs bound with `(input)`. */
export function searchTerm(event: Event): string {
  return (event.target as HTMLInputElement).value.trim();
}
