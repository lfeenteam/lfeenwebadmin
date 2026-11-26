import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import {
  APP_RUNTIME_PERMISSIONS, hasAppRuntimePermission,
} from '../pages/dashboards/dashboard3/pages-d3/control-center/interfaces/control-center-permissions';
import { forbiddenRedirect } from './page-access.guard';

// Blocks the Control Center for admins without AppRuntime.View (or, while the login
// response doesn't carry AppRuntime.* yet, without Control Center in their sidebar).
// Even when the URL is typed directly — to the "no permission" page (BUG-2496, BUG-2739).
export const appRuntimeViewGuard: CanActivateFn = (_route, state) => {
  if (hasAppRuntimePermission(inject(LoginService), APP_RUNTIME_PERMISSIONS.view)) return true;
  return forbiddenRedirect(state);
};
