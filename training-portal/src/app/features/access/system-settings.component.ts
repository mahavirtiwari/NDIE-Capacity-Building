import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SystemSettings } from '../../core/models';
import { SystemSettingsService } from '../../core/services/system.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-system-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, IconComponent],
  template: `
    <app-page-header
      [title]="copy.text('page.systemSettings.title')"
      [subtitle]="copy.text('page.systemSettings.subtitle')"
      icon="settings"
      [breadcrumbs]="[
        { label: 'Administration' },
        { label: copy.text('page.systemSettings.title') },
      ]"
    />

    <form [formGroup]="form" class="stack stack-lg" (ngSubmit)="save()">
      <!-- ---------------------------------------------- maintenance -->
      <section class="card">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">Maintenance</span>
            <span class="card__subtitle">
              Closes the portal and both apps to everybody but a Super Admin.
            </span>
          </div>
          @if (current()?.maintenanceMode) {
            <span class="chip chip--danger">The site is closed</span>
          }
        </div>

        <div class="card__body">
          <div class="form-grid">
            <div class="field field--span-2">
              <label class="check">
                <input type="checkbox" formControlName="maintenanceMode" />
                <span>Close the site for maintenance</span>
              </label>
              <span class="field-hint">
                You keep working — a Super Admin is let through. Everybody else, signed in or
                not, is turned away with the message below until you switch this off.
              </span>
            </div>

            <div class="field field--span-2">
              <label class="field-label" for="maintMessage">What to tell them</label>
              <textarea
                id="maintMessage"
                class="textarea"
                maxlength="500"
                formControlName="maintenanceMessage"
                placeholder="The portal is closed for maintenance. Please try again shortly."
              ></textarea>
              <span class="field-hint">Left blank, that placeholder is what is shown.</span>
            </div>

            <div class="field">
              <label class="field-label" for="maintUntil">Expected back</label>
              <input id="maintUntil" type="datetime-local" class="input" formControlName="maintenanceUntil" />
              <span class="field-hint">
                Shown to whoever is turned away. Nothing reopens on its own — an overrun that
                let the public back in mid-migration would be worse than a long outage.
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ------------------------------------------ payment gateway -->
      <section class="card">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">Payment gateway</span>
            <span class="card__subtitle">
              Where the programme fee is collected. Configuration only — nothing is charged
              until the integration is switched on.
            </span>
          </div>
          @if (current()?.paymentEnabled) {
            <span class="chip">{{ current()?.paymentTestMode ? 'Test mode' : 'Live' }}</span>
          }
        </div>

        <div class="card__body">
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="gateway">Gateway</label>
              <select id="gateway" class="select" formControlName="paymentGateway">
                <option value="">Not chosen</option>
                @for (name of gateways(); track name) {
                  <option [value]="name">{{ name }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="mode">Mode</label>
              <select id="mode" class="select" formControlName="paymentTestMode">
                <option [value]="true">Test</option>
                <option [value]="false">Live</option>
              </select>
              <span class="field-hint">Test credentials move no money.</span>
            </div>

            <div class="field">
              <label class="field-label" for="merchantId">Merchant ID</label>
              <input id="merchantId" class="input" formControlName="merchantId" autocomplete="off" />
            </div>

            <div class="field">
              <label class="field-label" for="accessCode">Access code</label>
              <input id="accessCode" class="input" formControlName="accessCode" autocomplete="off" />
            </div>

            <div class="field field--span-2">
              <label class="field-label" for="workingKey">Working key</label>
              @if (current()?.hasWorkingKey && !replacingKey()) {
                <div class="row row-sm">
                  <span class="chip"><app-icon name="shield" [size]="14" /> A key is stored</span>
                  <button type="button" class="btn btn--secondary btn--sm" (click)="replaceKey()">
                    Replace it
                  </button>
                  <button type="button" class="btn btn--ghost btn--sm" (click)="clearKey()">
                    Remove it
                  </button>
                </div>
                <span class="field-hint">
                  It is never sent back to this screen, so it cannot be read here or leak in a
                  screenshot. Replacing it is the only way to change it.
                </span>
              } @else {
                <input
                  id="workingKey"
                  type="password"
                  class="input"
                  formControlName="workingKey"
                  autocomplete="new-password"
                  placeholder="Paste the key from the gateway's dashboard"
                />
                <span class="field-hint">
                  Stored write-only. Leave blank to keep whatever is already there.
                </span>
              }
            </div>

            <div class="field">
              <label class="field-label" for="returnUrl">Return URL</label>
              <input id="returnUrl" class="input" formControlName="returnUrl" placeholder="https://…" />
            </div>

            <div class="field">
              <label class="field-label" for="cancelUrl">Cancel URL</label>
              <input id="cancelUrl" class="input" formControlName="cancelUrl" placeholder="https://…" />
            </div>

            <div class="field field--span-2">
              <label class="check">
                <input type="checkbox" formControlName="paymentEnabled" />
                <span>Take payments through this gateway</span>
              </label>
              @if (!current()?.paymentConfigured) {
                <span class="field-hint">
                  Everything above has to be filled in first — an applicant told a fee is due
                  and sent to a page that cannot take it is worse than no gateway at all.
                </span>
              }
            </div>
          </div>
        </div>
      </section>

      <div class="btn-row btn-row--end">
        <button type="submit" class="btn btn--primary" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> }
          Save settings
        </button>
      </div>
    </form>
  `,
})
export class SystemSettingsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(SystemSettingsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly current = signal<SystemSettings | null>(null);
  protected readonly saving = signal(false);
  protected readonly replacingKey = signal(false);

  protected readonly gateways = toSignal(this.service.gateways(), { initialValue: [] });

  protected readonly form = this.fb.nonNullable.group({
    maintenanceMode: [false],
    maintenanceMessage: [''],
    maintenanceUntil: [''],
    paymentEnabled: [false],
    paymentGateway: [''],
    paymentTestMode: [true],
    merchantId: [''],
    accessCode: [''],
    workingKey: [''],
    returnUrl: [''],
    cancelUrl: [''],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.service.get().subscribe((settings) => {
      this.current.set(settings);
      this.replacingKey.set(false);
      this.form.reset({
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage ?? '',
        /* datetime-local will not take an offset or the seconds. */
        maintenanceUntil: settings.maintenanceUntil
          ? settings.maintenanceUntil.slice(0, 16)
          : '',
        paymentEnabled: settings.paymentEnabled,
        paymentGateway: settings.paymentGateway ?? '',
        paymentTestMode: settings.paymentTestMode,
        merchantId: settings.merchantId ?? '',
        accessCode: settings.accessCode ?? '',
        workingKey: '',
        returnUrl: settings.returnUrl ?? '',
        cancelUrl: settings.cancelUrl ?? '',
      });
    });
  }

  protected replaceKey(): void {
    this.replacingKey.set(true);
    this.form.controls.workingKey.setValue('');
  }

  protected async clearKey(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Remove the working key?',
      message:
        'The gateway cannot be used without it, so payments will be switched off until a new key is saved.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    /* An empty string is the explicit clear the API distinguishes from "leave
       it alone"; payments go off with it, because they cannot work without. */
    this.replacingKey.set(true);
    this.form.controls.workingKey.setValue('');
    this.form.controls.paymentEnabled.setValue(false);
    this.save(true);
  }

  protected async save(clearingKey = false): Promise<void> {
    const raw = this.form.getRawValue();

    if (raw.maintenanceMode && !this.current()?.maintenanceMode) {
      const confirmed = await this.confirm.ask({
        title: 'Close the site?',
        message:
          'Everybody but a Super Admin is turned away immediately — the portal, the applicant app and the coordinator app. Anyone part way through a form loses it.',
        confirmLabel: 'Close the site',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    this.saving.set(true);

    this.service
      .update({
        maintenanceMode: raw.maintenanceMode,
        maintenanceMessage: raw.maintenanceMessage || null,
        maintenanceUntil: raw.maintenanceUntil || null,
        paymentEnabled: raw.paymentEnabled,
        paymentGateway: raw.paymentGateway || null,
        paymentTestMode: String(raw.paymentTestMode) === 'true',
        merchantId: raw.merchantId || null,
        accessCode: raw.accessCode || null,
        /* Undefined keeps the stored key; an empty string only travels when
           the key is being cleared on purpose. */
        workingKey: clearingKey ? '' : raw.workingKey || undefined,
        returnUrl: raw.returnUrl || null,
        cancelUrl: raw.cancelUrl || null,
      })
      .subscribe({
        next: (settings) => {
          this.saving.set(false);
          this.current.set(settings);
          this.replacingKey.set(false);
          this.form.controls.workingKey.setValue('');
          this.toast.success(
            'System settings saved',
            settings.maintenanceMode ? 'The site is closed to everybody but you.' : undefined,
          );
        },
        error: () => this.saving.set(false),
      });
  }
}
