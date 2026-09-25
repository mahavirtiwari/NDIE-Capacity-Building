import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrandingService } from '../../core/services/branding.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { describeError, formatValidator } from '../../core/validation/formats';
import { LogoSlot } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm.service';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/** Matches the server-side allow-list in BrandingService. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_BYTES = 512 * 1024;

/**
 * Super Admin edits the portal identity here: the names shown across the
 * portal, the mobile app and outgoing email, plus the logo itself. Everything
 * is stored server side, so one change reaches every client.
 */
@Component({
  selector: 'app-branding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, IconComponent],
  template: `
    <app-page-header
      [title]="copy.text('page.branding.title')"
      [subtitle]="copy.text('page.branding.subtitle')"
      icon="settings"
      [breadcrumbs]="[{ label: 'Administration' }, { label: copy.text('page.branding.title') }]"
    />

    <div class="brand-grid">
      <section class="card">
        <div class="card__header">
          <span class="card__title">Logo</span>
          @if (branding.branding().hasLogo) {
            <span class="chip">{{ branding.branding().logoFileName }}</span>
          }
        </div>
        <div class="card__body stack stack-md">
          <div class="logo-previews">
            <div class="logo-preview">
              <span class="logo-preview__label">On white</span>
              <div class="logo-preview__box">
                @if (previewSrc(); as src) {
                  <img [src]="src" alt="Logo preview" />
                } @else {
                  <span class="text-sm text-muted">No logo uploaded</span>
                }
              </div>
            </div>
            <div class="logo-preview">
              <span class="logo-preview__label">On the sidebar</span>
              <div class="logo-preview__box logo-preview__box--sidebar">
                @if (previewSrc(); as src) {
                  <img [src]="src" alt="Logo preview on the sidebar" />
                } @else {
                  <span class="text-sm text-muted">No logo uploaded</span>
                }
              </div>
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="brLogoLink">Logo links to</label>
            <input
              id="brLogoLink"
              type="url"
              class="input"
              placeholder="https://ndie.gov.in"
              [value]="branding.branding().logoLinkUrl ?? ''"
              (change)="saveLogoLink('primary', $event)"
            />
            <span class="field-hint">
              Optional. With an address here the mark becomes a link and opens it in a new tab.
              Leave it blank and the mark is just an image.
            </span>
          </div>

          <div class="field">
            <label class="field-label" for="brLogo">Replace logo</label>
            <input
              id="brLogo"
              type="file"
              class="input"
              [accept]="accept"
              (change)="pick($event)"
            />
            <span class="field-hint">
              PNG, JPEG, SVG or WebP up to 512&nbsp;KB. A transparent PNG at roughly 240&times;80
              works best. Crop the transparent margin, or the mark will sit
              visibly inset from the text beside it.
            </span>
            @if (fileError(); as error) {
              <span class="field-error">{{ error }}</span>
            }
          </div>

          <div class="btn-row btn-row--end">
            @if (branding.branding().hasLogo) {
              <button type="button" class="btn btn--ghost" (click)="removeLogo()">
                <app-icon name="trash" [size]="15" />
                Remove logo
              </button>
            }
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="!selected() || uploading()"
              (click)="upload()"
            >
              <app-icon name="upload" [size]="15" />
              {{ uploading() ? 'Uploading…' : 'Upload logo' }}
            </button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card__header">
          <span class="card__title">Partner logo</span>
          @if (branding.branding().hasPartnerLogo) {
            <span class="chip">{{ branding.branding().partnerLogoFileName }}</span>
          }
        </div>
        <div class="card__body stack stack-md">
          <div class="logo-preview">
            <span class="logo-preview__label">On the sign-in panel</span>
            <div class="logo-preview__box">
              @if (partnerPreviewSrc(); as src) {
                <img [src]="src" alt="Partner logo preview" />
              } @else {
                <span class="text-sm text-muted">No partner logo uploaded</span>
              }
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="brPartnerName">Partner name</label>
            <input
              id="brPartnerName"
              class="input"
              [value]="branding.branding().partnerName ?? ''"
              maxlength="120"
              placeholder="e.g. Quality Council of India"
              (change)="savePartnerName($event)"
            />
            <span class="field-hint">
              Used as the image's alt text, and shown in place of the mark if it fails to load.
            </span>
          </div>

          <div class="field">
            <label class="field-label" for="brPartnerLink">Partner logo links to</label>
            <input
              id="brPartnerLink"
              type="url"
              class="input"
              placeholder="https://qcin.org"
              [value]="branding.branding().partnerLogoLinkUrl ?? ''"
              (change)="saveLogoLink('partner', $event)"
            />
            <span class="field-hint">Optional. Usually the partner's own site.</span>
          </div>

          <div class="field">
            <label class="field-label" for="brPartnerLogo">Replace partner logo</label>
            <input
              id="brPartnerLogo"
              type="file"
              class="input"
              [accept]="accept"
              (change)="pick($event, 'partner')"
            />
            <span class="field-hint">
              Same limits as above. Shown at the opposite end of the sign-in header from the
              main mark, so a similar aspect ratio sits best.
            </span>
            @if (partnerFileError(); as error) {
              <span class="field-error">{{ error }}</span>
            }
          </div>

          <div class="btn-row btn-row--end">
            @if (branding.branding().hasPartnerLogo) {
              <button type="button" class="btn btn--ghost" (click)="removeLogo('partner')">
                <app-icon name="trash" [size]="15" />
                Remove
              </button>
            }
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="!partnerSelected() || uploading()"
              (click)="upload('partner')"
            >
              <app-icon name="upload" [size]="15" />
              {{ uploading() ? 'Uploading…' : 'Upload partner logo' }}
            </button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card__header"><span class="card__title">Names</span></div>
        <div class="card__body">
          <form [formGroup]="form" class="stack stack-md" (ngSubmit)="save()">
            <div class="field">
              <label class="field-label" for="brOrg">Organisation name</label>
              <input id="brOrg" class="input" formControlName="organisationName" maxlength="200"
                [class.is-invalid]="invalid('organisationName')" />
              <span class="field-hint">Shown under the logo and in email signatures.</span>
              @if (invalid('organisationName')) {
                <span class="field-error">{{ errorFor('organisationName', 'Organisation name') }}</span>
              }
            </div>

            <div class="field">
              <label class="field-label" for="brShort">Short name</label>
              <input id="brShort" class="input" formControlName="shortName" maxlength="40"
                [class.is-invalid]="invalid('shortName')" />
              <span class="field-hint">Used where space is tight, for example “NDIE”.</span>
              @if (invalid('shortName')) {
                <span class="field-error">{{ errorFor('shortName', 'Short name') }}</span>
              }
            </div>

            <div class="field">
              <label class="field-label" for="brTitle">Portal title</label>
              <input id="brTitle" class="input" formControlName="portalTitle" maxlength="200"
                [class.is-invalid]="invalid('portalTitle')" />
              <span class="field-hint">The heading in the top bar and the browser tab.</span>
              @if (invalid('portalTitle')) {
                <span class="field-error">{{ errorFor('portalTitle', 'Portal title') }}</span>
              }
            </div>

            <div class="field">
              <label class="field-label" for="brTagline">Tagline</label>
              <input id="brTagline" class="input" formControlName="tagline" maxlength="300" />
              <span class="field-hint">Optional. Appears on the sign-in panel.</span>
            </div>

            <div class="field">
              <label class="field-label" for="brSupport">Support email</label>
              <input id="brSupport" type="email" class="input" formControlName="supportEmail" maxlength="200"
                placeholder="Enter email address"
                [class.is-invalid]="invalid('supportEmail')" />
              @if (invalid('supportEmail')) {
                <span class="field-error">{{ errorFor('supportEmail', 'Support email') }}</span>
              }
            </div>

            <div class="btn-row btn-row--end">
              <button type="button" class="btn btn--ghost" (click)="reset()">Reset</button>
              <button type="submit" class="btn btn--primary" [disabled]="saving()">
                <app-icon name="save" [size]="15" />
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .brand-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 1rem;
        align-items: start;
      }

      .logo-previews {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .logo-preview { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
      .logo-preview__label { font-size: var(--fs-xs); color: var(--ink-500); }
      .logo-preview__box {
        height: 92px;
        display: grid;
        place-items: center;
        padding: 0.75rem;
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius);
        background: #fff;
      }
      .logo-preview__box--sidebar { background: var(--sidebar-bg); border-color: var(--sidebar-line); }
      .logo-preview__box img { max-height: 100%; max-width: 100%; object-fit: contain; }

      @media (max-width: 560px) {
        .logo-previews { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class BrandingComponent {
  protected readonly copy = inject(SiteTextService);
  protected readonly branding = inject(BrandingService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly accept = ACCEPTED.join(',');
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly selected = signal<File | null>(null);
  protected readonly fileError = signal('');
  protected readonly partnerSelected = signal<File | null>(null);
  protected readonly partnerFileError = signal('');
  /** Local object URLs for the picked files, so previews update before upload. */
  private readonly localPreview = signal<string | null>(null);
  private readonly partnerLocalPreview = signal<string | null>(null);

  protected readonly previewSrc = computed(
    () => this.localPreview() ?? this.branding.logoSrc(),
  );
  protected readonly partnerPreviewSrc = computed(
    () => this.partnerLocalPreview() ?? this.branding.partnerLogoSrc(),
  );

  protected readonly form = this.fb.nonNullable.group({
    organisationName: ['', [Validators.required, Validators.maxLength(200)]],
    shortName: ['', [Validators.required, Validators.maxLength(40)]],
    portalTitle: ['', [Validators.required, Validators.maxLength(200)]],
    tagline: [''],
    supportEmail: ['', formatValidator('email')],
  });

  constructor() {
    /* Keep the form in step with whatever the service holds, including the
       value that comes back from a save. */
    effect(() => {
      const current = this.branding.branding();
      if (this.form.dirty) return;
      this.form.reset({
        organisationName: current.organisationName,
        shortName: current.shortName,
        portalTitle: current.portalTitle,
        tagline: current.tagline ?? '',
        supportEmail: current.supportEmail ?? '',
      });
    });
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected errorFor(control: string, label: string): string {
    return describeError(this.form.get(control)?.errors ?? null, label);
  }

  protected reset(): void {
    this.form.markAsPristine();
    const current = this.branding.branding();
    this.form.reset({
      organisationName: current.organisationName,
      shortName: current.shortName,
      portalTitle: current.portalTitle,
      tagline: current.tagline ?? '',
      supportEmail: current.supportEmail ?? '',
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.branding
      .save({
        organisationName: raw.organisationName.trim(),
        shortName: raw.shortName.trim(),
        portalTitle: raw.portalTitle.trim(),
        tagline: raw.tagline.trim() || null,
        supportEmail: raw.supportEmail.trim() || null,
        partnerName: this.branding.branding().partnerName ?? null,
        logoLinkUrl: this.branding.branding().logoLinkUrl ?? null,
        partnerLogoLinkUrl: this.branding.branding().partnerLogoLinkUrl ?? null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
          this.toast.success('Branding updated', 'Every screen now shows the new names.');
        },
        error: () => this.saving.set(false),
      });
  }

  protected pick(event: Event, slot: LogoSlot = 'primary'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const error = slot === 'partner' ? this.partnerFileError : this.fileError;
    const chosen = slot === 'partner' ? this.partnerSelected : this.selected;

    this.clearLocalPreview(slot);
    error.set('');
    chosen.set(null);

    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      error.set('Use a PNG, JPEG, SVG or WebP image.');
      input.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      error.set(`That file is ${Math.round(file.size / 1024)} KB. The limit is 512 KB.`);
      input.value = '';
      return;
    }

    chosen.set(file);
    const preview = slot === 'partner' ? this.partnerLocalPreview : this.localPreview;
    preview.set(URL.createObjectURL(file));
  }

  protected upload(slot: LogoSlot = 'primary'): void {
    const chosen = slot === 'partner' ? this.partnerSelected : this.selected;
    const file = chosen();
    if (!file) return;

    this.uploading.set(true);
    this.branding.uploadLogo(file, slot).subscribe({
      next: () => {
        this.uploading.set(false);
        chosen.set(null);
        this.clearLocalPreview(slot);
        this.toast.success('Logo updated');
      },
      error: () => this.uploading.set(false),
    });
  }

  protected async removeLogo(slot: LogoSlot = 'primary'): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: slot === 'partner' ? 'Remove the partner logo?' : 'Remove the logo?',
      message:
        slot === 'partner'
          ? 'The sign-in header will show the main mark alone.'
          : 'The portal falls back to the text wordmark until a new logo is uploaded.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.clearLocalPreview(slot);
    (slot === 'partner' ? this.partnerSelected : this.selected).set(null);
    this.branding.removeLogo(slot).subscribe(() => this.toast.success('Logo removed'));
  }

  /** The partner name saves on blur; it has no form of its own. */
  protected savePartnerName(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    const current = this.branding.branding();
    if ((current.partnerName ?? '') === value) return;

    this.branding
      .save({
        organisationName: current.organisationName,
        shortName: current.shortName,
        portalTitle: current.portalTitle,
        tagline: current.tagline ?? null,
        supportEmail: current.supportEmail ?? null,
        partnerName: value || null,
        logoLinkUrl: current.logoLinkUrl ?? null,
        partnerLogoLinkUrl: current.partnerLogoLinkUrl ?? null,
      })
      .subscribe(() => this.toast.success('Partner name updated'));
  }

  /**
   * The link each mark carries. Saved on blur like the partner name, because
   * it belongs to the logo card rather than to the names form beside it.
   */
  protected saveLogoLink(slot: LogoSlot, event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    const current = this.branding.branding();
    const existing =
      (slot === 'partner' ? current.partnerLogoLinkUrl : current.logoLinkUrl) ?? '';
    if (existing === value) return;

    this.branding
      .save({
        organisationName: current.organisationName,
        shortName: current.shortName,
        portalTitle: current.portalTitle,
        tagline: current.tagline ?? null,
        supportEmail: current.supportEmail ?? null,
        partnerName: current.partnerName ?? null,
        logoLinkUrl: slot === 'partner' ? current.logoLinkUrl ?? null : value || null,
        partnerLogoLinkUrl:
          slot === 'partner' ? value || null : current.partnerLogoLinkUrl ?? null,
      })
      .subscribe(() =>
        this.toast.success(value ? 'Logo link saved' : 'Logo link removed'),
      );
  }

  private clearLocalPreview(slot: LogoSlot = 'primary'): void {
    const preview = slot === 'partner' ? this.partnerLocalPreview : this.localPreview;
    const url = preview();
    if (url) URL.revokeObjectURL(url);
    preview.set(null);
  }
}
