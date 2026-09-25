import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { BrandingService } from '../../core/services/branding.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';
import { AuthArtComponent } from './auth-art.component';
import { IconComponent } from '../../shared/components/icon.component';

interface DemoAccount {
  alias: string;
  role: string;
  scope: string;
}

/** Seeded accounts. The alias is the real system generated user ID. */
const DEMO_ACCOUNTS: DemoAccount[] = [
  { alias: 'SA0001', role: 'Super Admin', scope: 'Masters, curriculum, fee, exams, material' },
  { alias: 'AD0002', role: 'Admin', scope: 'Agencies, operation managers, scrutiny' },
  { alias: 'AD0004', role: 'Scrutiny Officer', scope: 'Application scrutiny only' },
  { alias: 'OM0005', role: 'Operation Manager', scope: 'Coordinators and programs' },
  { alias: 'CO0010', role: 'Coordinator', scope: 'Program capture and attendance' },
];

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, BrandLogoComponent, AuthArtComponent],
  template: `
    <div class="auth">
      <section class="auth__brand">
        <!-- Behind the copy, not beside it. -->
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
          <h2 class="auth__headline">
            Run a programme end to end, from <em>application</em> to certificate.
          </h2>
          <ul class="auth__points">
            <li>
              <span class="auth__tick"><app-icon name="check" [size]="13" /></span>
              Set a programme up once — its form, fee and exam follow it
            </li>
            <li>
              <span class="auth__tick"><app-icon name="check" [size]="13" /></span>
              One scrutiny queue, with assignment, remarks and an audit trail
            </li>
            <li>
              <span class="auth__tick"><app-icon name="check" [size]="13" /></span>
              Attendance captured on site or online, in one register
            </li>
            <li>
              <span class="auth__tick"><app-icon name="check" [size]="13" /></span>
              Every state and district, straight from the LG Directory
            </li>
          </ul>
        </div>

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
          <div class="stack stack-xs mb-md">
            <h1 class="auth__title">Sign in</h1>
            <p class="text-sm text-muted">Use the system generated user ID issued to you — not your email address.</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="stack stack-md">
            <div class="field">
              <label class="field-label" for="username">User ID <span class="req">*</span></label>
              <div class="input-group">
                <span class="input-icon"><app-icon name="users" [size]="15" /></span>
                <input
                  id="username"
                  class="input"
                  formControlName="username"
                  autocomplete="username"
                  placeholder="Enter user ID"
                  [class.is-invalid]="invalid('username')"
                />
              </div>
              @if (invalid('username')) {
                <span class="field-error">User ID is required.</span>
              }
            </div>

            <div class="field">
              <div class="auth__label-row">
                <label class="field-label" for="password">Password <span class="req">*</span></label>
                <!-- Beside the field it belongs to, which is where people look
                     for it, rather than adrift under the button. -->
                <a class="auth__forgot" routerLink="/forgot-password">Forgot password?</a>
              </div>
              <div class="input-group">
                <span class="input-icon"><app-icon name="lock" [size]="15" /></span>
                <input
                  id="password"
                  class="input"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="Enter password"
                  [class.is-invalid]="invalid('password')"
                />
                <button
                  type="button"
                  class="btn btn--icon reveal"
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  <app-icon [name]="showPassword() ? 'eye' : 'lock'" [size]="15" />
                </button>
              </div>
              @if (invalid('password')) {
                <span class="field-error">Password is required.</span>
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
                <span class="spinner"></span> Signing in…
              } @else {
                Sign in <app-icon name="chevron-right" [size]="16" />
              }
            </button>
          </form>

          </div>

          @if (showDemoAccounts) {
          <div class="demo">
            <span class="demo__title">Demo accounts — password <code>Password&#64;123</code></span>
            <div class="demo__grid">
              @for (account of accounts; track account.alias) {
                <button type="button" class="demo__item" (click)="useDemo(account.alias)">
                  <strong>{{ account.role }}</strong>
                  <span class="text-xs text-muted">{{ account.alias }}</span>
                  <span class="text-xs">{{ account.scope }}</span>
                </button>
              }
            </div>
          </div>
          }
        </div>
      </section>
    </div>
  `,
  styleUrl: './auth-layout.scss',
  styles: [
    `
      .demo { margin-top: 1.75rem; }
      .demo__title {
        display: block;
        font-size: var(--fs-xs);
        color: var(--ink-500);
        margin-bottom: 0.5rem;
      }
      .demo__grid { display: grid; gap: 0.4rem; }
      .demo__item {
        display: grid;
        gap: 0.1rem;
        text-align: left;
        padding: 0.5rem 0.65rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        cursor: pointer;
        font: inherit;
        transition: border-color var(--transition), background var(--transition);
      }
      .demo__item:hover { border-color: var(--brand-500); background: var(--brand-50); }
      .demo__item strong { font-size: var(--fs-sm); color: var(--ink-900); }

`,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  private readonly branding = inject(BrandingService);

  protected readonly organisation = this.branding.organisationName;
  protected readonly year = new Date().getFullYear();
  protected readonly hasLogo = computed(() => this.branding.logoSrc() !== null);
  protected readonly hasPartnerLogo = computed(() => this.branding.partnerLogoSrc() !== null);
  protected readonly accounts = DEMO_ACCOUNTS;
  /* These five exist only in the browser mock. Against the real API seeding
     creates SA0001 alone, so advertising the rest would send people down a
     dead end. */
  protected readonly showDemoAccounts = environment.useMockApi;

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);

  /* Pre-filled only for the browser mock; a real deployment starts empty. */
  protected readonly form = this.fb.nonNullable.group({
    username: [environment.useMockApi ? 'SA0001' : '', Validators.required],
    password: [environment.useMockApi ? 'Password@123' : '', Validators.required],
  });

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected useDemo(alias: string): void {
    this.form.patchValue({ username: alias, password: 'Password@123' });
    this.submit();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.toast.success(`Welcome, ${response.user.fullName}`, response.user.roleName);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Unable to sign in. Please try again.');
      },
    });
  }
}
