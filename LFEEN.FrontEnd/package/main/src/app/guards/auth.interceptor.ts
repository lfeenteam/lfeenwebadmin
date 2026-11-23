import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import { safeReturnUrl } from './return-url.util';
import { CoreService } from '../services/core.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private loginService: LoginService,
    private router: Router,
    private coreService: CoreService
  ) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const sentToken = this.loginService.getToken();
    const authReq = this.addAuthorizationHeader(req);

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          error.status !== 401 ||
          this.loginService.isRefreshRequestUrl(req.url) ||
          this.loginService.isAnonymousAuthUrl(req.url)
        ) {
          return throwError(() => error);
        }

        // The token changed while this request was out (a parallel refresh finished,
        // or another tab refreshed): just retry with the current one.
        const currentToken = this.loginService.getToken();
        if (currentToken && currentToken !== sentToken) {
          return this.retry(req, next);
        }

        if (!this.loginService.hasValidRefreshToken()) {
          return this.logoutAndRedirect(error);
        }

        // Parallel 401s share one refresh call (see LoginService.refreshToken).
        return this.loginService.refreshToken().pipe(
          catchError((refreshError) => this.onRefreshFailed(refreshError)),
          switchMap(() => this.retry(req, next))
        );
      })
    );
  }

  // Resend with the new token. A second 401 means the new token is rejected too
  // (e.g. the session was revoked), so end the session instead of refreshing again.
  // Any other error goes to the caller as-is — it isn't a sign-in problem.
  private retry(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(this.addAuthorizationHeader(req)).pipe(
      catchError((error: HttpErrorResponse) =>
        error.status === 401 ? this.logoutAndRedirect(error) : throwError(() => error)
      )
    );
  }

  // The refresh endpoint refused the token → the session is over. A network error
  // or a server error says nothing about the session, so keep it and just fail.
  private onRefreshFailed(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)) {
      return throwError(() => error);
    }
    return this.logoutAndRedirect(error);
  }

  private addAuthorizationHeader(req: HttpRequest<unknown>): HttpRequest<unknown> {
    const token = this.loginService.getToken();
    const lang = this.coreService.getLanguage() || 'en';

    const headers: Record<string, string> = {
      'Accept-Language': lang,
    };

    if (token && !this.loginService.isAnonymousAuthUrl(req.url)) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return req.clone({ setHeaders: headers });
  }

  private logoutAndRedirect(error: unknown): Observable<never> {
    // Several requests can fail together: log out and redirect once.
    if (this.loginService.isLoggedIn()) {
      this.loginService.logout();
      const lang = this.coreService.getLanguage() === 'en' ? 'en' : 'ar';
      // Keep the current page so the admin lands back on it after signing in again.
      const returnUrl = safeReturnUrl(this.router.url);
      this.router.navigate(['/', lang, 'd3', 'login'], {
        queryParams: returnUrl ? { returnUrl } : undefined,
      });
    }
    return throwError(() => error);
  }
}
