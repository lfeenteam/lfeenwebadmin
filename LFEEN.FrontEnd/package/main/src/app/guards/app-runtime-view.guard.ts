import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import {
  APP_RUNTIME_PERMISSIONS, hasAppRuntimePermission,
} from '../pages/dashboards/dashboard3/pages-d3/control-center/interfaces/control-center-permissions';

// Blocks the Control Center for admins without AppRuntime.View — enforced only once the
// login response carries AppRuntime.* permissions (until then the API's 403 is the gate).
// Redirects like page-flag.guard.ts, even when the URL is typed directly.
export const appRuntimeViewGuard: CanActivateFn = (_route, state) => {
  if (hasAppRuntimePermission(inject(LoginService), APP_RUNTIME_PERMISSIONS.view)) return true;

  const router = inject(Router);
  const lang = state.url.split('/')[1] || 'en';
  return router.parseUrl(`/${lang}/authentication/error`);
};
