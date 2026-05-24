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

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private loginService: LoginService, private router: Router) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const authReq = this.addAuthorizationHeader(req);

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          error.status === 401 &&
          !this.loginService.isRefreshRequestUrl(req.url) &&
          this.loginService.hasValidRefreshToken()
        ) {
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
    if (!token) {
      return req;
    }

    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private logoutAndRedirect(error: HttpErrorResponse): Observable<never> {
    this.loginService.logout();
    this.router.navigate(['/en/d3/login']);
    return throwError(() => error);
  }
}
