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

      /* The feedback page behind a link in an e-mail speaks for itself.
         A spent or expired link is the ordinary outcome there, and the
         page says so in a paragraph; a red toast over the top of that
         paragraph only makes somebody think they did something wrong. */
      const isPublicFeedback = req.url.includes('public/feedback/');

      if (error instanceof HttpErrorResponse && !isLogin && !isPublicFeedback) {
        if (error.status === 401) {
          toast.error('Session expired', 'Please sign in again.');
          auth.logout();
        } else if (error.status === 403) {
          /* Only where somebody pressed something.

             A screen loads more than the thing it is named after: the
             Programs register asks for agencies, program types and exam
             papers to fill its dropdowns, and a role that may read
             programmes but not papers was met by "You do not have access
             to this action" before it had done anything at all. The
             dropdown it could not fill is simply empty, which is the
             honest answer and needs no announcement.

             A refused write is the opposite: nothing visible happens, so
             not saying why would leave somebody pressing Save. The server
             says why in its own words — "A Super Admin does not settle
             what a Coordinator may do" — and those are the words shown. */
          if (req.method !== 'GET') {
            const refusal = (error.error as { message?: string } | null)?.message;
            toast.error('Not permitted', refusal ?? 'You do not have access to this action.');
          }
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
