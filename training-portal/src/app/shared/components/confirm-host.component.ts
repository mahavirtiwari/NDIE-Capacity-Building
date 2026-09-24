import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent],
  template: `
    @if (confirm.pending(); as dialog) {
      <app-modal [title]="dialog.title" size="sm" (closed)="confirm.settle(false)">
        <div class="row row-sm row-top">
          <span class="glyph" [class.is-danger]="dialog.tone === 'danger'">
            <app-icon [name]="dialog.tone === 'danger' ? 'alert' : 'help'" [size]="18" />
          </span>
          <p class="text-sm">{{ dialog.message }}</p>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="confirm.settle(false)">
            {{ dialog.cancelLabel }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--danger]="dialog.tone === 'danger'"
            [class.btn--primary]="dialog.tone !== 'danger'"
            (click)="confirm.settle(true)"
          >
            {{ dialog.confirmLabel }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .glyph {
        width: 34px;
        height: 34px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--brand-600);
        color: #fff;
      }
      .glyph.is-danger { background: var(--danger-700); color: #fff; }
    `,
  ],
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
}
