import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, IconName } from './icon.component';

const ICONS: Record<string, IconName> = {
  success: 'check',
  error: 'alert',
  warning: 'alert',
  info: 'info',
};

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast--' + toast.kind">
          <span class="toast__icon"><app-icon [name]="icon(toast.kind)" [size]="16" /></span>
          <div class="stack stack-xs flex-1">
            <strong class="text-sm">{{ toast.title }}</strong>
            @if (toast.message) {
              <span class="text-xs">{{ toast.message }}</span>
            }
          </div>
          <button type="button" class="btn btn--icon" aria-label="Dismiss" (click)="toasts.dismiss(toast.id)">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* Centred at the top of the viewport. Pinned to the right corner these
         sat under the account menu and ran off the edge of the window. */
      .toasts {
        position: fixed;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 200;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        width: max-content;
        max-width: min(380px, calc(100vw - 2rem));
        pointer-events: none;
      }
      .toast {
        /* The stack ignores clicks; each toast takes its own, so the close
           button still works. */
        pointer-events: auto;
        width: 100%;
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.7rem 0.8rem;
        border-radius: var(--radius);
        background: var(--surface);
        border: 1px solid var(--border);
        border-left: 3px solid var(--ink-400);
        box-shadow: var(--shadow);
        animation: fade-in 180ms ease-out;
      }
      .toast__icon {
        width: 24px;
        height: 24px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: 50%;
      }
      .toast--success { border-left-color: var(--success-500); }
      .toast--success .toast__icon { background: var(--success-700); color: #fff; }
      .toast--error { border-left-color: var(--danger-500); }
      .toast--error .toast__icon { background: var(--danger-700); color: #fff; }
      .toast--warning { border-left-color: var(--warning-500); }
      .toast--warning .toast__icon { background: var(--warning-700); color: #fff; }
      .toast--info { border-left-color: var(--brand-500); }
      .toast--info .toast__icon { background: var(--brand-600); color: #fff; }
    `,
  ],
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);

  protected icon(kind: string): IconName {
    return ICONS[kind] ?? 'info';
  }
}
