import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';
import { BrandingService } from '../core/services/branding.service';
import { MyNotificationsService } from '../core/services/my-notifications.service';
import { IconComponent } from '../shared/components/icon.component';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <header class="topbar">
      <button type="button" class="btn btn--icon" (click)="toggleSidebar.emit()" aria-label="Toggle navigation">
        <app-icon name="menu" [size]="18" />
      </button>

      <div class="topbar__title">
        <strong>{{ appName() }}</strong>
        @if (usingMockApi) {
          <span class="chip" title="Serving data from the in-browser mock">Mock API</span>
        }
      </div>

      <div class="topbar__spacer"></div>

      <!-- What the scheme has said to this account: a programme waiting
           on their permission, a report sent back. It was a button with
           nothing behind it, so the only word anybody got was an e-mail -
           read wherever mail is read, which is not the screen where the
           thing is actually done. -->
      <div class="topbar__bell">
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Notifications"
          (click)="toggleBell()"
        >
          <app-icon name="bell" [size]="18" />
          @if (notices.unread() > 0) {
            <span class="bell__count">{{ notices.unread() > 9 ? '9+' : notices.unread() }}</span>
          }
        </button>

        @if (bellOpen()) {
          <div class="menu menu--wide">
            <div class="menu__head">
              <strong class="text-sm">Notifications</strong>
              @if (notices.unread() > 0) {
                <span class="text-xs text-muted">{{ notices.unread() }} unread</span>
              }
            </div>

            @if (notices.items().length === 0) {
              <p class="menu__empty">Nothing yet.</p>
            } @else {
              <div class="menu__list">
                @for (notice of notices.items(); track notice.id) {
                  <button
                    type="button"
                    class="notice"
                    [class.notice--unread]="!notice.read"
                    (click)="openNotice(notice)"
                  >
                    <span class="notice__title">{{ notice.title }}</span>
                    <span class="notice__body">{{ notice.body }}</span>
                    <span class="notice__when">{{ notice.sentOn | date: 'dd MMM, HH:mm' }}</span>
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      <div class="topbar__user">
        <button type="button" class="user-trigger" (click)="menuOpen.set(!menuOpen())">
          <span class="avatar">{{ auth.initials() }}</span>
          <span class="stack user-trigger__text">
            <strong class="text-sm">{{ auth.displayName() }}</strong>
            <span class="text-xs text-muted">{{ auth.user()?.roleName }}</span>
          </span>
          <app-icon name="chevron-down" [size]="14" />
        </button>

        @if (menuOpen()) {
          <div class="menu">
            <a class="menu__item" routerLink="/profile" (click)="menuOpen.set(false)">
              <app-icon name="settings" [size]="15" /> My profile
            </a>
            <div class="divider"></div>
            <button type="button" class="menu__item is-danger" (click)="signOut()">
              <app-icon name="logout" [size]="15" /> Sign out
            </button>
          </div>
        }
      </div>
    </header>
  `,
  styles: [
    `
      .topbar {
        height: var(--topbar-h);
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0 1rem;
        position: sticky;
        top: 0;
        z-index: 60;
      }
      .topbar__title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: var(--fs-md);
        color: var(--ink-900);
      }
      .topbar__spacer { flex: 1; }

      /* The bell, and what hangs under it. */
      .topbar__bell { position: relative; }
      .bell__count {
        position: absolute;
        top: 2px;
        right: 2px;
        min-width: 15px;
        height: 15px;
        padding: 0 3px;
        border-radius: 999px;
        background: var(--danger-600, #b3300d);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        line-height: 15px;
        text-align: center;
      }
      /* Written as .menu.menu--wide so it outranks .menu rather than
         merely disagreeing with it.

         Both carry one class and one scoping attribute, so they had the
         same weight and the later one won - and .menu is declared further
         down this file. The notifications panel was therefore 190px wide
         with the base padding, not the 320 it asks for: every notice wrapped
         its title over two lines and its body over five, and a panel
         narrower than the sentence it holds reads as a column of fragments.
         Qualifying it settles the question by weight instead of by
         position, so moving either rule cannot bring the fault back. */
      .menu.menu--wide { min-width: 320px; max-width: 360px; padding: 0; }
      .menu__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.6rem 0.75rem;
        border-bottom: 1px solid var(--border);
      }
      .menu__empty {
        margin: 0;
        padding: 1rem 0.75rem;
        font-size: var(--fs-sm);
        color: var(--ink-500);
        text-align: center;
      }
      /* As much of the list as the window can show, and no more.

         A flat 340px is two and a half notices whatever the screen is:
         short enough to hide most of the list on a desktop, and tall
         enough to run off the bottom of a laptop once the panel's own
         header is added to it. Measured against the viewport instead, with
         the ceiling kept so it does not become a full-height column on a
         tall monitor. */
      .menu__list { max-height: min(60vh, 420px); overflow-y: auto; }
      .notice {
        display: grid;
        gap: 2px;
        width: 100%;
        text-align: left;
        padding: 0.6rem 0.75rem;
        border: 0;
        border-bottom: 1px solid var(--border);
        background: transparent;
        font: inherit;
        cursor: pointer;
      }
      .notice:last-child { border-bottom: 0; }
      .notice:hover { background: var(--ink-100); }
      /* Unread carries the brand tint and a weight, so a glance down the
         list separates what is new from what has been seen. */
      .notice--unread { background: var(--brand-50); }
      .notice__title {
        font-size: var(--fs-sm);
        font-weight: 700;
        color: var(--ink-900);
      }
      .notice__body {
        font-size: var(--fs-sm);
        color: var(--ink-600);
        line-height: 1.35;
      }
      .notice__when { font-size: var(--fs-xs); color: var(--ink-400); }
      .topbar__user { position: relative; }
      .user-trigger {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius);
        padding: 0.25rem 0.45rem;
        cursor: pointer;
        font: inherit;
        color: inherit;
      }
      .user-trigger:hover { background: var(--ink-100); }
      .user-trigger__text { text-align: left; line-height: 1.2; }
      .menu {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        min-width: 190px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        padding: 0.3rem;
        z-index: 70;
        animation: fade-in 140ms ease-out;
      }
      .menu__item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.45rem 0.55rem;
        border: 0;
        background: transparent;
        border-radius: var(--radius-sm);
        font: inherit;
        font-size: var(--fs-base);
        color: var(--ink-700);
        cursor: pointer;
        text-decoration: none;
      }
      .menu__item:hover { background: var(--ink-100); text-decoration: none; }
      .menu__item.is-danger { color: var(--danger-700); }
      .menu__item.is-danger:hover { background: var(--danger-50); }

      @media (max-width: 700px) {
        .topbar__title strong { display: none; }
        .user-trigger__text { display: none; }
      }
    `,
  ],
})
export class TopbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly appName = inject(BrandingService).portalTitle;
  protected readonly usingMockApi = environment.useMockApi;
  protected readonly menuOpen = signal(false);

  protected readonly notices = inject(MyNotificationsService);
  private readonly router = inject(Router);
  protected readonly bellOpen = signal(false);

  readonly toggleSidebar = output<void>();

  constructor() {
    /* Once, when the bar is first put up. The count is refreshed when the
       panel is opened rather than on a timer: a poll every minute on
       every open tab is a lot of traffic for a number that changes a
       handful of times a day. */
    this.notices.refresh();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.topbar__user')) this.menuOpen.set(false);
    if (!target.closest('.topbar__bell')) this.bellOpen.set(false);
  }

  protected toggleBell(): void {
    const opening = !this.bellOpen();
    this.bellOpen.set(opening);
    this.menuOpen.set(false);
    if (opening) this.notices.refresh();
  }

  /**
   * Opens what a notice is about, and marks it read on the way.
   *
   * Read means seen rather than acted on: somebody who opens the notice
   * about a programme waiting on them has seen it, whether or not they
   * permit it there and then.
   */
  protected openNotice(notice: { id: number; read: boolean; linkPath?: string | null }): void {
    this.notices.markRead(notice.id);
    this.bellOpen.set(false);
    if (notice.linkPath) void this.router.navigateByUrl(notice.linkPath);
  }

  protected signOut(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }
}
