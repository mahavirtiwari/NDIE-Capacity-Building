import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EmailLogEntry, EmailPreview, EmailSettings, EmailTemplate } from '../../core/models';
import { EmailService } from '../../core/services/email.service';
import { ToastService } from '../../core/services/toast.service';
import { describeError, formatValidator } from '../../core/validation/formats';
import { ConfirmService } from '../../shared/components/confirm.service';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RichTextEditorComponent } from '../../shared/components/rich-text-editor.component';

type Tab = 'sender' | 'templates' | 'log';

/**
 * Outgoing mail, in two halves: the account messages are sent from, and the
 * wording of each message. Both are Super Admin only.
 */
@Component({
  selector: 'app-email-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    IconComponent,
    ModalComponent,
    RichTextEditorComponent,
  ],
  template: `
    <app-page-header
      title="Email"
      subtitle="The account messages are sent from, and the wording of each one."
      icon="mail"
      [breadcrumbs]="[{ label: 'Administration' }, { label: 'Email' }]"
    />

    <div class="tabs">
      <button type="button" class="tabs__item" [class.is-on]="tab() === 'sender'" (click)="tab.set('sender')">
        <app-icon name="settings" [size]="15" /> Sender &amp; SMTP
      </button>
      <button type="button" class="tabs__item" [class.is-on]="tab() === 'templates'" (click)="tab.set('templates')">
        <app-icon name="form" [size]="15" /> Templates
        @if (templates().length) { <span class="chip">{{ templates().length }}</span> }
      </button>
      <button type="button" class="tabs__item" [class.is-on]="tab() === 'log'" (click)="showLog()">
        <app-icon name="clock" [size]="15" /> Delivery log
      </button>
    </div>

    @if (tab() === 'sender') {
      @if (settings()?.usingConfigFallback) {
        <div class="alert alert--info mb-md">
          <app-icon name="info" [size]="16" />
          <span>
            No host is saved here, so mail is using the server's configuration file. Anything you
            save below takes over from it.
          </span>
        </div>
      }

      @if (!settings()?.enabled) {
        <div class="alert alert--warning mb-md">
          <app-icon name="alert" [size]="16" />
          <span>
            Sending is switched off. Messages are written to the server log instead of being
            delivered, so nobody receives their ID or password.
          </span>
        </div>
      }

      <div class="mail-grid">
        <section class="card">
          <div class="card__header"><span class="card__title">Sender</span></div>
          <div class="card__body">
            <form [formGroup]="form" class="stack stack-md" (ngSubmit)="save()">
              <div class="field">
                <label class="field-label" for="mlFrom">From address <span class="req">*</span></label>
                <input id="mlFrom" type="email" class="input" formControlName="fromAddress"
                  placeholder="Enter email address"
                  [class.is-invalid]="invalid('fromAddress')" />
                <span class="field-hint">Recipients see this as the sender.</span>
                @if (invalid('fromAddress')) {
                  <span class="field-error">{{ errorFor('fromAddress', 'From address') }}</span>
                }
              </div>

              <div class="field">
                <label class="field-label" for="mlFromName">Display name</label>
                <input id="mlFromName" class="input" formControlName="fromName" maxlength="200" />
              </div>

              <div class="field">
                <label class="field-label" for="mlReply">Reply-to</label>
                <input id="mlReply" type="email" class="input" formControlName="replyTo"
                  placeholder="Enter email address"
                  [class.is-invalid]="invalid('replyTo')" />
                <span class="field-hint">Where replies and bounces go. Usually the same address.</span>
                @if (invalid('replyTo')) {
                  <span class="field-error">{{ errorFor('replyTo', 'Reply-to') }}</span>
                }
              </div>

              <div class="field">
                <label class="field-label" for="mlRedirect">Divert all mail to</label>
                <input id="mlRedirect" type="email" class="input" formControlName="redirectAllTo"
                  placeholder="Enter email address"
                  [class.is-invalid]="invalid('redirectAllTo')" />
                <span class="field-hint">
                  For testing: every message goes here instead of the real recipient. Leave blank in
                  production.
                </span>
                @if (invalid('redirectAllTo')) {
                  <span class="field-error">{{ errorFor('redirectAllTo', 'Divert address') }}</span>
                }
              </div>
            </form>
          </div>
        </section>

        <section class="card">
          <div class="card__header"><span class="card__title">SMTP connection</span></div>
          <div class="card__body">
            <form [formGroup]="form" class="stack stack-md" (ngSubmit)="save()">
              <div class="field">
                <label class="field-label" for="mlHost">Host</label>
                <input id="mlHost" class="input" formControlName="host"
                  placeholder="smtp.office365.com" />
                <span class="field-hint">Office 365 uses smtp.office365.com on port 587.</span>
              </div>

              <div class="row row-md">
                <div class="field flex-1">
                  <label class="field-label" for="mlPort">Port</label>
                  <input id="mlPort" type="number" class="input" formControlName="port" min="1" max="65535" />
                </div>
                <div class="field flex-1">
                  <label class="field-label" for="mlTimeout">Timeout (seconds)</label>
                  <input id="mlTimeout" type="number" class="input" formControlName="timeoutSeconds" min="5" max="300" />
                </div>
              </div>

              <label class="check">
                <input type="checkbox" formControlName="useSsl" />
                <span>Use TLS <span class="text-muted">(STARTTLS on 587, implicit on 465)</span></span>
              </label>

              <div class="field">
                <label class="field-label" for="mlUser">Username</label>
                <input id="mlUser" class="input" formControlName="userName" autocomplete="off"
                  placeholder="consultancy.zed@qcin.org" />
              </div>

              <div class="field">
                <label class="field-label" for="mlPass">Password</label>
                <input id="mlPass" type="password" class="input" formControlName="password"
                  autocomplete="new-password"
                  [placeholder]="settings()?.hasPassword ? '•••••••• (unchanged)' : 'Not set'" />
                <span class="field-hint">
                  Stored on the server and never shown again. Leave blank to keep the current one.
                  With multi-factor sign-in, use an app password.
                </span>
              </div>

              <div class="field">
                <label class="field-label" for="mlOtp">Code validity (minutes)</label>
                <input id="mlOtp" type="number" class="input" formControlName="otpValidityMinutes" min="1" max="60" />
                <span class="field-hint">How long a verification or reset code stays usable.</span>
              </div>

              <label class="check">
                <input type="checkbox" formControlName="enabled" />
                <span>
                  <strong>Send messages</strong>
                  <span class="text-muted"> — off writes them to the log instead</span>
                </span>
              </label>

              <div class="btn-row btn-row--end">
                <button type="button" class="btn btn--ghost" (click)="reset()">Reset</button>
                <button type="submit" class="btn btn--primary" [disabled]="saving()">
                  <app-icon name="save" [size]="15" />
                  {{ saving() ? 'Saving…' : 'Save settings' }}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section class="card">
          <div class="card__header"><span class="card__title">Send a test</span></div>
          <div class="card__body stack stack-md">
            <div class="field">
              <label class="field-label" for="mlTest">Send a test message to</label>
              <input id="mlTest" type="email" class="input" [value]="testTo()"
                (input)="testTo.set($any($event.target).value)" placeholder="Enter email address" />
              <span class="field-hint">
                Save your settings first. This sends a real message through the server above.
              </span>
            </div>
            @if (testError()) {
              <div class="alert alert--danger">
                <app-icon name="alert" [size]="16" /><span>{{ testError() }}</span>
              </div>
            }
            <div class="btn-row btn-row--end">
              <button type="button" class="btn btn--secondary" [disabled]="testing() || !testTo()"
                (click)="sendTest()">
                <app-icon name="send" [size]="15" />
                {{ testing() ? 'Sending…' : 'Send test' }}
              </button>
            </div>
          </div>
        </section>
      </div>
    } @else if (tab() === 'templates') {
      <div class="tpl-grid">
        <section class="card">
          <div class="card__header"><span class="card__title">Messages</span></div>
          <div class="card__body tpl-list">
            @for (t of templates(); track t.key) {
              <button type="button" class="tpl-item" [class.is-on]="selectedKey() === t.key"
                (click)="select(t)">
                <span class="tpl-item__name">
                  {{ t.name }}
                  @if (!t.isEnabled) { <span class="chip">Off</span> }
                </span>
                <span class="tpl-item__desc">{{ t.description }}</span>
              </button>
            }
          </div>
        </section>

        @if (selected(); as t) {
          <section class="card">
            <div class="card__header">
              <span class="card__title">{{ t.name }}</span>
              <span class="chip">{{ t.key }}</span>
            </div>
            <div class="card__body">
              <form [formGroup]="templateForm" class="stack stack-md" (ngSubmit)="saveTemplate()">
                <div class="alert alert--info">
                  <app-icon name="info" [size]="16" />
                  <span>
                    Available placeholders:
                    @for (p of t.placeholders; track p) {
                      <code class="tok">{{ token(p) }}</code>
                    }
                  </span>
                </div>

                <div class="field">
                  <label class="field-label" for="tplSubject">Subject <span class="req">*</span></label>
                  <input id="tplSubject" class="input" formControlName="subject" maxlength="300" />
                </div>

                <div class="field">
                  <label class="field-label" for="tplHtml">Message body <span class="req">*</span></label>
                  <app-rich-text-editor id="tplHtml" formControlName="htmlBody" [minHeight]="240" />
                  <span class="field-hint">
                    Write it with the toolbar, or switch to HTML to edit the markup directly — both
                    views edit the same message. Placeholders can be typed in either. The branded
                    header and footer are added automatically.
                  </span>
                </div>

                <div class="field">
                  <label class="field-label" for="tplText">Plain-text fallback</label>
                  <textarea id="tplText" class="input" formControlName="plainTextBody" rows="3"></textarea>
                </div>

                @if (t.canDisable) {
                  <label class="check">
                    <input type="checkbox" formControlName="isEnabled" />
                    <span>Send this message</span>
                  </label>
                } @else {
                  <div class="alert alert--warning">
                    <app-icon name="lock" [size]="16" />
                    <span>
                      This one carries a credential or a one-time code, so it cannot be switched
                      off — doing so would lock people out with no way back in.
                    </span>
                  </div>
                }

                <div class="btn-row btn-row--end">
                  <button type="button" class="btn btn--ghost" (click)="restore(t)">
                    <app-icon name="refresh" [size]="15" /> Restore original
                  </button>
                  <button type="button" class="btn btn--secondary" (click)="preview()">
                    <app-icon name="eye" [size]="15" /> Preview
                  </button>
                  <button type="submit" class="btn btn--primary" [disabled]="savingTemplate()">
                    <app-icon name="save" [size]="15" />
                    {{ savingTemplate() ? 'Saving…' : 'Save template' }}
                  </button>
                </div>
              </form>
            </div>
          </section>
        }
      </div>

      <!-- Over the top rather than below it. Rendered inline, the preview
           appeared under an editor already tall enough to fill the screen, so
           the thing you had just asked to see was off the bottom of it. -->
      @if (previewData(); as p) {
        <app-modal
          title="Preview"
          [subtitle]="p.subject"
          size="lg"
          (closed)="previewData.set(null)"
        >
          <div class="preview-frame" [innerHTML]="previewHtml()"></div>

          <div footer>
            <button type="button" class="btn" (click)="previewData.set(null)">Close</button>
          </div>
        </app-modal>
      }
    } @else {
      <section class="card">
        <div class="card__header">
          <span class="card__title">Recent delivery attempts</span>
          <button type="button" class="btn btn--sm btn--ghost" (click)="showLog()">
            <app-icon name="refresh" [size]="14" /> Refresh
          </button>
        </div>
        <div class="card__body">
          @if (!log().length) {
            <p class="text-sm text-muted">
              Nothing sent yet. Every attempt is recorded here, including the ones that failed.
            </p>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th style="width: 160px">When</th>
                    <th style="width: 110px">Result</th>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of log(); track row.id) {
                    <tr>
                      <td class="text-nowrap">{{ row.sentOn | date: 'dd MMM, HH:mm' }}</td>
                      <td>
                        <span class="badge" [class]="'badge badge--' + toneFor(row.status)">
                          {{ row.status }}
                        </span>
                      </td>
                      <td>{{ row.recipient }}</td>
                      <td>{{ row.subject }}</td>
                      <td class="text-xs text-muted">{{ row.error || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 0.35rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid var(--border);
      }
      .tabs__item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.55rem 0.9rem;
        border: 0;
        background: none;
        cursor: pointer;
        font: inherit;
        font-size: var(--fs-base);
        color: var(--ink-600);
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
      }
      .tabs__item.is-on { color: var(--brand-700); border-bottom-color: var(--brand-600); font-weight: 500; }

      .mail-grid,
      .tpl-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 1rem;
        align-items: start;
      }
      .tpl-grid { grid-template-columns: minmax(0, 300px) minmax(0, 1fr); }
      @media (max-width: 900px) {
        .tpl-grid { grid-template-columns: minmax(0, 1fr); }
      }

      /* Fifteen templates make a column taller than the editor beside it, so
         the page grew and the editor scrolled away while you were reading the
         list. The list scrolls within itself instead, and stays beside what it
         is selecting. */
      .tpl-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.5rem;
        max-height: calc(100vh - 19rem);
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .tpl-item {
        display: grid;
        gap: 0.15rem;
        text-align: left;
        padding: 0.6rem 0.7rem;
        border: 1px solid transparent;
        border-radius: var(--radius);
        background: none;
        cursor: pointer;
        font: inherit;
      }
      .tpl-item:hover { background: var(--brand-50); }
      .tpl-item.is-on { background: var(--brand-50); border-color: var(--brand-300); }
      .tpl-item__name {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: var(--fs-base);
        font-weight: 500;
        color: var(--ink-900);
      }
      .tpl-item__desc { font-size: var(--fs-xs); color: var(--ink-500); }

      .tpl-body { font-family: var(--font-mono, ui-monospace, monospace); font-size: var(--fs-sm); }
      .tok {
        display: inline-block;
        margin: 0 0.15rem;
        padding: 0 0.3rem;
        border-radius: var(--radius-sm);
        background: var(--surface);
        border: 1px solid var(--border);
        font-size: var(--fs-xs);
      }

      .check { display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-base); }

      .preview-frame {
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-muted);
        overflow-x: auto;
      }
    `,
  ],
})
export class EmailSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(EmailService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly tab = signal<Tab>('sender');
  protected readonly settings = signal<EmailSettings | null>(null);
  protected readonly templates = signal<EmailTemplate[]>([]);
  protected readonly selectedKey = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly savingTemplate = signal(false);
  protected readonly testing = signal(false);
  protected readonly testTo = signal('');
  protected readonly testError = signal('');
  protected readonly previewData = signal<EmailPreview | null>(null);
  protected readonly log = signal<EmailLogEntry[]>([]);

  protected readonly selected = computed(
    () => this.templates().find((t) => t.key === this.selectedKey()) ?? null,
  );

  /* The preview is rendered by our own API from our own templates, so it is
     trusted deliberately rather than stripped. */
  protected readonly previewHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.previewData()?.html ?? ''),
  );

  protected readonly form = this.fb.nonNullable.group({
    enabled: [false],
    host: [''],
    port: [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
    useSsl: [true],
    userName: [''],
    password: [''],
    fromAddress: ['', formatValidator('email')],
    fromName: [''],
    replyTo: ['', formatValidator('email')],
    redirectAllTo: ['', formatValidator('email')],
    timeoutSeconds: [30, [Validators.min(5), Validators.max(300)]],
    otpValidityMinutes: [10, [Validators.min(1), Validators.max(60)]],
  });

  protected readonly templateForm = this.fb.nonNullable.group({
    subject: ['', Validators.required],
    htmlBody: ['', Validators.required],
    plainTextBody: [''],
    isEnabled: [true],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.service.settings().subscribe((s) => {
      this.settings.set(s);
      this.apply(s);
    });
    this.service.templates().subscribe((list) => {
      this.templates.set(list);
      if (!this.selectedKey() && list.length) this.select(list[0]);
    });
  }

  private apply(s: EmailSettings): void {
    this.form.reset({
      enabled: s.enabled,
      host: s.host ?? '',
      port: s.port,
      useSsl: s.useSsl,
      userName: s.userName ?? '',
      password: '',
      fromAddress: s.fromAddress ?? '',
      fromName: s.fromName ?? '',
      replyTo: s.replyTo ?? '',
      redirectAllTo: s.redirectAllTo ?? '',
      timeoutSeconds: s.timeoutSeconds,
      otpValidityMinutes: s.otpValidityMinutes,
    });
  }

  /* Built here rather than in the template: a literal {{ }} in markup is an
     interpolation as far as the Angular parser is concerned. */
  protected token(name: string): string {
    return `{{${name}}}`;
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected errorFor(control: string, label: string): string {
    return describeError(this.form.get(control)?.errors ?? null, label);
  }

  protected reset(): void {
    const current = this.settings();
    if (current) this.apply(current);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.service
      .saveSettings({
        enabled: raw.enabled,
        host: raw.host.trim() || null,
        port: Number(raw.port),
        useSsl: raw.useSsl,
        userName: raw.userName.trim() || null,
        /* Blank means "leave the stored password alone". */
        password: raw.password ? raw.password : null,
        fromAddress: raw.fromAddress.trim() || null,
        fromName: raw.fromName.trim() || null,
        replyTo: raw.replyTo.trim() || null,
        redirectAllTo: raw.redirectAllTo.trim() || null,
        timeoutSeconds: Number(raw.timeoutSeconds),
        otpValidityMinutes: Number(raw.otpValidityMinutes),
      })
      .subscribe({
        next: (s) => {
          this.saving.set(false);
          this.settings.set(s);
          this.apply(s);
          this.toast.success('Email settings saved');
        },
        error: () => this.saving.set(false),
      });
  }

  protected sendTest(): void {
    this.testing.set(true);
    this.testError.set('');
    this.service.sendTest(this.testTo().trim()).subscribe({
      next: () => {
        this.testing.set(false);
        this.toast.success('Test sent', `Check ${this.testTo()}.`);
      },
      error: (caught: unknown) => {
        this.testing.set(false);
        const body = (caught as { error?: { message?: string } })?.error;
        this.testError.set(body?.message ?? 'Could not send the test message.');
      },
    });
  }

  /** Loads the log fresh each time, so it reflects what just happened. */
  protected showLog(): void {
    this.tab.set('log');
    this.service.log(50).subscribe((rows) => this.log.set(rows));
  }

  protected toneFor(status: string): string {
    if (status === 'Sent') return 'success';
    if (status === 'Failed') return 'danger';
    return 'warning';
  }

  protected select(t: EmailTemplate): void {
    this.selectedKey.set(t.key);
    this.previewData.set(null);
    this.templateForm.reset({
      subject: t.subject,
      htmlBody: t.htmlBody,
      plainTextBody: t.plainTextBody,
      isEnabled: t.isEnabled,
    });
  }

  protected saveTemplate(): void {
    const key = this.selectedKey();
    if (!key || this.templateForm.invalid) {
      this.templateForm.markAllAsTouched();
      return;
    }
    this.savingTemplate.set(true);
    this.service.saveTemplate(key, this.templateForm.getRawValue()).subscribe({
      next: (updated) => {
        this.savingTemplate.set(false);
        this.templates.update((list) => list.map((t) => (t.key === key ? updated : t)));
        this.toast.success('Template saved', updated.name);
      },
      error: () => this.savingTemplate.set(false),
    });
  }

  protected preview(): void {
    const key = this.selectedKey();
    if (!key) return;
    this.service.preview(key, this.templateForm.getRawValue()).subscribe((p) => {
      this.previewData.set(p);
    });
  }

  protected async restore(t: EmailTemplate): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Restore "${t.name}"?`,
      message: 'Your edits to this message are discarded and the original wording comes back.',
      confirmLabel: 'Restore',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.service.resetTemplate(t.key).subscribe((updated) => {
      this.templates.update((list) => list.map((x) => (x.key === t.key ? updated : x)));
      this.select(updated);
      this.toast.success('Template restored');
    });
  }
}
