import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import {
  SETTINGS_PERMISSIONS, hasSettingsPermission,
} from '../pages/dashboards/dashboard3/interfaces/platform-settings.model';
import { forbiddenRedirect } from './page-access.guard';

// Blocks the general settings page for admins without Settings.View (or Settings.Manage),
// even when the URL is typed directly — to the "no permission" page (BUG-2496).
export const settingsViewGuard: CanActivateFn = (_route, state) => {
  if (hasSettingsPermission(inject(LoginService), SETTINGS_PERMISSIONS.view)) return true;
  return forbiddenRedirect(state);
};
