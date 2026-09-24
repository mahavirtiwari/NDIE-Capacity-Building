import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from './icon.component';

export interface Crumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <header class="page-header">
      <div class="page-header__main">
        @if (breadcrumbs().length) {
          <nav class="crumbs" aria-label="Breadcrumb">
            @for (crumb of breadcrumbs(); track crumb.label; let last = $last) {
              @if (crumb.link && !last) {
                <a [routerLink]="crumb.link">{{ crumb.label }}</a>
              } @else {
                <span>{{ crumb.label }}</span>
              }
              @if (!last) {
                <app-icon name="chevron-right" [size]="12" />
              }
            }
          </nav>
        }
        <h1 class="page-header__title">
          @if (icon()) {
            <span class="page-header__icon"><app-icon [name]="icon()!" [size]="20" /></span>
          }
          {{ title() }}
        </h1>
        @if (subtitle()) {
          <p class="page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1.25rem;
      }
      .page-header__main { min-width: 0; }
      .crumbs {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: var(--fs-xs);
        color: var(--ink-500);
        margin-bottom: 0.35rem;
      }
      .crumbs a { color: var(--ink-500); }
      .crumbs a:hover { color: var(--brand-600); }
      .crumbs span:last-child { color: var(--ink-700); font-weight: 500; }
      .page-header__title {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: var(--fs-2xl);
        letter-spacing: -0.01em;
      }
      .page-header__icon {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: var(--radius);
        background: var(--brand-600);
        color: #fff;
        border: 1px solid var(--brand-100);
      }
      .page-header__subtitle {
        margin: 0.3rem 0 0;
        color: var(--ink-500);
        font-size: var(--fs-base);
        max-width: 68ch;
      }
      .page-header__actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<IconName>();
  readonly breadcrumbs = input<Crumb[]>([]);
}
