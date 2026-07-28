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
    const authReq = this.addAuthorizationHeader(req);

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        console.log('[AuthInterceptor] error caught', {
          url: req.url,
          status: error.status,
          isRefreshRequestUrl: this.loginService.isRefreshRequestUrl(req.url),
          hasValidRefreshToken: this.loginService.hasValidRefreshToken(),
        });

        if (
          error.status === 401 &&
          !this.loginService.isRefreshRequestUrl(req.url) &&
          this.loginService.hasValidRefreshToken()
        ) {
          console.log('[AuthInterceptor] conditions met, calling refreshToken()');
          return this.loginService.refreshToken().pipe(
            switchMap(() => next.handle(this.addAuthorizationHeader(req))),
            catchError((refreshError) => this.logoutAndRedirect(refreshError))
          );
        }

        return throwError(() => error);
      })
    );
  }

  private addAuthorizationHeader(req: HttpRequest<unknown>): HttpRequest<unknown> {
    const token = this.loginService.getToken();
    const lang = this.coreService.getLanguage() || 'en';

    const headers: Record<string, string> = {
      'Accept-Language': lang,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return req.clone({ setHeaders: headers });
  }

  private logoutAndRedirect(error: HttpErrorResponse): Observable<never> {
    this.loginService.logout();
    this.router.navigate(['/en/d3/login']);
    return throwError(() => error);
  }
}
