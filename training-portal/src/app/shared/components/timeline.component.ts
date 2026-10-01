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
                <span class="chip chip--muted">{{ event.area }}</span>
              </div>
              <div class="timeline__when tabular">
                {{ event.on | date: 'dd MMM yyyy, HH:mm' }}
              </div>
              @if (event.reference) {
                <div class="timeline__ref">{{ event.reference }}</div>
              }
              @if (event.detail) {
                <div class="timeline__detail">{{ event.detail }}</div>
              }
              @if (event.by) {
                <div class="timeline__by">by {{ event.by }}</div>
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
        gap: 0.75rem;
        padding: 0 0 0.9rem 0;
      }

      /* The rail, drawn between the dots rather than behind them. */
      .timeline__item::before {
        content: '';
        position: absolute;
        left: 5px;
        top: 1.1rem;
        bottom: 0;
        width: 1px;
        background: var(--border);
      }

      .timeline__item:last-child::before {
        display: none;
      }

      .timeline__dot {
        flex: 0 0 auto;
        width: 11px;
        height: 11px;
        margin-top: 0.3rem;
        border-radius: 50%;
        background: var(--ink-400);
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
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .timeline__title {
        font-weight: 600;
        color: var(--ink-800);
      }

      .timeline__when {
        font-size: var(--fs-xs);
        color: var(--ink-500);
      }

      .timeline__ref {
        font-size: var(--fs-xs);
        color: var(--ink-600);
      }

      .timeline__detail {
        font-size: var(--fs-sm);
        color: var(--ink-600);
        line-height: 1.45;
        margin-top: 0.15rem;
      }

      .timeline__by {
        font-size: var(--fs-xs);
        color: var(--ink-500);
        margin-top: 0.1rem;
      }
    `,
  ],
})
export class TimelineComponent {
  readonly events = input<TimelineEvent[]>([]);
  readonly emptyMessage = input('Nothing has happened yet.');
}
