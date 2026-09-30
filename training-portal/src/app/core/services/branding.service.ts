import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, Branding, BrandingUpdate, LogoSlot } from '../models';
import { ApiService } from './api.service';

/**
 * Holds the portal identity for the whole app. `load()` runs once at start-up
 * (see `app.config.ts`) and the signals below feed the sidebar, the sign-in
 * panel and the browser title. Falls back to the compiled-in names so the
 * shell still renders if the API is unreachable.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  private readonly state = signal<Branding>({
    organisationName: environment.organisation,
    shortName: environment.appShortName,
    portalTitle: environment.appName,
    tagline: null,
    supportEmail: environment.supportEmail,
    hasLogo: false,
    logoUrl: null,
    logoVersion: 0,
    hasReversedLogo: false,
    reversedLogoUrl: null,
    reversedLogoVersion: 0,
    partnerName: null,
    hasPartnerLogo: false,
    partnerLogoUrl: null,
    partnerLogoVersion: 0,
    updatedOn: new Date().toISOString(),
  });

  readonly branding = this.state.asReadonly();
  readonly organisationName = computed(() => this.state().organisationName);
  readonly shortName = computed(() => this.state().shortName);
  readonly portalTitle = computed(() => this.state().portalTitle);

  /** Absolute URL of the uploaded mark, or null when none has been set. */
  readonly logoSrc = computed(() => this.absolute(this.state().logoUrl));
  /** The mark for a dark ground, falling back to the colour one. */
  readonly reversedLogoSrc = computed(
    () => this.absolute(this.state().reversedLogoUrl) ?? this.logoSrc(),
  );
  /** The partner mark, e.g. QCI alongside NDIE. */
  readonly partnerLogoSrc = computed(() => this.absolute(this.state().partnerLogoUrl));
  readonly partnerName = computed(() => this.state().partnerName ?? '');

  private absolute(url: string | null | undefined): string | null {
    if (!url) return null;
    return /^(https?:|data:)/.test(url)
      ? url
      : `${environment.apiBaseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  load(): Observable<Branding> {
    return this.api.get<Branding>('branding').pipe(tap((b) => this.apply(b)));
  }

  save(update: BrandingUpdate): Observable<Branding> {
    return this.api.put<Branding>('branding', update).pipe(tap((b) => this.apply(b)));
  }

  uploadLogo(file: File, slot: LogoSlot = 'primary'): Observable<Branding> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post<ApiEnvelope<Branding>>(`${environment.apiBaseUrl}/${path(slot)}`, form)
      .pipe(
        map((r) => r.data),
        tap((b) => this.apply(b)),
      );
  }

  removeLogo(slot: LogoSlot = 'primary'): Observable<Branding> {
    return this.api.delete<Branding>(path(slot)).pipe(tap((b) => this.apply(b)));
  }

  private apply(branding: Branding): void {
    this.state.set(branding);
    document.title = branding.portalTitle;
  }
}

const path = (slot: LogoSlot): string => {
  if (slot === 'partner') return 'branding/partner-logo';
  return slot === 'reversed' ? 'branding/reversed-logo' : 'branding/logo';
};
