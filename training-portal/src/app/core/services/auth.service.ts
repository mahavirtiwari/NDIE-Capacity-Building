import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  AppRole,
  AuthUser,
  ForgotPasswordResult,
  LoginRequest,
  LoginResponse,
  Permission,
} from '../models';
import { ApiService } from './api.service';

const TOKEN_KEY = 'ntms.token';
const USER_KEY = 'ntms.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(readUser());
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token() && !!this._user());
  readonly role = computed<AppRole | null>(() => this._user()?.role ?? null);
  readonly displayName = computed(() => this._user()?.fullName ?? '');
  readonly initials = computed(() => this._user()?.avatarInitials ?? '');

  get token(): string | null {
    return this._token();
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('auth/login', request).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._token.set(res.token);
        this._user.set(res.user);
      }),
    );
  }

  /**
   * Starts a self-service reset. The API answers the same way whether or not
   * the user ID exists, so nothing here reveals which accounts are real.
   */
  forgotPassword(userCode: string): Observable<ForgotPasswordResult> {
    return this.api.post<ForgotPasswordResult>('auth/forgot-password', { userCode });
  }

  resetPassword(userCode: string, code: string, newPassword: string): Observable<boolean> {
    return this.api.post<boolean>('auth/reset-password', { userCode, code, newPassword });
  }

  logout(redirect = true): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    if (redirect) void this.router.navigate(['/login']);
  }

  hasPermission(permission: Permission | Permission[]): boolean {
    const user = this._user();
    if (!user) return false;
    if (user.role === 'SuperAdmin') return true;
    const needed = Array.isArray(permission) ? permission : [permission];
    return needed.some((p) => user.permissions.includes(p));
  }

  hasRole(...roles: AppRole[]): boolean {
    const role = this.role();
    return !!role && roles.includes(role);
  }
}

function readUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}
