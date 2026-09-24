import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/** Turns any failed call into a toast and surfaces 401s as a forced sign-out. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isLogin = req.url.includes('auth/login');
      if (error instanceof HttpErrorResponse && !isLogin) {
        if (error.status === 401) {
          toast.error('Session expired', 'Please sign in again.');
          auth.logout();
        } else if (error.status === 403) {
          toast.error('Not permitted', 'You do not have access to this action.');
        } else {
          const body = error.error as { message?: string; errors?: string[] } | null;
          toast.error(
            body?.message ?? `Request failed (${error.status})`,
            body?.errors?.join(', '),
          );
        }
      }
      return throwError(() => error);
    }),
  );
};
