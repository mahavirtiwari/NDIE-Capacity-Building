import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { BrandLogoComponent } from '../shared/components/brand-logo.component';
import { IconComponent } from '../shared/components/icon.component';
import { NAV_SECTIONS, NavItem } from './nav.config';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, BrandLogoComponent],
  template: `
    <aside
      class="sidebar"
      [class.is-collapsed]="collapsed()"
      [class.is-mobile]="mobile()"
      [attr.inert]="hidden() ? '' : null"
      [attr.aria-hidden]="hidden() ? 'true' : null"
    >
      <div class="sidebar__brand">
        @if (railed()) {
          <span class="sidebar__emblem">
            <app-icon name="graduation" [size]="20" />
          </span>
        } @else {
          <app-brand-logo [height]="56" />
        }
      </div>

      <nav class="sidebar__nav scroll-y">
        @for (item of items(); track item.route) {
          <a
            class="nav-link"
            [routerLink]="item.route"
            routerLinkActive="is-active"
            [title]="railed() ? item.label : ''"
            (click)="navigated.emit()"
          >
            <app-icon [name]="item.icon" [size]="17" />
            @if (!railed()) {
              <span class="nav-link__label">{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      @if (!collapsed()) {
        <div class="sidebar__foot">
          <span class="text-xs">Signed in as</span>
          <strong class="text-sm">{{ auth.user()?.roleName }}</strong>
        </div>
      }
    </aside>
  `,
  styles: [
    `
      .sidebar {
        width: var(--sidebar-w);
        background: var(--sidebar-bg);
        color: var(--ink-700);
        /* The page behind is a near neutral; without this the two pale
           surfaces would run together. */
        border-right: 1px solid var(--border-strong);
        display: flex;
        flex-direction: column;
        height: 100dvh;
        position: sticky;
        top: 0;
        transition: width var(--transition);
        flex: none;
      }
      .sidebar.is-collapsed { width: var(--sidebar-w-collapsed); }

      /* Phone and small tablet: a drawer over the page, not a column beside it.
         It keeps its full width off-canvas so it never clips the page. */
      .sidebar.is-mobile,
      .sidebar.is-mobile.is-collapsed {
        position: fixed;
        top: 0;
        left: 0;
        width: min(var(--sidebar-w), 86vw);
        height: 100dvh;
        z-index: 90;
        box-shadow: var(--shadow-lg);
        transform: translateX(0);
        transition: transform var(--transition);
      }
      .sidebar.is-mobile.is-collapsed { transform: translateX(-100%); box-shadow: none; }

      @media (prefers-reduced-motion: reduce) {
        .sidebar, .sidebar.is-mobile { transition: none; }
      }

      .sidebar__brand {
        display: flex;
        align-items: center;
        /* Centred, and taller than the top bar so the mark has room to breathe. */
        justify-content: center;
        padding: 1rem;
        min-height: var(--topbar-h);
        border-bottom: 1px solid var(--sidebar-line);
        flex: none;
      }
      .sidebar__emblem {
        width: 32px;
        height: 32px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: var(--radius);
        background: var(--brand-100);
        color: var(--brand-700);
      }

      .sidebar__nav {
        flex: 1;
        padding: 0.6rem 0.5rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .nav-link {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.6rem;
        border-radius: var(--radius);
        color: var(--ink-700);
        font-size: var(--fs-base);
        text-decoration: none;
        transition: background var(--transition), color var(--transition);
      }
      .nav-link:hover {
        background: var(--brand-100);
        color: var(--brand-800);
        text-decoration: none;
      }
      .nav-link.is-active {
        background: var(--brand-600);
        color: #fff;
        font-weight: 500;
      }
      .nav-link__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .sidebar__foot {
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--sidebar-line);
        display: flex;
        flex-direction: column;
        /* ink-500 fell to 4.15:1 on the pale panel; this clears AA. */
        color: var(--ink-600);
      }
      .sidebar__foot strong { color: var(--ink-900); }
    `,
  ],
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);

  readonly collapsed = input(false);
  /** Below the layout breakpoint the sidebar behaves as an off-canvas drawer. */
  readonly mobile = input(false);
  readonly navigated = output<void>();

  /** The narrow icon-only rail, which only exists on desktop. */
  protected readonly railed = computed(() => this.collapsed() && !this.mobile());
  /** Off-canvas: kept out of the tab order and the accessibility tree. */
  protected readonly hidden = computed(() => this.collapsed() && this.mobile());

  /** One continuous list of every destination the signed-in role can reach. */
  protected readonly items = computed<NavItem[]>(() => {
    this.auth.user();
    return NAV_SECTIONS.flatMap((section) => section.items).filter(
      (item) =>
        (!item.permissions || this.auth.hasPermission(item.permissions)) &&
        (!item.roles || this.auth.hasRole(...item.roles)),
    );
  });
}
