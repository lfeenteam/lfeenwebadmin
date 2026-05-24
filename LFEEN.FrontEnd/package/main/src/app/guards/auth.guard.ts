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

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const loginService = inject(LoginService);
  const router = inject(Router);

  const urlSegments = state.url.split('/');
  const lang = urlSegments[1] || 'en';
  const loginUrl = router.parseUrl(`/${lang}/d3/login`);

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
