import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SeriesPoint } from '../../core/services/workflow.service';

/**
 * Shares of a whole, worked out once for both charts on this pair.
 *
 * Percentages are apportioned by largest remainder rather than rounded one at a
 * time, so the figures on screen add up to 100 instead of the 99 or 101 that
 * independent rounding produces — a reader who adds them up should not find the
 * chart contradicting itself.
 */
export interface ProfileSlice extends SeriesPoint {
  percent: number;
  tone: string;
}

const TONES = ['brand-600', 'info-500', 'warning-500', 'success-500', 'ink-400'];

export const apportion = (points: readonly SeriesPoint[]): ProfileSlice[] => {
  const total = points.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) {
    return points.map((p, i) => ({ ...p, percent: 0, tone: TONES[i % TONES.length] }));
  }

  const exact = points.map((p) => (p.value / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, n) => sum + n, 0);

  /* The spare points go to the largest fractional parts first. */
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const percents = [...floors];
  for (const { index } of order) {
    if (left <= 0) break;
    percents[index] += 1;
    left -= 1;
  }

  return points.map((p, i) => ({ ...p, percent: percents[i], tone: TONES[i % TONES.length] }));
};

/**
 * The gender split of participants, as a ring with the headcount in the middle.
 *
 * The legend repeats every label with its count, so the chart never asks anyone
 * to read meaning out of colour alone.
 */
@Component({
  selector: 'app-gender-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-layout">
      <div class="donut">
        <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="summary()">
          <circle class="donut__track" cx="60" cy="60" r="46" />
          @for (arc of arcs(); track arc.label) {
            <circle
              class="donut__arc"
              cx="60"
              cy="60"
              r="46"
              [attr.stroke]="'var(--' + arc.tone + ')'"
              [attr.stroke-dasharray]="arc.dash"
              [attr.stroke-dashoffset]="arc.offset"
            >
              <title>{{ arc.label }}: {{ arc.value }} ({{ arc.percent }}%)</title>
            </circle>
          }
        </svg>
        <div class="donut__centre">
          <strong class="tabular">{{ total() }}</strong>
          <span>Participants</span>
        </div>
      </div>

      <ul class="legend">
        @for (slice of slices(); track slice.label) {
          <li class="legend__row">
            <span class="legend__dot" [style.background]="'var(--' + slice.tone + ')'"></span>
            <span class="legend__label">{{ slice.label }}</span>
            <span class="legend__value tabular">{{ slice.value }}</span>
            <span class="legend__pct tabular">{{ slice.percent }}%</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      /* Sized to sit beside its legend inside a third of the dashboard row.
         At the previous width the pair wrapped into a stack, which pushed this
         card's content well below the two panels either side of it. */
      .donut-layout {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .donut { position: relative; width: 130px; flex: none; }
      .donut svg {
        width: 100%;
        display: block;
        /* Twelve o'clock start: the first slice reads from the top. */
        transform: rotate(-90deg);
      }
      .donut__track { fill: none; stroke: var(--ink-100); stroke-width: 16; }
      .donut__arc {
        fill: none;
        stroke-width: 16;
        transition: stroke-dasharray 320ms ease-out;
      }
      .donut__centre {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 0.1rem;
        text-align: center;
        pointer-events: none;
      }
      .donut__centre strong { font-size: var(--fs-lg); color: var(--ink-900); line-height: 1.1; }
      .donut__centre span { font-size: 0.65rem; color: var(--ink-500); }
      .legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 132px; display: grid; gap: 0.55rem; }
      .legend__row {
        display: grid;
        grid-template-columns: 10px 1fr auto auto;
        align-items: center;
        gap: 0.45rem;
      }
      .legend__dot { width: 10px; height: 10px; border-radius: 50%; }
      .legend__label { font-size: var(--fs-sm); color: var(--ink-600); }
      .legend__value { font-size: var(--fs-sm); font-weight: 600; color: var(--ink-800); }
      .legend__pct {
        font-size: var(--fs-xs);
        color: var(--ink-500);
        min-width: 2.2rem;
        text-align: right;
      }
    `,
  ],
})
export class GenderDonutComponent {
  readonly data = input.required<SeriesPoint[]>();

  protected readonly slices = computed(() => apportion(this.data()));
  protected readonly total = computed(() => this.data().reduce((sum, p) => sum + p.value, 0));

  protected readonly summary = computed(() =>
    this.total() === 0
      ? 'No participants yet'
      : this.slices()
          .map((s) => `${s.label} ${s.percent}%`)
          .join(', '),
  );

  /** Ring geometry. Arcs are laid end to end by walking the dash offset back. */
  protected readonly arcs = computed(() => {
    const circumference = 2 * Math.PI * 46;
    const total = this.total();
    if (total === 0) return [];

    let consumed = 0;
    return this.slices()
      .filter((slice) => slice.value > 0)
      .map((slice) => {
        const length = (slice.value / total) * circumference;
        const arc = {
          ...slice,
          dash: `${length} ${circumference - length}`,
          offset: -consumed,
        };
        consumed += length;
        return arc;
      });
  });
}

/**
 * The social category split, as bars measured against the whole rather than
 * against the largest bar.
 *
 * Share of participants is the question being asked here, so a bar at 40% of
 * the track means 40% of participants — scaling to the biggest group instead
 * would make a majority and a plurality look identical.
 */
@Component({
  selector: 'app-share-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="shares">
      @for (slice of slices(); track slice.label) {
        <li class="shares__row">
          <span class="shares__label">{{ slice.label }}</span>
          <span class="shares__track">
            <span
              class="shares__fill"
              [style.width.%]="slice.percent"
              [style.background]="'var(--' + slice.tone + ')'"
            ></span>
          </span>
          <span class="shares__pct tabular">{{ slice.percent }}%</span>
          <span class="shares__value tabular">{{ slice.value }}</span>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      .shares { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
      .shares__row {
        display: grid;
        grid-template-columns: minmax(58px, 20%) 1fr auto auto;
        align-items: center;
        gap: 0.55rem;
      }
      .shares__label {
        font-size: var(--fs-sm);
        color: var(--ink-600);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .shares__track {
        height: 10px;
        border-radius: var(--radius-pill);
        background: var(--ink-100);
        overflow: hidden;
      }
      .shares__fill {
        display: block;
        height: 100%;
        border-radius: var(--radius-pill);
        transition: width 320ms ease-out;
      }
      .shares__pct {
        font-size: var(--fs-sm);
        font-weight: 600;
        color: var(--ink-800);
        min-width: 2.4rem;
        text-align: right;
      }
      .shares__value {
        font-size: var(--fs-xs);
        color: var(--ink-500);
        min-width: 2rem;
        text-align: right;
      }
    `,
  ],
})
export class ShareBarsComponent {
  readonly data = input.required<SeriesPoint[]>();

  protected readonly slices = computed(() => apportion(this.data()));
}
