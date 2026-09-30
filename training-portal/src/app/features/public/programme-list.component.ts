import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LookupItem, PagedResult, PublicProgramme } from '../../core/models';
import {
  PublicCatalogueService,
  PublicProgrammeQuery,
} from '../../core/services/public-catalogue.service';

/**
 * The public list of training batches.
 *
 * Open to anybody — this is the page an agency points people at, and the page
 * somebody lands on before they have an account. It shows what has been run as
 * well as what is coming: a track that runs every few weeks is worth waiting
 * for, and a listing that hid its history would not show that.
 *
 * Nothing here identifies a participant. The columns are the batch, where and
 * when, and whether it is taking registrations.
 */
@Component({
  selector: 'app-programme-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink],
  template: `
    <div class="pub">
      <header class="pub__masthead">
        <div class="pub__inner">
          <span class="pub__eyebrow">Ministry of MSME</span>
          <h1 class="pub__title">Training programs</h1>
          <p class="pub__lead">
            Scheduled batches across the country. Pick one that is open and apply through the
            applicant app or the registration form.
          </p>
        </div>
      </header>

      <div class="pub__inner pub__body">
        <section class="card">
          <div class="card__body filters">
            <div class="field">
              <label class="field-label" for="fState">State/UT</label>
              <select id="fState" class="select" (change)="set('stateCode', $event)">
                <option value="">All</option>
                @for (s of options()?.states ?? []; track s.id) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="fDistrict">District</label>
              <select
                id="fDistrict"
                class="select"
                [disabled]="!query().stateCode"
                (change)="set('districtCode', $event)"
              >
                <option value="">All</option>
                @for (d of districts(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="fType">Program</label>
              <select id="fType" class="select" (change)="set('programTypeId', $event)">
                <option value="">All</option>
                @for (t of options()?.programTypes ?? []; track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="fStatus">Status</label>
              <select id="fStatus" class="select" (change)="set('status', $event)">
                <option value="">All</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="fFrom">Start date from</label>
              <input id="fFrom" type="date" class="input" (change)="set('from', $event)" />
            </div>

            <div class="field">
              <label class="field-label" for="fTo">Start date to</label>
              <input id="fTo" type="date" class="input" (change)="set('to', $event)" />
            </div>

            <button type="button" class="btn btn--ghost filters__reset" (click)="reset()">
              Reset
            </button>
          </div>
        </section>

        @if (result(); as page) {
          <section class="card mt-md">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th style="width: 56px">#</th>
                    <th style="width: 120px">Batch</th>
                    <th>Program</th>
                    <th>Venue</th>
                    <th style="width: 130px">District</th>
                    <th style="width: 140px">State/UT</th>
                    <th style="width: 110px">Status</th>
                    <th style="width: 120px">Start</th>
                    <th style="width: 120px">End</th>
                    <th style="width: 170px">Registration</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of page.items; track p.programmeId; let i = $index) {
                    <tr>
                      <td class="cell-muted tabular">{{ offset() + i + 1 }}</td>
                      <td>
                        <a class="cell-primary" [routerLink]="['/p', slug(p.programmeId)]">
                          {{ p.programmeId }}
                        </a>
                      </td>
                      <td>{{ p.programTypeName }}</td>
                      <td class="cell-muted">{{ p.venue || '—' }}</td>
                      <td class="cell-muted">{{ p.district || '—' }}</td>
                      <td class="cell-muted">{{ p.state || '—' }}</td>
                      <td>
                        <span class="tag" [class]="'tag tag--' + p.scheduleStatus.toLowerCase()">
                          {{ p.scheduleStatus }}
                        </span>
                      </td>
                      <td class="cell-muted">{{ p.startDate | date: 'dd MMM yyyy' }}</td>
                      <td class="cell-muted">{{ p.endDate | date: 'dd MMM yyyy' }}</td>
                      <td>
                        @if (p.registrationsOpen) {
                          <span class="open">
                            Open · {{ p.seatsLeft }} place{{ p.seatsLeft === 1 ? '' : 's' }} left
                          </span>
                        } @else {
                          <span class="cell-muted">{{ p.registrationStatus }}</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="10" class="cell-muted text-center">
                        No batches match these filters.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (page.total > page.pageSize) {
              <div class="card__body pager">
                <span class="text-sm text-muted">
                  Showing {{ offset() + 1 }}–{{ offset() + page.items.length }} of
                  {{ page.total }}
                </span>
                <div class="row row-sm">
                  <button
                    type="button"
                    class="btn btn--secondary"
                    [disabled]="page.page <= 1"
                    (click)="go(page.page - 1)"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    class="btn btn--secondary"
                    [disabled]="offset() + page.items.length >= page.total"
                    (click)="go(page.page + 1)"
                  >
                    Next
                  </button>
                </div>
              </div>
            }
          </section>
        } @else {
          <p class="text-sm text-muted mt-md">Loading batches…</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .pub { min-height: 100vh; background: var(--ink-50); padding-bottom: 3rem; }
      .pub__masthead { background: var(--brand-700); color: #fff; padding: 2rem 0; }
      .pub__inner { max-width: 1180px; margin: 0 auto; padding: 0 1rem; }
      .pub__eyebrow { font-size: var(--fs-xs); letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; }
      .pub__title { margin: 0.3rem 0 0; font-size: 1.7rem; }
      .pub__lead { margin: 0.5rem 0 0; opacity: 0.9; font-size: var(--fs-sm); max-width: 60ch; }
      .pub__body { margin-top: -1.2rem; }
      .filters { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end; }
      .filters .field { flex: 1 1 170px; min-width: 150px; }
      .filters__reset { flex: none; }
      .tag {
        display: inline-block;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        font-size: var(--fs-xs);
        font-weight: 600;
        background: var(--ink-100);
        color: var(--ink-600);
      }
      .tag--upcoming { background: var(--info-50); color: var(--info-700); }
      .tag--ongoing { background: var(--warning-50); color: var(--warning-700); }
      .tag--completed { background: var(--ink-100); color: var(--ink-500); }
      .open { color: var(--success-700); font-weight: 600; font-size: var(--fs-sm); }
      .pager { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    `,
  ],
})
export class ProgrammeListComponent {
  private readonly catalogue = inject(PublicCatalogueService);

  protected readonly options = toSignal(
    this.catalogue.filters().pipe(catchError(() => of(null))),
  );

  protected readonly query = signal<PublicProgrammeQuery>({ page: 1, pageSize: 25 });

  private readonly applied = new BehaviorSubject<PublicProgrammeQuery>({ page: 1, pageSize: 25 });

  protected readonly result = toSignal<PagedResult<PublicProgramme> | undefined>(
    this.applied.pipe(
      switchMap((q) => this.catalogue.list(q).pipe(catchError(() => of(undefined)))),
    ),
  );

  protected readonly offset = computed(() => {
    const page = this.result();
    return page ? (page.page - 1) * page.pageSize : 0;
  });

  /** Districts of the chosen state; the list is otherwise thousands long. */
  protected readonly districts = computed<LookupItem[]>(() => {
    const state = this.query().stateCode;
    if (!state) return [];
    return (this.options()?.districts ?? []).filter((d) => d.parentId === state);
  });

  /** Slashes in an older batch code cannot sit in a path segment. */
  protected slug(code: string): string {
    return code.replace(/\//g, '-');
  }

  protected set(key: keyof PublicProgrammeQuery, event: Event): void {
    const raw = (event.target as HTMLSelectElement | HTMLInputElement).value;
    const value = raw === '' ? undefined : key.endsWith('Code') || key.endsWith('Id') ? Number(raw) : raw;

    this.query.update((q) => {
      const next = { ...q, [key]: value, page: 1 } as PublicProgrammeQuery;
      /* A district outside the newly chosen state would silently return
         nothing, so changing the state clears it. */
      if (key === 'stateCode') next.districtCode = undefined;
      return next;
    });
    this.applied.next(this.query());
  }

  protected go(page: number): void {
    this.query.update((q) => ({ ...q, page }));
    this.applied.next(this.query());
  }

  protected reset(): void {
    const fresh: PublicProgrammeQuery = { page: 1, pageSize: 25 };
    this.query.set(fresh);
    this.applied.next(fresh);
    /* The controls are uncontrolled inputs, so they are cleared directly. */
    document
      .querySelectorAll<HTMLSelectElement | HTMLInputElement>('.filters select, .filters input')
      .forEach((element) => (element.value = ''));
  }
}
