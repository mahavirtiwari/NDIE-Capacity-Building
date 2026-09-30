import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { StateCoverage, StateCoverageResult } from '../../core/models';
import { SiteTextService } from '../../core/services/site-text.service';
import { INDIA_STATE_PATHS, INDIA_VIEWBOX } from './india-states.data';

type Measure = 'participants' | 'programTypes';
type SortKey = 'name' | 'participants' | 'programmes';

interface Region {
  code: number;
  name: string;
  d: string;
  participants: number;
  programTypes: number;
  programmes: number;
  value: number;
  fill: string;
}

@Component({
  selector: 'app-state-coverage-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <section class="card map">
      <header class="map__head">
        <div>
          <h3 class="map__title">{{ copy.text('dashboard.map.title') }}</h3>
          <!-- The subtitle follows the table down a level, so it does not
               count states beside a list of districts. -->
          <p class="map__sub">{{ subtitle() }}</p>
        </div>

        <div class="map__toggle" role="group" aria-label="What the shading shows">
          <button
            type="button"
            class="map__tab"
            [class.map__tab--on]="measure() === 'participants'"
            (click)="measure.set('participants')"
          >
            Participants
          </button>
          <button
            type="button"
            class="map__tab"
            [class.map__tab--on]="measure() === 'programTypes'"
            (click)="measure.set('programTypes')"
          >
            Programme types
          </button>
        </div>
      </header>

      <div class="map__body">
        <div class="map__figure">
          <svg
            class="map__svg"
            [attr.viewBox]="viewBox"
            role="img"
            [attr.aria-label]="summary()"
          >
            <!-- Drawn twice: once as a darker silhouette underneath, which
                 gives the country a defined edge whatever the shading above
                 it happens to be. -->
            @for (region of regions(); track region.code) {
              <path class="map__outline" [attr.d]="region.d" />
            }
            @for (region of regions(); track region.code) {
              <path
                class="map__state"
                [class.map__state--active]="hovered()?.code === region.code"
                [attr.d]="region.d"
                [attr.fill]="region.fill"
                [attr.aria-label]="label(region)"
                tabindex="0"
                (mouseenter)="hovered.set(region)"
                (mousemove)="track($event)"
                (mouseleave)="hovered.set(null)"
                (focus)="showAtShape(region, $event)"
                (blur)="hovered.set(null)"
              />
            }
          </svg>

          <!-- Beside the pointer rather than under the map. Read at the
               bottom of the frame, the numbers were a long way from the state
               they described, and the eye had to leave the map to find them. -->
          @if (hovered(); as region) {
            <div
              class="map__note"
              [style.left.px]="notePosition().x"
              [style.top.px]="notePosition().y"
              role="status"
            >
              <strong class="map__note-name">{{ region.name }}</strong>
              <span class="map__note-row">
                <span>Programs conducted</span>
                <b>{{ region.programmes | number }}</b>
              </span>
              <span class="map__note-row">
                <span>Participants</span>
                <b>{{ region.participants | number }}</b>
              </span>
            </div>
          }
        </div>

        <aside class="map__side">
          <div class="map__table-wrap">
            <table class="map__table">
              <thead>
                <tr>
                  <th [attr.aria-sort]="ariaSort('name')">
                    <button type="button" class="map__sort" (click)="sortBy('name')">
                      District
                      <span class="map__caret">{{ caret('name') }}</span>
                    </button>
                  </th>
                  <th class="num" [attr.aria-sort]="ariaSort('participants')">
                    <button type="button" class="map__sort" (click)="sortBy('participants')">
                      Participants <span class="map__caret">{{ caret('participants') }}</span>
                    </button>
                  </th>
                  <th class="num" [attr.aria-sort]="ariaSort('programmes')">
                    <button type="button" class="map__sort" (click)="sortBy('programmes')">
                      Programmes conducted <span class="map__caret">{{ caret('programmes') }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- Districts, whether or not a state is filtered. The map
                     draws states because there are no district outlines to
                     draw, so hovering a row highlights the state it sits in
                     rather than the district itself. -->
                @for (row of rankedDistricts(); track row.districtCode) {
                  <tr
                    [class.map__row--active]="hovered()?.code === row.stateCode"
                    [class.map__row--idle]="row.programmes === 0"
                    (mouseenter)="hoverState(row.stateCode)"
                    (mouseleave)="hovered.set(null)"
                  >
                    <td>{{ row.district }}</td>
                    <td class="num">{{ row.participants | number }}</td>
                    <td class="num">{{ row.programmes | number }}</td>
                  </tr>
                }
                @if (rankedDistricts().length === 0) {
                  <tr>
                    <td colspan="3" class="map__none">
                      {{
                        districtsOf()
                          ? 'No districts recorded for this state.'
                          : 'No districts to show.'
                      }}
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th>{{ districtsOf() ? 'All ' + districtsOf() : 'All India' }}</th>
                  <th class="num">{{ tableTotals().participants | number }}</th>
                  <th class="num">{{ tableTotals().programmes | number }}</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="map__legend">
            <span class="map__legend-label">{{ measureLabel() }}</span>
            <div class="map__ramp">
              @for (step of ramp; track step) {
                <span class="map__swatch" [style.background]="shade(step)"></span>
              }
            </div>
            <div class="map__legend-ends">
              <span>0</span>
              <span>{{ max() | number }}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .map__head {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: flex-start;
      justify-content: space-between;
      padding: 1rem 1.125rem 0.5rem;
    }
    .map__title {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 650;
      color: var(--ink-900);
    }
    .map__sub {
      margin: 0.2rem 0 0;
      font-size: 0.8125rem;
      color: var(--ink-600);
    }
    .map__toggle {
      display: inline-flex;
      background: var(--surface-muted);
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      padding: 2px;
    }
    .map__tab {
      border: 0;
      background: transparent;
      border-radius: 6px;
      padding: 0.3rem 0.7rem;
      font: inherit;
      font-size: 0.78rem;
      color: var(--ink-600);
      cursor: pointer;
    }
    .map__tab--on {
      background: var(--brand-600);
      color: #fff;
      font-weight: 600;
    }

    .map__body {
      display: grid;
      /*
       * The map column is capped at the map's own width rather than taking
       * everything left over, so the table sits just beside it instead of
       * being pushed out to the far edge of the card with a gap between them.
       */
      grid-template-columns: minmax(0, 430px) minmax(320px, 480px);
      justify-content: center;
      gap: 7rem;
      padding: 0.25rem 1.125rem 1.125rem;
      align-items: start;
    }
    .map__figure {
      min-width: 0;
      /* The note is positioned against this. */
      position: relative;
    }
    .map__svg {
      width: 100%;
      /* Capped so the country keeps a sensible size instead of stretching to
         whatever width the card happens to have. */
      max-width: 430px;
      height: auto;
      display: block;
      /* Sits left rather than centred: the gap it used to leave on its right
         is width the state table can put to use. */
      margin: 0 auto 0 0;
    }
    .map__state {
      stroke: var(--surface);
      stroke-width: 0.6;
      stroke-linejoin: round;
      cursor: default;
      outline: none;
      transition: fill 0.12s ease;
    }
    .map__outline {
      fill: none;
      stroke: var(--brand-200);
      stroke-width: 1.6;
      stroke-linejoin: round;
      pointer-events: none;
    }
    .map__state--active,
    .map__state:focus-visible {
      stroke: var(--ink-900);
      stroke-width: 1.4;
    }
    /* Positioned against the map frame, which is the offsetParent. */
    .map__note {
      position: absolute;
      z-index: 5;
      pointer-events: none;
      min-width: 12.5rem;
      display: grid;
      gap: 0.2rem;
      padding: 0.5rem 0.65rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--brand-600);
      border-radius: var(--radius);
      box-shadow: 0 6px 20px rgb(28 26 26 / 14%);
      font-size: var(--fs-xs);
      /* Sits above and to the right of the cursor, clear of the pointer. */
      transform: translate(0.75rem, -50%);
    }
    .map__note-name {
      font-size: var(--fs-sm);
      color: var(--ink-900);
      margin-bottom: 0.15rem;
    }
    .map__note-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      color: var(--ink-500);
    }
    .map__note-row b { color: var(--ink-900); font-variant-numeric: tabular-nums; }

    .map__table-wrap {
      /* Scrolls on its own so the whole page does not have to; the header and
         the all-India total stay put while the states move under them. */
      /* Tall enough to sit alongside the map without stretching the section:
         a stretched column drove the card to well over twice the map's height. */
      max-height: 470px;
      overflow-y: auto;
      overflow-x: hidden;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
    }
    .map__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
    }
    .map__table th,
    .map__table td {
      padding: 0.3rem 0.55rem;
      text-align: left;
    }
    /* The state name wraps — "The Dadra And Nagar Haveli And Daman And Diu" is
       far wider than the panel — while the figures stay on one line. */
    .map__table th:first-child,
    .map__table td:first-child {
      width: 100%;
    }
    .map__table .num {
      text-align: center;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      /* Sized to their heading so the centred figures line up as a column
         rather than drifting with the width of the state beside them. */
      width: 1%;
      min-width: 6.5rem;
    }
    /* A hairline between the columns. On the crimson header it has to be a
       light wash of white; on the rows, the palest brand tint. */
    .map__table tbody td + td,
    .map__table tfoot th + th {
      border-left: 1px solid var(--brand-100);
    }
    .map__table thead th + th {
      border-left: 1px solid color-mix(in srgb, #fff 35%, transparent);
    }
    .map__table thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 0;
      background: var(--brand-600);
      border-bottom: 1px solid var(--brand-700);
    }
    .map__sort {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.4rem 0.55rem;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: 0.7rem;
      font-weight: 650;
      line-height: 1.15;
      color: #fff;
      text-align: left;
      cursor: pointer;
    }
    .map__table .num .map__sort {
      justify-content: center;
      text-align: center;
    }
    .map__sort:hover {
      background: color-mix(in srgb, #000 12%, transparent);
    }
    .map__sort:focus-visible {
      outline: 2px solid #fff;
      outline-offset: -2px;
    }
    /* Reserved so the row does not shift as the marker moves between columns. */
    .map__caret {
      min-width: 0.7em;
      font-size: 0.6rem;
      opacity: 0.9;
    }
    .map__table tbody td {
      border-bottom: 1px solid var(--brand-50);
      color: var(--ink-800);
    }
    .map__table tbody tr {
      cursor: default;
    }
    .map__row--active td {
      background: var(--brand-50);
    }
    /* A state with nothing recorded is dimmed rather than hidden: the gaps in
       coverage are the point of the list. */
    .map__row--idle td {
      color: var(--ink-500);
    }
    /* All India is the total, so it is tinted rather than left looking like
       one more state that happens to be pinned to the bottom. */
    .map__table tfoot th {
      position: sticky;
      bottom: 0;
      background: var(--brand-50);
      border-top: 1px solid var(--brand-200);
      color: var(--ink-900);
      font-weight: 650;
      padding: 0.4rem 0.55rem;
    }
    .map__none {
      text-align: center;
      color: var(--ink-500);
      padding: 1rem 0.5rem;
    }
    .map__table tfoot .num {
      text-align: center;
    }

    .map__legend {
      margin-top: 0.75rem;
    }
    .map__legend-label {
      font-size: 0.75rem;
      color: var(--ink-600);
    }
    .map__ramp {
      display: flex;
      gap: 2px;
      margin: 0.3rem 0 0.2rem;
    }
    .map__swatch {
      flex: 1;
      height: 9px;
      border-radius: 2px;
    }
    .map__legend-ends {
      display: flex;
      justify-content: space-between;
      font-size: 0.6875rem;
      color: var(--ink-500);
      font-variant-numeric: tabular-nums;
    }

    @media (max-width: 860px) {
      .map__body {
        grid-template-columns: 1fr;
      }
      /* Stacked, the map has the full width again, so centre it. */
      .map__svg {
        margin: 0 auto;
      }
      /* No map beside it, so a shorter table reads better. */
      .map__table-wrap {
        max-height: 340px;
      }
    }
  `,
})
export class StateCoverageMapComponent {
  readonly data = input<StateCoverageResult | null>(null);

  protected readonly measure = signal<Measure>('participants');
  protected readonly hovered = signal<Region | null>(null);

  /**
   * Highlights the state a district row belongs to.
   *
   * The map has state shapes and no district ones, so a district row lights up
   * the state containing it. That is the honest amount of precision the map
   * has: it says where in the country to look, and the row says which district.
   */
  protected hoverState(stateCode: number): void {
    this.hovered.set(this.regions().find((r) => r.code === stateCode) ?? null);
  }

  /** Where the note sits, in pixels within the figure. */
  protected readonly notePosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  /** Follows the pointer, so the numbers stay next to what they describe. */
  protected track(event: MouseEvent): void {
    const figure = (event.currentTarget as SVGElement).closest('.map__figure');
    if (!figure) return;

    const box = figure.getBoundingClientRect();
    this.notePosition.set({ x: event.clientX - box.left, y: event.clientY - box.top });
  }

  /**
   * Keyboard focus has no pointer, so the note goes beside the shape itself.
   * Without this, tabbing through the map would put every note in the corner.
   */
  protected showAtShape(region: Region, event: FocusEvent): void {
    this.hovered.set(region);

    const shape = event.target as SVGGraphicsElement;
    const figure = shape.closest('.map__figure');
    if (!figure) return;

    const box = figure.getBoundingClientRect();
    const bounds = shape.getBoundingClientRect();
    this.notePosition.set({
      x: bounds.right - box.left,
      y: bounds.top + bounds.height / 2 - box.top,
    });
  }

  protected readonly viewBox = INDIA_VIEWBOX;
  protected readonly ramp = [0, 0.2, 0.4, 0.6, 0.8, 1];

  protected readonly measureLabel = computed(() =>
    this.measure() === 'participants' ? 'Participants' : 'Program types',
  );

  protected readonly max = computed(() => {
    const result = this.data();
    if (!result) return 0;
    return this.measure() === 'participants' ? result.maxParticipants : result.maxProgramTypes;
  });

  protected readonly regions = computed<Region[]>(() => {
    const byCode = new Map<number, StateCoverage>(
      (this.data()?.states ?? []).map((s) => [s.stateCode, s]),
    );
    const max = this.max();
    const participants = this.measure() === 'participants';

    return INDIA_STATE_PATHS.map((shape) => {
      const row = byCode.get(shape.code);
      const value = row ? (participants ? row.participants : row.programTypes) : 0;
      /* Square root rather than linear: one large state would otherwise flatten
         every other one into the same pale tone. */
      const intensity = max > 0 ? Math.sqrt(value / max) : 0;

      return {
        code: shape.code,
        /* The API's spelling wins where it has one, so the map agrees with the
           rest of the portal. */
        name: row?.state ?? shape.name,
        d: shape.d,
        participants: row?.participants ?? 0,
        programTypes: row?.programTypes ?? 0,
        programmes: row?.programmes ?? 0,
        value,
        fill: this.shade(intensity),
      };
    });
  });

  /**
   * Which column the table is ordered by. Participants descending to begin
   * with, so the busiest states are at the top and the gaps in coverage group
   * at the bottom.
   */
  protected readonly sort = signal<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'participants',
    dir: 'desc',
  });

  /** A new column starts descending for figures and ascending for names. */
  protected sortBy(key: SortKey): void {
    this.sort.update((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );
  }

  protected caret(key: SortKey): string {
    if (this.sort().key !== key) return '';
    return this.sort().dir === 'asc' ? '▲' : '▼';
  }

  protected ariaSort(key: SortKey): string {
    if (this.sort().key !== key) return 'none';
    return this.sort().dir === 'asc' ? 'ascending' : 'descending';
  }

  /** Set when the filter names one state, which is what drops the table a level. */
  protected readonly districtsOf = computed(() => this.data()?.districtsOf || null);

  /** Wording for this section, maintained under Administration → Site text. */
  protected readonly copy = inject(SiteTextService);

  /**
   * One line, worded by whichever key matches the level being shown, with the
   * numbers dropped into its placeholders. Keeping the counting here rather
   * than in the template means a reworded line cannot lose them.
   */
  protected readonly subtitle = computed(() => {
    const state = this.districtsOf();
    return state
      ? this.copy.text('dashboard.map.districtSubtitle', {
          covered: this.districtsCovered(),
          total: (this.data()?.districts ?? []).length,
          state,
        })
      : this.copy.text('dashboard.map.subtitle', {
          covered: this.data()?.statesCovered ?? 0,
          total: this.regions().length,
        });
  });

  protected readonly districtsCovered = computed(
    () => (this.data()?.districts ?? []).filter((d) => d.programTypes > 0).length,
  );

  /** Sorted by the same column and direction the state table is using. */
  protected readonly rankedDistricts = computed(() => {
    const rows = this.data()?.districts ?? [];
    const { key, dir } = this.sort();
    const factor = dir === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const primary =
        key === 'name'
          ? a.district.localeCompare(b.district)
          : ((a[key as 'participants' | 'programmes'] as number) -
             (b[key as 'participants' | 'programmes'] as number));

      if (primary !== 0) return primary * factor;

      /* Across the whole country this list is seven hundred rows, nearly all of
         them empty. Sorting by participants alone buries a district that has
         had a programme but no attendance yet underneath the alphabet, so the
         other measure breaks the tie before the name does — anything that has
         happened sorts above everything that has not. */
      if (key !== 'name') {
        const other = key === 'participants' ? 'programmes' : 'participants';
        const secondary = (a[other] as number) - (b[other] as number);
        if (secondary !== 0) return secondary * factor;
      }

      return a.district.localeCompare(b.district);
    });
  });

  /**
   * The footer totals whatever the table is showing.
   *
   * Leaving the All India figures under a list of one state's districts would
   * put a total beside rows that do not add up to it.
   */
  protected readonly tableTotals = computed(() => {
    const districts = this.data()?.districts ?? [];
    if (this.districtsOf()) {
      return {
        participants: districts.reduce((sum, d) => sum + d.participants, 0),
        programmes: districts.reduce((sum, d) => sum + d.programmes, 0),
      };
    }
    return {
      participants: this.data()?.totalParticipants ?? 0,
      programmes: this.data()?.totalProgrammes ?? 0,
    };
  });

  protected readonly ranked = computed(() => {
    const { key, dir } = this.sort();
    const factor = dir === 'asc' ? 1 : -1;

    return [...this.regions()].sort((a, b) => {
      const primary =
        key === 'name'
          ? a.name.localeCompare(b.name)
          : (a[key] as number) - (b[key] as number);
      /* Name breaks every tie, so equal figures stay in a stable, readable
         order rather than shuffling between renders. */
      return primary !== 0 ? primary * factor : a.name.localeCompare(b.name);
    });
  });

  protected readonly summary = computed(() => {
    const result = this.data();
    if (!result) return 'Program reach by state';
    return (
      `Programme reach by state. ${result.statesCovered} states covered, ` +
      `${result.totalParticipants} participants in total.`
    );
  });

  /** Brand ramp from the palest tint to full crimson. */
  protected shade(intensity: number): string {
    /*
     * A state with nothing recorded still has to be clearly visible. The
     * palest brand tint is very nearly white, so on an empty dataset — which
     * is exactly how the map starts life — the whole country disappeared into
     * the card behind it. The floor is a definite tone instead.
     */
    if (intensity <= 0) return 'var(--brand-100)';
    const percent = Math.round(18 + intensity * 82);
    return `color-mix(in srgb, var(--brand-600) ${percent}%, var(--brand-50))`;
  }

  protected label(region: Region): string {
    return `${region.name}: ${region.participants} participants across ${region.programTypes} programme types`;
  }
}
