import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TimelineEvent } from '../../core/models';

/**
 * What happened to something, in order.
 *
 * One component for the applicant, the portal user and the implementing
 * agency, because the three answer the same question and reading them
 * should feel the same. The rail down the left makes a long life read as
 * one sequence; the coloured dot lets somebody scanning for the money or
 * the rejections find them without reading every line.
 *
 * Each entry is three lines at most. What happened and when belong on the
 * same line — the eye goes down the left for the event and down the right
 * for the date — and the reference and the person who did it are one quiet
 * line underneath, because they are what you check after you have found
 * the entry rather than what helps you find it.
 */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (events().length === 0) {
      <p class="text-muted text-sm">{{ emptyMessage() }}</p>
    } @else {
      <ol class="timeline">
        @for (event of events(); track $index) {
          <li class="timeline__item">
            <span
              class="timeline__dot"
              [class]="'timeline__dot--' + event.area.toLowerCase()"
            ></span>
            <div class="timeline__body">
              <div class="timeline__head">
                <span class="timeline__title">{{ event.title }}</span>
                <span class="chip chip--muted timeline__area">{{ event.area }}</span>
                <time class="timeline__when tabular">
                  {{ event.on | date: 'dd MMM yyyy, HH:mm' }}
                </time>
              </div>

              @if (event.detail) {
                <p class="timeline__detail">{{ event.detail }}</p>
              }

              @if (event.reference || event.by) {
                <p class="timeline__meta">
                  @if (event.reference) {
                    <span class="timeline__ref">{{ event.reference }}</span>
                  }
                  @if (event.reference && event.by) {
                    <span class="timeline__sep" aria-hidden="true">·</span>
                  }
                  @if (event.by) {
                    <span>by {{ event.by }}</span>
                  }
                </p>
              }
            </div>
          </li>
        }
      </ol>
    }
  `,
  styles: [
    `
      .timeline {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .timeline__item {
        position: relative;
        display: flex;
        gap: 0.8rem;
        padding: 0.5rem 0.6rem 0.9rem 0.2rem;
        border-radius: var(--radius);
      }

      /* The rail, drawn between the dots rather than behind them. */
      .timeline__item::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 1.55rem;
        bottom: 0;
        width: 2px;
        border-radius: 1px;
        background: var(--border);
      }

      .timeline__item:last-child::before {
        display: none;
      }

      .timeline__item:last-child {
        padding-bottom: 0.2rem;
      }

      .timeline__dot {
        flex: 0 0 auto;
        width: 12px;
        height: 12px;
        margin-top: 0.28rem;
        border-radius: 50%;
        background: var(--ink-400);
        /* A ring in the surface colour, so the rail stops at the dot
           instead of running under it. */
        box-shadow: 0 0 0 3px var(--surface);
        z-index: 1;
      }

      /* One colour per area, the same on all three screens. */
      .timeline__dot--account { background: var(--ink-500); }
      .timeline__dot--profile { background: var(--brand-600); }
      .timeline__dot--application { background: #2563eb; }
      .timeline__dot--payment { background: #16a34a; }
      .timeline__dot--programme { background: #d97706; }
      .timeline__dot--certificate { background: var(--brand-700); }
      .timeline__dot--empanelment { background: var(--brand-600); }
      .timeline__dot--login { background: #2563eb; }
      .timeline__dot--coordinator { background: #0891b2; }

      .timeline__body {
        flex: 1;
        min-width: 0;
      }

      .timeline__head {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .timeline__title {
        font-weight: 600;
        color: var(--ink-800);
        line-height: 1.3;
      }

      /* Pushed to the right edge, so a long history can be read down the
         date column alone. */
      .timeline__when {
        margin-left: auto;
        font-size: var(--fs-xs);
        color: var(--ink-500);
        white-space: nowrap;
      }

      .timeline__detail {
        margin: 0.25rem 0 0;
        font-size: var(--fs-sm);
        color: var(--ink-600);
        line-height: 1.45;
      }

      .timeline__meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin: 0.3rem 0 0;
        font-size: var(--fs-xs);
        color: var(--ink-500);
      }

      .timeline__ref {
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
        font-size: var(--fs-xs);
        color: var(--ink-600);
        background: var(--surface-muted);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.05rem 0.35rem;
      }

      .timeline__sep {
        color: var(--ink-400);
      }

      /* Narrow: the date drops under the title rather than squeezing it. */
      @media (max-width: 520px) {
        .timeline__when {
          margin-left: 0;
          flex-basis: 100%;
        }
      }
    `,
  ],
})
export class TimelineComponent {
  readonly events = input<TimelineEvent[]>([]);
  readonly emptyMessage = input('Nothing has happened yet.');
}
