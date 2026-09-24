import { DATE_PIPE_DEFAULT_OPTIONS, registerLocaleData } from '@angular/common';
import localeEnIn from '@angular/common/locales/en-IN';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { mockApiInterceptor } from './core/mock/mock-api.interceptor';
import { BrandingService } from './core/services/branding.service';
import { routes } from './app.routes';

/* Indian English number, date and currency formats. */
registerLocaleData(localeEnIn);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'en-IN' },
    /* Every timestamp is shown in IST, pinned rather than taken from the
       viewer's clock: a Ministry record reads the same from any desk, and an
       officer abroad still sees the Indian working day. The API marks its
       timestamps as UTC, so this is a straight conversion. */
    {
      provide: DATE_PIPE_DEFAULT_OPTIONS,
      useValue: { timezone: '+0530', dateFormat: 'dd MMM yyyy' },
    },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    /* Order matters: auth adds the bearer token, error maps failures to toasts,
       and the mock short-circuits the request when `useMockApi` is on. */
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, mockApiInterceptor])),
    /* Portal identity is server owned, so it is fetched before the shell paints.
       A failure here is swallowed: the service keeps its compiled-in defaults. */
    provideAppInitializer(() =>
      firstValueFrom(inject(BrandingService).load()).catch(() => undefined),
    ),
  ],
};
