import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RecordStatus } from '../../core/models';
import { IconComponent } from './icon.component';

/**
 * Master records are never hard deleted — they are disabled so history and
 * downstream references stay intact. This button flips that flag.
 */
@Component({
  selector: 'app-status-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="btn btn--icon"
      [class.is-danger]="isActive()"
      [title]="label()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="toggled.emit(next())"
    >
      <app-icon [name]="isActive() ? 'lock' : 'check'" [size]="15" />
    </button>
  `,
})
export class StatusToggleComponent {
  readonly status = input.required<string>();
  readonly disabled = input(false);
  readonly toggled = output<RecordStatus>();

  protected readonly isActive = computed(() => this.status() === 'Active');
  protected readonly next = computed<RecordStatus>(() => (this.isActive() ? 'Inactive' : 'Active'));
  protected readonly label = computed(() => (this.isActive() ? 'Disable' : 'Enable'));
}
