import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { describeError, requiredFormat } from '../../core/validation/formats';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, IconComponent],
  template: `
    <app-page-header
      [title]="copy.text('page.profile.title')"
      [subtitle]="copy.text('page.profile.subtitle')"
      icon="settings"
      [breadcrumbs]="[{ label: copy.text('page.profile.title') }]"
    />

    @if (auth.user(); as user) {
      <div class="profile-grid">
        <section class="card">
          <div class="card__header"><span class="card__title">Account</span></div>
          <div class="card__body stack stack-md">
            <div class="row row-md">
              <span class="avatar" style="width: 52px; height: 52px; font-size: var(--fs-lg)">
                {{ user.avatarInitials }}
              </span>
              <div class="stack stack-xs">
                <strong class="text-lg">{{ user.fullName }}</strong>
                <span class="text-sm text-muted">{{ user.roleName }}</span>
              </div>
            </div>

            <div class="dl">
              <div>
                <div class="dl__term">User ID</div>
                <div class="dl__value"><code>{{ user.userCode }}</code></div>
              </div>
              <div>
                <div class="dl__term">Role</div>
                <div class="dl__value">{{ user.roleName }}</div>
              </div>
              <div>
                <div class="dl__term">Categories in scope</div>
                <div class="dl__value">{{ user.categoryIds.length || 'All' }}</div>
              </div>
              <div>
                <div class="dl__term">Program types in scope</div>
                <div class="dl__value">{{ user.programTypeIds.length || 'All' }}</div>
              </div>
            </div>

            <div class="alert alert--info">
              <app-icon name="info" [size]="16" />
              <span>
                Sign-in always uses the user ID above. Changing your email does not change how you
                sign in.
              </span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card__header"><span class="card__title">Contact details</span></div>
          <div class="card__body">
            <form [formGroup]="contactForm" class="stack stack-md" (ngSubmit)="saveContact()">
              <div class="field">
                <label class="field-label" for="pfEmail">Email</label>
                <input id="pfEmail" type="email" class="input" formControlName="email"
                  placeholder="Enter email address"
                  [class.is-invalid]="invalid('email')" />
                @if (invalid('email')) { <span class="field-error">{{ errorFor('email', 'Email') }}</span> }
              </div>
              <div class="field">
                <label class="field-label" for="pfMobile">Mobile</label>
                <input id="pfMobile" class="input" formControlName="mobile" maxlength="10" inputmode="numeric"
                  placeholder="Enter mobile number"
                  [class.is-invalid]="invalid('mobile')" />
                @if (invalid('mobile')) { <span class="field-error">{{ errorFor('mobile', 'Mobile') }}</span> }
              </div>
              <div class="btn-row btn-row--end">
                <button type="submit" class="btn btn--primary">Save contact details</button>
              </div>
            </form>
          </div>
        </section>

        <section class="card">
          <div class="card__header"><span class="card__title">Change password</span></div>
          <div class="card__body">
            <form [formGroup]="passwordForm" class="stack stack-md" (ngSubmit)="savePassword()">
              <div class="field">
                <label class="field-label" for="pfCurrent">Current password</label>
                <input id="pfCurrent" type="password" class="input" formControlName="current" autocomplete="current-password" />
              </div>
              <div class="field">
                <label class="field-label" for="pfNew">New password</label>
                <input id="pfNew" type="password" class="input" formControlName="next" autocomplete="new-password" />
                <span class="field-hint">Minimum 8 characters with a number and a symbol.</span>
              </div>
              <div class="field">
                <label class="field-label" for="pfConfirm">Confirm new password</label>
                <input id="pfConfirm" type="password" class="input" formControlName="confirm" autocomplete="new-password" />
              </div>
              <div class="btn-row btn-row--end">
                <button type="submit" class="btn btn--primary">Update password</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .profile-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
        gap: 1rem;
        align-items: start;
      }
    `,
  ],
})
export class ProfileComponent {
  protected readonly copy = inject(SiteTextService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);

  protected readonly contactForm = this.fb.group({
    email: [this.auth.user()?.email ?? '', requiredFormat('email')],
    mobile: [this.auth.user()?.mobile ?? '', requiredFormat('mobile')],
  });

  protected readonly passwordForm = this.fb.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  protected invalid(control: string): boolean {
    const field = this.contactForm.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected errorFor(control: string, label: string): string {
    return describeError(this.contactForm.get(control)?.errors ?? null, label);
  }

  protected saveContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }
    this.toast.success('Contact details updated', 'Your user ID is unchanged.');
  }

  protected savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const raw = this.passwordForm.getRawValue();
    if (raw.next !== raw.confirm) {
      this.toast.error('Passwords do not match');
      return;
    }
    this.passwordForm.reset();
    this.toast.success('Password updated');
  }
}
