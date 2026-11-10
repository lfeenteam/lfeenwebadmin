import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import {
  SETTINGS_PERMISSIONS, hasSettingsPermission,
} from '../pages/dashboards/dashboard3/interfaces/platform-settings.model';

// Blocks the general settings page for admins without Settings.View (or Settings.Manage).
// Redirects like page-flag.guard.ts, even when the URL is typed directly.
export const settingsViewGuard: CanActivateFn = (_route, state) => {
  if (hasSettingsPermission(inject(LoginService), SETTINGS_PERMISSIONS.view)) return true;

  const router = inject(Router);
  const lang = state.url.split('/')[1] || 'en';
  return router.parseUrl(`/${lang}/authentication/error`);
};
