import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHostComponent } from '../shared/components/confirm-host.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

/** Below this the sidebar stops being a column and becomes a drawer. */
const MOBILE_QUERY = '(max-width: 900px)';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ConfirmHostComponent],
  template: `
    <div class="shell">
      <app-sidebar
        [collapsed]="collapsed()"
        [mobile]="isMobile()"
        (navigated)="onNavigated()"
      />

      <!-- On a phone the drawer floats over the page, so it needs a way out
           that is not the menu button. -->
      @if (isMobile() && !collapsed()) {
        <div
          class="shell__scrim"
          role="button"
          tabindex="0"
          aria-label="Close navigation"
          (click)="collapsed.set(true)"
          (keydown.enter)="collapsed.set(true)"
          (keydown.space)="collapsed.set(true)"
        ></div>
      }

      <div class="shell__main">
        <app-topbar (toggleSidebar)="collapsed.set(!collapsed())" />
        <main class="shell__content fade-in">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-confirm-host />
  `,
  styles: [
    `
      /* dvh, not vh: mobile browser chrome makes 100vh taller than the screen. */
      .shell { display: flex; min-height: 100dvh; }
      .shell__main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .shell__content {
        flex: 1;
        padding: 1.5rem;
        max-width: 1560px;
        width: 100%;
      }

      .shell__scrim {
        position: fixed;
        inset: 0;
        z-index: 85;
        background: rgba(15, 23, 42, 0.45);
        border: 0;
        animation: fade-in 140ms ease-out;
      }

      @media (max-width: 900px) {
        .shell__content { padding: 1rem; }
      }
      @media (max-width: 480px) {
        .shell__content { padding: 0.75rem; }
      }
    `,
  ],
})
export class ShellComponent {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isMobile = signal(matchMedia(MOBILE_QUERY).matches);
  /** On desktop this is the icon rail; on mobile it means the drawer is shut. */
  protected readonly collapsed = signal(matchMedia(MOBILE_QUERY).matches);

  constructor() {
    /* Rotating a tablet or dragging a window across the breakpoint has to be
       handled live, otherwise the drawer is left open over the content. */
    const query = matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      this.isMobile.set(event.matches);
      this.collapsed.set(event.matches);
    };
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }

  protected onNavigated(): void {
    if (this.isMobile()) this.collapsed.set(true);
  }
}
