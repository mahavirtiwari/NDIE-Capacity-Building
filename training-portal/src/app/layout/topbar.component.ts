import { ChangeDetectionStrategy, Component, HostListener, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';
import { BrandingService } from '../core/services/branding.service';
import { IconComponent } from '../shared/components/icon.component';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
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

      <button type="button" class="btn btn--icon" aria-label="Notifications">
        <app-icon name="bell" [size]="18" />
      </button>

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

  readonly toggleSidebar = output<void>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.topbar__user')) this.menuOpen.set(false);
  }

  protected signOut(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }
}
