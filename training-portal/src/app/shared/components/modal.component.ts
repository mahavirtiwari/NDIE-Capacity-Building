import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Lightweight dialog. Usage:
 * <app-modal title="Edit" (closed)="close()"> body <div footer>actions</div> </app-modal>
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="backdrop" (click)="onBackdrop($event)">
      <div
        class="dialog"
        [class]="'dialog dialog--' + size()"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()"
      >
        <header class="dialog__header">
          <div class="stack stack-xs">
            <h2 class="dialog__title">{{ title() }}</h2>
            @if (subtitle()) {
              <span class="text-sm text-muted">{{ subtitle() }}</span>
            }
          </div>
          <button type="button" class="btn btn--icon" aria-label="Close" (click)="closed.emit()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>
        <div class="dialog__body">
          <ng-content />
        </div>
        <footer class="dialog__footer">
          <ng-content select="[footer]" />
        </footer>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 3rem 1rem;
        overflow-y: auto;
        z-index: 120;
        animation: fade-in 140ms ease-out;
      }
      .dialog {
        background: var(--surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        width: 100%;
        max-width: 560px;
        display: flex;
        flex-direction: column;
        /* dvh so the footer is not pushed under the mobile address bar. */
        max-height: calc(100dvh - 6rem);
      }
      .dialog--sm { max-width: 420px; }
      .dialog--lg { max-width: 820px; }
      .dialog--xl { max-width: 1100px; }

      /* A phone has no room for a 3rem frame; give the dialog the screen. */
      @media (max-width: 600px) {
        .backdrop { padding: 0.75rem; align-items: stretch; }
        .dialog { max-height: calc(100dvh - 1.5rem); }
        .dialog__header,
        .dialog__body,
        .dialog__footer { padding-inline: 1rem; }
        .dialog__footer { flex-wrap: wrap; }
        .dialog__footer .btn { flex: 1 1 auto; justify-content: center; }
      }
      .dialog__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--border);
      }
      .dialog__title { font-size: var(--fs-lg); }
      .dialog__body {
        padding: 1.25rem;
        overflow-y: auto;
        flex: 1;
      }
      .dialog__footer {
        padding: 0.85rem 1.25rem;
        border-top: 1px solid var(--border);
        background: var(--surface-muted);
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .dialog__footer:empty { display: none; }
    `,
  ],
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly closeOnBackdrop = input(true);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    event.stopPropagation();
    if (this.closeOnBackdrop()) this.closed.emit();
  }
}
