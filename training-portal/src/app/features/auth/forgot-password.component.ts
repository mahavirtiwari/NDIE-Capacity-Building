import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BrandingService } from '../../core/services/branding.service';
import { ToastService } from '../../core/services/toast.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthArtComponent } from './auth-art.component';

type Step = 'request' | 'reset';

/**
 * Self-service password reset, in two steps on one page: ask for a code, then
 * set the new password. Identity is the system generated user ID here too —
 * the code goes to whatever address is on file for it, which the user may have
 * changed since. The API never confirms whether an ID exists, so neither does
 * this screen.
 */
@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, BrandLogoComponent, AuthArtComponent],
  template: `
    <div class="auth">
      <section class="auth__brand">
        <div class="auth__watermark"><app-auth-art /></div>

        <div class="auth__brand-top">
          @if (hasLogo()) {
            <!-- The marks sit at opposite ends, as they do on a letterhead. -->
            <app-brand-logo [height]="82" />
          } @else {
            <span class="auth__emblem"><app-icon name="graduation" [size]="26" /></span>
          }
          @if (hasPartnerLogo()) {
            <app-brand-logo slot="partner" [height]="82" />
          }
        </div>

        <div class="stack stack-lg">
          <h2 class="auth__headline">Locked out? Let's get you <em>back in</em>.</h2>
          <p class="auth__lede">
            We send a single-use code to the email address held against your account. Start with
            your user ID or the email you registered — either one will find it.
          </p>
        </div>

        <span class="auth__foot">
          <app-icon name="lock" [size]="14" />
          Resetting signs you out everywhere else.
        </span>

        <footer class="auth__footer">
          <span>
            Sign-in activity is logged. Your details are used only to administer training
            programmes.
          </span>
          <span class="auth__footer-copy">&copy; {{ year }} {{ organisation() }}</span>
        </footer>
      </section>

      <section class="auth__panel">
        <div class="auth__form-wrap">
          <div class="auth__card">
            <ol class="steps" aria-label="Reset progress">
              <li class="steps__item" [class.is-done]="step() === 'reset'" [class.is-on]="step() === 'request'">
                <span class="steps__dot">1</span> Request a code
              </li>
              <li class="steps__item" [class.is-on]="step() === 'reset'">
                <span class="steps__dot">2</span> Set a new password
              </li>
            </ol>

            @if (step() === 'request') {
              <div class="stack stack-xs mb-md">
                <h1 class="auth__title">Reset your password</h1>
                <p class="text-sm text-muted">
                  Enter the user ID you sign in with, or the email address on your account.
                </p>
              </div>

              <form [formGroup]="requestForm" (ngSubmit)="request()" class="stack stack-md">
                <div class="field">
                  <label class="field-label" for="fpUser">
                    User ID or email <span class="req">*</span>
                  </label>
                  <div class="input-group">
                    <span class="input-icon"><app-icon name="users" [size]="15" /></span>
                    <input
                      id="fpUser"
                      class="input"
                      formControlName="userCode"
                      autocomplete="username"
                      placeholder="SA0001 or your registered email"
                      (input)="upper($event)"
                    />
                  </div>
                  @if (requestForm.controls.userCode.invalid && requestForm.controls.userCode.touched) {
                    <span class="field-error">Enter your user ID or registered email.</span>
                  }
                </div>

                @if (error()) {
                  <div class="alert alert--danger">
                    <app-icon name="alert" [size]="16" />
                    <span>{{ error() }}</span>
                  </div>
                }

                <button type="submit" class="btn btn--primary btn--lg btn--block" [disabled]="busy()">
                  @if (busy()) {
                    <span class="spinner"></span> Sending…
                  } @else {
                    Send reset code <app-icon name="send" [size]="15" />
                  }
                </button>
              </form>
            } @else {
              <div class="stack stack-xs mb-md">
                <h1 class="auth__title">Enter the code</h1>
                <p class="text-sm text-muted">{{ sentNotice() }}</p>
              </div>

              <form [formGroup]="resetForm" (ngSubmit)="reset()" class="stack stack-md">
                <div class="field">
                  <label class="field-label" for="fpCode">Reset code <span class="req">*</span></label>
                  <input
                    id="fpCode"
                    class="input input--code"
                    formControlName="code"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    placeholder="000000"
                  />
                </div>

                <div class="field">
                  <label class="field-label" for="fpNew">New password <span class="req">*</span></label>
                  <div class="input-group">
                    <span class="input-icon"><app-icon name="lock" [size]="15" /></span>
                    <input
                      id="fpNew"
                      class="input"
                      [type]="reveal() ? 'text' : 'password'"
                      formControlName="newPassword"
                      autocomplete="new-password"
                    />
                    <button
                      type="button"
                      class="btn btn--icon reveal"
                      (click)="reveal.set(!reveal())"
                      [attr.aria-label]="reveal() ? 'Hide password' : 'Show password'"
                    >
                      <app-icon [name]="reveal() ? 'eye' : 'lock'" [size]="15" />
                    </button>
                  </div>
                  <span class="field-hint">At least 8 characters.</span>
                </div>

                <div class="field">
                  <label class="field-label" for="fpConfirm">
                    Confirm new password <span class="req">*</span>
                  </label>
                  <div class="input-group">
                    <span class="input-icon"><app-icon name="lock" [size]="15" /></span>
                    <input
                      id="fpConfirm"
                      class="input"
                      [type]="reveal() ? 'text' : 'password'"
                      formControlName="confirmPassword"
                      autocomplete="new-password"
                    />
                  </div>
                </div>

                @if (error()) {
                  <div class="alert alert--danger">
                    <app-icon name="alert" [size]="16" />
                    <span>{{ error() }}</span>
                  </div>
                }

                <button type="submit" class="btn btn--primary btn--lg btn--block" [disabled]="busy()">
                  @if (busy()) {
                    <span class="spinner"></span> Saving…
                  } @else {
                    Set new password <app-icon name="check" [size]="16" />
                  }
                </button>

                <button type="button" class="auth__forgot" (click)="backToRequest()">
                  <app-icon name="refresh" [size]="14" />
                  Use a different user ID, or send a new code
                </button>
              </form>
            }
          </div>

          <a class="auth__back" routerLink="/login">
            <app-icon name="chevron-left" [size]="15" />
            Back to sign in
          </a>
        </div>
      </section>
    </div>
  `,
  styleUrl: './auth-layout.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly branding = inject(BrandingService);

  protected readonly organisation = this.branding.organisationName;
  protected readonly year = new Date().getFullYear();
  protected readonly hasLogo = computed(() => this.branding.logoSrc() !== null);
  protected readonly hasPartnerLogo = computed(() => this.branding.partnerLogoSrc() !== null);

  protected readonly step = signal<Step>('request');
  protected readonly busy = signal(false);
  protected readonly reveal = signal(false);
  protected readonly error = signal('');
  private readonly validityMinutes = signal(15);

  /* No address is echoed back: the API withholds it so this page cannot be
     used to work out which user IDs are real. */
  protected readonly sentNotice = computed(
    () =>
      `If that user ID exists, a code has been sent to the email address on file. ` +
      `It is valid for ${this.validityMinutes()} minutes.`,
  );

  protected readonly requestForm = this.fb.nonNullable.group({
    userCode: ['', Validators.required],
  });

  protected readonly resetForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  /** The user ID is always upper case, as it is on the sign-in screen. */
  /**
   * User IDs are upper case, email addresses are not. Forcing the whole field
   * would turn a typed address into one nobody can match, so the moment an
   * "@" appears the text is left exactly as entered.
   */
  protected upper(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value.includes('@')) return;
    const value = input.value.toUpperCase();
    if (input.value !== value) {
      input.value = value;
      this.requestForm.controls.userCode.setValue(value, { emitEvent: false });
    }
  }

  protected request(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.requestForm.getRawValue().userCode.trim()).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.validityMinutes.set(result.validityMinutes || 15);
        this.step.set('reset');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Could not send a reset code. Please try again.');
      },
    });
  }

  protected reset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const raw = this.resetForm.getRawValue();
    if (raw.newPassword !== raw.confirmPassword) {
      this.error.set('The two passwords do not match.');
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.auth
      .resetPassword(this.requestForm.getRawValue().userCode.trim(), raw.code.trim(), raw.newPassword)
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.success('Password reset', 'Sign in with your new password.');
          void this.router.navigate(['/login']);
        },
        error: (caught: unknown) => {
          this.busy.set(false);
          const body = (caught as { error?: { message?: string } })?.error;
          this.error.set(body?.message ?? 'Could not reset the password. Please try again.');
        },
      });
  }

  protected backToRequest(): void {
    this.error.set('');
    this.resetForm.reset();
    this.step.set('request');
  }
}
