import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="notice">
      <span class="notice__icon"><app-icon name="search" [size]="26" /></span>
      <h1>Page not found</h1>
      <p class="text-muted">The screen you are looking for has moved or never existed.</p>
      <a class="btn btn--primary" routerLink="/dashboard">Back to dashboard</a>
    </div>
  `,
  styles: [
    `
      .notice {
        max-width: 420px;
        margin: 4rem auto;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }
      .notice__icon {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--ink-700);
        color: #fff;
      }
    `,
  ],
})
export class NotFoundComponent {}
