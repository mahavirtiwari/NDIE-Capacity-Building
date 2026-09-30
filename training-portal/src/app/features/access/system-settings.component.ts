import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BlockReason, RejectionReason, SystemSettings } from '../../core/models';
import { SystemSettingsService } from '../../core/services/system.service';
import { BlockReasonService } from '../../core/services/people.service';
import { RejectionReasonService } from '../../core/services/workflow.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-system-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, IconComponent, StatusBadgeComponent],
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

      <!-- ------------------------------------------------- uploads -->
      <section class="card">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">Uploads</span>
            <span class="card__subtitle">
              How large a file may be published as training material.
            </span>
          </div>
        </div>
        <div class="card__body">
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="maxUploadMb">Largest file (MB)</label>
              <input
                id="maxUploadMb"
                class="input"
                type="number"
                min="1"
                max="512"
                formControlName="maxUploadMb"
              />
              <span class="field-hint">
                Between 1 and 512. A video much larger than this belongs on a hosting service,
                published here as a link.
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ------------------------------------------ PAN verification -->
      <section class="card">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">PAN verification</span>
            <span class="card__subtitle">
              The service an applicant's PAN is checked against at registration.
            </span>
          </div>
        </div>
        <div class="card__body">
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="panProvider">Provider</label>
              <input
                id="panProvider"
                class="input"
                formControlName="panProvider"
                placeholder="Who the service belongs to"
              />
            </div>

            <div class="field">
              <label class="field-label" for="panEndpoint">Endpoint</label>
              <input
                id="panEndpoint"
                class="input"
                formControlName="panEndpoint"
                placeholder="https://…"
              />
            </div>

            <div class="field">
              <label class="field-label" for="panApiKey">API key</label>
              @if (current()?.hasPanApiKey && !replacingPanKey()) {
                <div class="row row-sm">
                  <span class="badge badge--success">Stored</span>
                  <button type="button" class="btn btn--sm btn--secondary" (click)="replacePanKey()">
                    Replace
                  </button>
                  <button type="button" class="btn btn--sm btn--subtle-danger" (click)="clearPanKey()">
                    Remove
                  </button>
                </div>
                <span class="field-hint">
                  Held but never sent back, so this screen cannot disclose it.
                </span>
              } @else {
                <input
                  id="panApiKey"
                  class="input"
                  type="password"
                  autocomplete="new-password"
                  formControlName="panApiKey"
                  placeholder="Paste the key from the provider"
                />
              }
            </div>

            <div class="field">
              <label class="field-label" for="panApiKeyHeader">Key header</label>
              <input id="panApiKeyHeader" class="input" formControlName="panApiKeyHeader" />
              <span class="field-hint">The header the key is sent in.</span>
            </div>

            <div class="field">
              <label class="field-label" for="panValidPath">Answer field</label>
              <input id="panValidPath" class="input" formControlName="panValidPath" />
              <span class="field-hint">
                Where "is it valid" sits in the reply, as a dotted path — so a change of
                provider is a setting rather than a release.
              </span>
            </div>

            <div class="field">
              <label class="field-label" for="panNamePath">Name field</label>
              <input id="panNamePath" class="input" formControlName="panNamePath" />
            </div>

            <div class="field">
              <label class="field-label" for="panTimeoutSeconds">Timeout (seconds)</label>
              <input
                id="panTimeoutSeconds"
                class="input"
                type="number"
                min="3"
                max="60"
                formControlName="panTimeoutSeconds"
              />
            </div>

            <div class="field">
              <label class="field-label" for="panRefuse">When the service is down</label>
              <select id="panRefuse" class="select" formControlName="panRefuseWhenUnavailable">
                <option [ngValue]="false">Let the registration through, PAN unverified</option>
                <option [ngValue]="true">Refuse the registration</option>
              </select>
              <span class="field-hint">
                An outage at a third party should not close the scheme to new applicants
                unless a verified PAN is a hard requirement.
              </span>
            </div>

            <div class="field field--span-2">
              <label class="check">
                <input type="checkbox" formControlName="panVerificationEnabled" />
                <span>Check every PAN against this service</span>
              </label>
              @if (!current()?.panConfigured) {
                <span class="field-hint">
                  The endpoint and the key have to be in place first — switched on without
                  them, every registration fails a check that never ran.
                </span>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- ------------------------------------------- rejection reasons -->
      <section class="card">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">Reasons for rejection</span>
            <span class="card__subtitle">
              What a scrutiny officer picks from when turning an application down.
            </span>
          </div>
        </div>
        <div class="card__body">
          <div class="stack stack-sm">
            @if (reasons().length === 0) {
              <p class="text-muted text-sm">
                Nothing here yet. Until a reason exists, an application cannot be rejected.
              </p>
            } @else {
              <div class="table-wrap">
                <table class="table table--compact">
                  <thead>
                    <tr>
                      <th style="width: 70px">Order</th>
                      <th>Reason</th>
                      <th style="width: 130px">Needs a note</th>
                      <th style="width: 110px">Used by</th>
                      <th style="width: 100px">Status</th>
                      <th style="width: 110px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (reason of reasons(); track reason.id) {
                      <tr>
                        <td class="tabular">{{ reason.displayOrder }}</td>
                        <td>{{ reason.label }}</td>
                        <td>{{ reason.requiresNote ? 'Yes' : 'No' }}</td>
                        <td class="tabular">
                          {{ reason.usedByCount || '—' }}
                        </td>
                        <td><app-status-badge [value]="reason.status" /></td>
                        <td>
                          <div class="btn-row btn-row--end">
                            <button
                              type="button"
                              class="btn btn--sm btn--secondary"
                              (click)="toggleReason(reason)"
                            >
                              {{ reason.status === 'Active' ? 'Switch off' : 'Switch on' }}
                            </button>
                            @if (!reason.usedByCount) {
                              <button
                                type="button"
                                class="btn btn--icon"
                                title="Remove"
                                (click)="removeReason(reason)"
                              >
                                <app-icon name="trash" [size]="15" />
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Outside the settings form: this list saves a row at a time,
                 and it must not be tangled with Save settings. -->
            <div class="row row-sm row-wrap" style="align-items: flex-end">
              <div class="field" style="flex: 1 1 320px">
                <label class="field-label" for="newReason">Add a reason</label>
                <input
                  id="newReason"
                  class="input"
                  [value]="newReason()"
                  (input)="newReason.set(inputValue($event))"
                  placeholder="e.g. Signature on the undertaking is missing"
                  maxlength="200"
                />
              </div>
              <label class="check" style="padding-bottom: 0.6rem">
                <input
                  type="checkbox"
                  [checked]="newReasonNeedsNote()"
                  (change)="newReasonNeedsNote.set(checkedValue($event))"
                />
                <span>Needs a note</span>
              </label>
              <button
                type="button"
                class="btn btn--secondary"
                style="margin-bottom: 0.35rem"
                [disabled]="!newReason().trim() || savingReason()"
                (click)="addReason()"
              >
                @if (savingReason()) { <span class="spinner"></span> }
                Add
              </button>
            </div>

            <span class="field-hint">
              A reason that has already been used is switched off rather than removed, so the
              applications that cite it keep saying what they said.
            </span>
          </div>
        </div>
      </section>

      <!-- ------------------------------------------- block reasons -->
      <section class="card">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">Reasons for blocking an account</span>
            <span class="card__subtitle">
              What an administrator picks from when blocking an applicant’s account.
            </span>
          </div>
        </div>
        <div class="card__body">
          <div class="stack stack-sm">
            @if (blockReasons().length === 0) {
              <p class="text-muted text-sm">
                Nothing here yet. Until a reason exists, an account cannot be blocked.
              </p>
            } @else {
              <div class="table-wrap">
                <table class="table table--compact">
                  <thead>
                    <tr>
                      <th style="width: 70px">Order</th>
                      <th>Reason</th>
                      <th style="width: 130px">Needs a note</th>
                      <th style="width: 110px">Used by</th>
                      <th style="width: 100px">Status</th>
                      <th style="width: 110px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (reason of blockReasons(); track reason.id) {
                      <tr>
                        <td class="tabular">{{ reason.displayOrder }}</td>
                        <td>{{ reason.label }}</td>
                        <td>{{ reason.requiresNote ? 'Yes' : 'No' }}</td>
                        <td class="tabular">
                          {{ reason.usedByCount || '—' }}
                        </td>
                        <td><app-status-badge [value]="reason.status" /></td>
                        <td>
                          <div class="btn-row btn-row--end">
                            <button
                              type="button"
                              class="btn btn--sm btn--secondary"
                              (click)="toggleBlockReason(reason)"
                            >
                              {{ reason.status === 'Active' ? 'Switch off' : 'Switch on' }}
                            </button>
                            @if (!reason.usedByCount) {
                              <button
                                type="button"
                                class="btn btn--icon"
                                title="Remove"
                                (click)="removeBlockReason(reason)"
                              >
                                <app-icon name="trash" [size]="15" />
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Outside the settings form: this list saves a row at a time,
                 and it must not be tangled with Save settings. -->
            <div class="row row-sm row-wrap" style="align-items: flex-end">
              <div class="field" style="flex: 1 1 320px">
                <label class="field-label" for="newBlockReason">Add a reason</label>
                <input
                  id="newBlockReason"
                  class="input"
                  [value]="newBlockReason()"
                  (input)="newBlockReason.set(inputValue($event))"
                  placeholder="e.g. Repeated no-shows after enrolment"
                  maxlength="200"
                />
              </div>
              <label class="check" style="padding-bottom: 0.6rem">
                <input
                  type="checkbox"
                  [checked]="newBlockReasonNeedsNote()"
                  (change)="newBlockReasonNeedsNote.set(checkedValue($event))"
                />
                <span>Needs a note</span>
              </label>
              <button
                type="button"
                class="btn btn--secondary"
                style="margin-bottom: 0.35rem"
                [disabled]="!newBlockReason().trim() || savingBlockReason()"
                (click)="addBlockReason()"
              >
                @if (savingBlockReason()) { <span class="spinner"></span> }
                Add
              </button>
            </div>

            <span class="field-hint">
              A reason that has already been used is switched off rather than removed, so the
              history keeps its wording.
            </span>
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
  protected readonly replacingPanKey = signal(false);

  /* The rejection list. Saved a row at a time rather than with the rest of
     the settings, because adding a reason and changing the upload limit are
     not one decision. */
  private readonly reasonService = inject(RejectionReasonService);
  protected readonly reasons = signal<RejectionReason[]>([]);
  protected readonly newReason = signal('');
  protected readonly newReasonNeedsNote = signal(false);
  protected readonly savingReason = signal(false);

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checkedValue(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  private loadReasons(): void {
    this.reasonService.list(false).subscribe((rows) => this.reasons.set(rows));
  }

  protected addReason(): void {
    const label = this.newReason().trim();
    if (!label || this.savingReason()) return;

    this.savingReason.set(true);
    this.reasonService
      .create({
        label,
        /* At the end of the list, ten apart, so one can be slipped between
           two later without renumbering the rest. */
        displayOrder: (this.reasons().at(-1)?.displayOrder ?? 0) + 10,
        requiresNote: this.newReasonNeedsNote(),
        status: 'Active',
      })
      .subscribe({
        next: () => {
          this.savingReason.set(false);
          this.newReason.set('');
          this.newReasonNeedsNote.set(false);
          this.toast.success('Reason added', label);
          this.loadReasons();
        },
        error: () => this.savingReason.set(false),
      });
  }

  protected toggleReason(reason: RejectionReason): void {
    const next = reason.status === 'Active' ? 'Inactive' : 'Active';
    this.reasonService
      .update(reason.id, {
        label: reason.label,
        displayOrder: reason.displayOrder,
        requiresNote: reason.requiresNote,
        status: next,
      })
      .subscribe(() => {
        this.toast.success(
          next === 'Active' ? 'Reason switched on' : 'Reason switched off',
          reason.label,
        );
        this.loadReasons();
      });
  }

  /* The block list, managed exactly as the rejection list is. Two lists
     rather than one with a kind: they are different vocabularies, and one
     would put "Documents are not legible" in front of somebody deciding
     whether to lock an account. */
  private readonly blockReasonService = inject(BlockReasonService);
  protected readonly blockReasons = signal<BlockReason[]>([]);
  protected readonly newBlockReason = signal('');
  protected readonly newBlockReasonNeedsNote = signal(false);
  protected readonly savingBlockReason = signal(false);

  private loadBlockReasons(): void {
    this.blockReasonService.list(false).subscribe((rows) => this.blockReasons.set(rows));
  }

  protected addBlockReason(): void {
    const label = this.newBlockReason().trim();
    if (!label || this.savingBlockReason()) return;

    this.savingBlockReason.set(true);
    this.blockReasonService
      .create({
        label,
        displayOrder: (this.blockReasons().at(-1)?.displayOrder ?? 0) + 10,
        requiresNote: this.newBlockReasonNeedsNote(),
        status: 'Active',
      })
      .subscribe({
        next: () => {
          this.savingBlockReason.set(false);
          this.newBlockReason.set('');
          this.newBlockReasonNeedsNote.set(false);
          this.toast.success('Reason added', label);
          this.loadBlockReasons();
        },
        error: () => this.savingBlockReason.set(false),
      });
  }

  protected toggleBlockReason(reason: BlockReason): void {
    const next = reason.status === 'Active' ? 'Inactive' : 'Active';
    this.blockReasonService
      .update(reason.id, {
        label: reason.label,
        displayOrder: reason.displayOrder,
        requiresNote: reason.requiresNote,
        status: next,
      })
      .subscribe(() => {
        this.toast.success(
          next === 'Active' ? 'Reason switched on' : 'Reason switched off',
          reason.label,
        );
        this.loadBlockReasons();
      });
  }

  protected async removeBlockReason(reason: BlockReason): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Remove this reason?',
      message: `'${reason.label}' will no longer be offered. No account has been blocked for it, so no history loses its wording.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.blockReasonService.remove(reason.id).subscribe(() => {
      this.toast.success('Reason removed', reason.label);
      this.loadBlockReasons();
    });
  }

  protected async removeReason(reason: RejectionReason): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Remove this reason?',
      message: `'${reason.label}' will no longer be offered. Nothing has been rejected for it, so nothing loses its explanation.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.reasonService.remove(reason.id).subscribe(() => {
      this.toast.success('Reason removed', reason.label);
      this.loadReasons();
    });
  }

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
    maxUploadMb: [64],
    panVerificationEnabled: [false],
    panProvider: [''],
    panEndpoint: [''],
    panApiKey: [''],
    panApiKeyHeader: ['X-API-KEY'],
    panValidPath: ['valid'],
    panNamePath: ['name'],
    panTimeoutSeconds: [10],
    panRefuseWhenUnavailable: [false],
  });

  constructor() {
    this.load();
    this.loadReasons();
    this.loadBlockReasons();
  }

  private load(): void {
    this.service.get().subscribe((settings) => {
      this.current.set(settings);
      this.replacingKey.set(false);
      this.replacingPanKey.set(false);
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
        maxUploadMb: settings.maxUploadMb,
        panVerificationEnabled: settings.panVerificationEnabled,
        panProvider: settings.panProvider ?? '',
        panEndpoint: settings.panEndpoint ?? '',
        panApiKey: '',
        panApiKeyHeader: settings.panApiKeyHeader,
        panValidPath: settings.panValidPath,
        panNamePath: settings.panNamePath,
        panTimeoutSeconds: settings.panTimeoutSeconds,
        panRefuseWhenUnavailable: settings.panRefuseWhenUnavailable,
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

  protected replacePanKey(): void {
    this.replacingPanKey.set(true);
    this.form.controls.panApiKey.setValue('');
  }

  protected async clearPanKey(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Remove the PAN API key?',
      message:
        'The service cannot be called without it, so PAN verification will be switched off until a new key is saved.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.replacingPanKey.set(true);
    this.form.controls.panApiKey.setValue('');
    this.form.controls.panVerificationEnabled.setValue(false);
    this.save(false, true);
  }

  protected async save(clearingKey = false, clearingPanKey = false): Promise<void> {
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
        maxUploadMb: Number(raw.maxUploadMb),
        panVerificationEnabled: raw.panVerificationEnabled,
        panProvider: raw.panProvider || null,
        panEndpoint: raw.panEndpoint || null,
        panApiKey: clearingPanKey ? '' : raw.panApiKey || undefined,
        panApiKeyHeader: raw.panApiKeyHeader || null,
        panValidPath: raw.panValidPath || null,
        panNamePath: raw.panNamePath || null,
        panTimeoutSeconds: Number(raw.panTimeoutSeconds),
        panRefuseWhenUnavailable: String(raw.panRefuseWhenUnavailable) === 'true',
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
