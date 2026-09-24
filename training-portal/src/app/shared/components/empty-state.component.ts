import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="empty-state">
      <span class="empty-state__icon"><app-icon [name]="icon()" [size]="22" /></span>
      <span class="empty-state__title">{{ title() }}</span>
      @if (message()) {
        <span class="text-sm">{{ message() }}</span>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input('Nothing here yet');
  readonly message = input<string>();
  readonly icon = input<IconName>('inbox');
}
