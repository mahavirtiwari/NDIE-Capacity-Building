import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SeriesPoint } from '../../core/services/workflow.service';

/**
 * Single series column chart, read newest first and scrolled back through time.
 *
 * The bars keep a fixed width and the plot scrolls sideways rather than
 * squeezing more of them into the same space: twenty-four months crushed into
 * one card width is a texture, not a chart. The period the reader is standing
 * in sits at the left edge, where the eye lands first, and history runs away to
 * the right.
 *
 * Every bar carries its own number, so nothing has to be read off an axis that
 * is not drawn.
 */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" #scroller>
      <div class="chart__plot" [style.width.px]="plotWidth()">
        @for (bar of bars(); track bar.label) {
          <div class="col" [title]="bar.label + ': ' + bar.value">
            <span class="col__track">
              <span class="col__value tabular">{{ bar.value }}</span>
              <span
                class="col__fill"
                [class.is-empty]="bar.value === 0"
                [style.height]="bar.height"
              ></span>
            </span>
            <span class="col__tick">{{ bar.label }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* min-width:0 all the way down, so the oversized plot inside scrolls
         rather than widening every ancestor to fit it. */
      :host { display: block; min-width: 0; }
      .chart {
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        /* Room for the scrollbar so it never sits on top of the month labels. */
        padding-bottom: 0.2rem;
        scrollbar-width: thin;
      }
      .chart__plot {
        /* The strip the number sits in, kept out of the bar's own scale so a
           full-height bar still has its figure above it rather than clipped. */
        --value-strip: 1.05rem;
        display: flex;
        align-items: stretch;
        gap: 0.5rem;
        /* Fills the card rather than a fixed plot height, so the bars grow into
           whatever room the section gives them. */
        height: 100%;
        min-height: 190px;
      }
      .col {
        width: 44px;
        flex: none;
        display: grid;
        /* bar area / month label — the first row takes whatever is left, which
           is what makes the bars scale to the card. */
        grid-template-rows: 1fr auto;
        gap: 0.3rem;
        justify-items: stretch;
      }
      /* The column is packed from the bottom, so the number is the flex item
         directly above the fill and rides up and down with it. */
      .col__track {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        min-height: 0;
      }
      .col__value {
        flex: none;
        font-size: var(--fs-xs);
        font-weight: 600;
        color: var(--ink-700);
        line-height: 1;
        height: var(--value-strip);
        text-align: center;
      }
      .col__fill {
        flex: none;
        width: 100%;
        background: var(--brand-500);
        border-radius: 4px 4px 0 0;
        transition: height 320ms ease-out, background var(--transition);
        min-height: 2px;
      }
      .col__fill:hover { background: var(--brand-700); }
      /* A month with nothing in it shows a baseline, not an invisible gap. */
      .col__fill.is-empty { background: var(--ink-200); min-height: 2px; }
      .col__tick {
        font-size: var(--fs-xs);
        color: var(--ink-500);
        white-space: nowrap;
      }
    `,
  ],
})
export class BarChartComponent {
  readonly data = input.required<SeriesPoint[]>();

  private static readonly ColumnWidth = 44;
  private static readonly Gap = 8;

  /* Scaled to the tallest bar, so a series of small numbers still reads. A
     floor of 1 keeps an all-zero series from dividing by zero. */
  private readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));

  protected readonly bars = computed(() =>
    this.data().map((point) => ({
      label: point.label,
      value: point.value,
      /* Measured against the track minus the number's strip, so the tallest
         bar fills the space left over rather than overrunning it. */
      height: `calc((100% - var(--value-strip)) * ${point.value / this.max()})`,
    })),
  );

  /** Wide enough for every bar, which is what gives the container something to scroll. */
  protected readonly plotWidth = computed(() => {
    const count = this.bars().length;
    return count === 0
      ? 0
      : count * BarChartComponent.ColumnWidth + (count - 1) * BarChartComponent.Gap;
  });
}

type ToneKey = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface LabelledBar extends SeriesPoint {
  tone?: ToneKey;
}

/**
 * Horizontal labelled bars. Every row carries its own text label and value, so
 * identity never depends on colour alone.
 */
@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bar-list">
      @for (row of rows(); track row.label) {
        <li class="bar-list__row">
          <span class="bar-list__label" [title]="row.label">{{ row.label }}</span>
          <span class="bar-list__track">
            <span
              class="bar-list__fill"
              [class]="'bar-list__fill tone-' + (row.tone || 'primary')"
              [style.width.%]="row.percent"
            ></span>
          </span>
          <span class="bar-list__value tabular">{{ row.value }}</span>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      .bar-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; }
      .bar-list__row {
        display: grid;
        grid-template-columns: minmax(80px, 34%) 1fr auto;
        align-items: center;
        gap: 0.65rem;
      }
      .bar-list__label {
        font-size: var(--fs-sm);
        color: var(--ink-600);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bar-list__track {
        height: 8px;
        border-radius: var(--radius-pill);
        background: var(--ink-100);
        overflow: hidden;
      }
      .bar-list__fill {
        display: block;
        height: 100%;
        border-radius: var(--radius-pill);
        transition: width 320ms ease-out;
        min-width: 2px;
      }
      .tone-primary { background: var(--brand-500); }
      .tone-info { background: var(--info-500); }
      .tone-success { background: var(--success-500); }
      .tone-warning { background: var(--warning-500); }
      .tone-danger { background: var(--danger-500); }
      .tone-neutral { background: var(--ink-400); }
      .bar-list__value {
        font-size: var(--fs-sm);
        font-weight: 600;
        color: var(--ink-800);
        min-width: 2.2rem;
        text-align: right;
      }
    `,
  ],
})
export class BarListComponent {
  readonly data = input.required<LabelledBar[]>();

  protected readonly rows = computed(() => {
    const max = Math.max(1, ...this.data().map((d) => d.value));
    return this.data().map((d) => ({ ...d, percent: Math.round((d.value / max) * 100) }));
  });
}
