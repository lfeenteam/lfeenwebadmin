import { inject } from '@angular/core';
import {
  Router,
  CanActivateFn,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import { safeReturnUrl, withLang } from './return-url.util';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const loginService = inject(LoginService);
  const router = inject(Router);

  const urlSegments = state.url.split('/');
  const lang = urlSegments[1] || 'en';
  const returnUrl = safeReturnUrl(state.url);
  const loginUrl = router.createUrlTree(['/', lang, 'd3', 'login'], {
    queryParams: returnUrl ? { returnUrl } : undefined,
  });

  if (loginService.isAuthenticated()) {
    return true;
  }

  if (loginService.hasValidRefreshToken()) {
    return loginService.refreshToken().pipe(
      map(() => true),
      catchError(() => {
        loginService.logout();
        return of(loginUrl);
      })
    );
  }

  return loginUrl;
};

// For signed-out pages (login, forgot/reset password): a signed-in admin is sent
// to the dashboard instead of seeing a login form that would replace their session.
export const guestGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const loginService = inject(LoginService);
  const router = inject(Router);

  if (loginService.isAuthenticated() || loginService.hasValidRefreshToken()) {
    const lang = state.url.split('/')[1] || 'ar';
    const returnUrl = safeReturnUrl(route.queryParamMap.get('returnUrl'));
    return router.parseUrl(returnUrl ? withLang(returnUrl, lang) : `/${lang}/d3/ceo`);
  }

  return true;
};
