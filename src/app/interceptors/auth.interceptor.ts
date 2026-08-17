import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

// The missing piece behind the whole "login exists but nothing works" bug: AuthService,
// review.service.ts, community.service.ts, booking.service.ts, notification.service.ts and
// i18n.service.ts all read/write `rb_token`, but nothing ever attached it to a request.
// app.config.ts imported `withInterceptors` but never called it, so it was a dead import —
// every write to the API went out with no Authorization header, and the server's verifyToken
// middleware (which only ever checks the Bearer header, no cookie fallback) rejected every one
// of them with 401, regardless of whether the person was genuinely logged in client-side.
//
// This interceptor attaches the token to every request that targets our own API — and only
// our own API, so a token never leaks to a third-party host if one is ever added later.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('rb_token');
  const isApiRequest = req.url.startsWith(environment.apiUrl);

  if (token && isApiRequest) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError(err => {
      // If the server says the token is expired/revoked/invalid, clear it locally too —
      // otherwise the navbar keeps showing "logged in" while every subsequent request
      // silently 401s, which is the same class of bug this interceptor exists to fix.
      if (isApiRequest && (err?.status === 401 || err?.status === 403) && token) {
        localStorage.removeItem('rb_token');
        localStorage.removeItem('rb_user');
      }
      return throwError(() => err);
    })
  );
};
