import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="stat" [class]="'stat stat--' + tone()">
      <span class="stat__icon"><app-icon [name]="icon()" [size]="18" /></span>
      <div class="stack stack-xs flex-1">
        <span class="stat__label">{{ label() }}</span>
        <span class="stat__value tabular">{{ value() }}{{ suffix() }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .stat {
        display: flex;
        gap: 0.85rem;
        align-items: center;
        /* Fixed height keeps every tile on the KPI row the same size. */
        height: 84px;
        box-sizing: border-box;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 1rem;
        box-shadow: var(--shadow-xs);
        transition: box-shadow var(--transition), transform var(--transition);
      }
      .stat:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
      .stat__icon {
        width: 36px;
        height: 36px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: var(--radius);
        background: var(--brand-600);
        color: #fff;
      }
      .stat--success .stat__icon { background: var(--success-700); color: #fff; }
      .stat--warning .stat__icon { background: var(--warning-700); color: #fff; }
      .stat--danger .stat__icon { background: var(--danger-700); color: #fff; }
      .stat--info .stat__icon { background: var(--info-700); color: #fff; }
      /* Two lines' worth of room whether the label needs them or not.

         The tiles are a fixed height and centred, so a label that wraps
         pushed its own figure down: "Programs conducted" and "Candidates
         participated" sat nine pixels below "Profiles received" on the
         same row, and a row of figures that do not line up is the first
         thing the eye catches on a dashboard. */
      .stat__label {
        min-height: calc(var(--fs-xs) * 1.5 * 2);
        font-size: var(--fs-xs);
        line-height: 1.5;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-500);
        font-weight: 600;
      }
      .stat__value {
        font-size: var(--fs-2xl);
        font-weight: 600;
        color: var(--ink-900);
        line-height: 1.1;
      }
    `,
  ],
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly icon = input<IconName>('inbox');
  readonly tone = input<'primary' | 'success' | 'warning' | 'danger' | 'info'>('primary');
  readonly suffix = input('');
}
