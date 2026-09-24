import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { BrandingService } from '../../core/services/branding.service';
import { IconComponent } from './icon.component';

/**
 * The portal lockup. Renders the logo Super Admin uploaded under
 * Administration → Branding, and falls back to a text wordmark when none has
 * been set or the image fails to load, so the header is never broken.
 *
 * Every surface it sits on is light, so the mark is always shown in its own
 * colours — there is no knock-out variant to get wrong.
 */
@Component({
  selector: 'app-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (src(); as logo) {
      <img
        class="brand__image"
        [style.height.px]="height()"
        [src]="logo"
        [alt]="organisation()"
        (error)="failed.set(logo)"
      />
    } @else {
      <span class="brand__fallback">
        <span class="brand__emblem"><app-icon name="graduation" [size]="18" /></span>
        <span class="brand__words">
          <strong>{{ shortName() }}</strong>
          <small>{{ organisation() }}</small>
        </span>
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; align-items: center; min-width: 0; }

      .brand__image { width: auto; max-width: 100%; object-fit: contain; }

      .brand__fallback { display: inline-flex; align-items: center; gap: 0.55rem; min-width: 0; }
      .brand__emblem {
        width: 32px;
        height: 32px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: var(--radius);
        background: var(--brand-600);
        color: #fff;
      }
      .brand__words { display: flex; flex-direction: column; min-width: 0; }
      .brand__words strong {
        font-size: var(--fs-md);
        color: var(--ink-900);
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .brand__words small {
        font-size: var(--fs-xs);
        color: var(--ink-500);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

    `,
  ],
})
export class BrandLogoComponent {
  private readonly branding = inject(BrandingService);

  readonly height = input(34);
  /** Which uploaded mark to show: the organisation's, or the partner's. */
  readonly slot = input<'primary' | 'partner'>('primary');

  /** The URL that failed, so a later upload is retried rather than suppressed. */
  protected readonly failed = signal<string | null>(null);

  protected readonly shortName = computed(() =>
    this.slot() === 'partner' ? this.branding.partnerName() : this.branding.shortName(),
  );
  protected readonly organisation = computed(() =>
    this.slot() === 'partner' ? this.branding.partnerName() : this.branding.organisationName(),
  );
  protected readonly src = computed(() => {
    const url =
      this.slot() === 'partner' ? this.branding.partnerLogoSrc() : this.branding.logoSrc();
    return url && url !== this.failed() ? url : null;
  });
}
