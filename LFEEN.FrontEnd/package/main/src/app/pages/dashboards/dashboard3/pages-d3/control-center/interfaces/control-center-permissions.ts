import { LoginService } from '../../../services/login/login.service';
import { canAccessPage } from 'src/app/guards/page-access';

/** AppRuntime.* permissions, lower-cased like the rest of the login permission checks. */
export const APP_RUNTIME_PERMISSIONS = {
  /** Open the screen at all — without it every call is 403. */
  view: 'appruntime.view',
  manageThemes: 'appruntime.managethemes',
  manageReleases: 'appruntime.managereleases',
  manageMaintenance: 'appruntime.managemaintenance',
} as const;

/**
 * Whether the login response carries AppRuntime.* at all. It doesn't yet on every
 * environment, so it can't be the only signal (see hasAppRuntimePermission).
 */
export function appRuntimePermissionsKnown(login: LoginService): boolean {
  return login.permissions().some(p => p.toLowerCase().startsWith('appruntime.'));
}

/**
 * Exact check once the login response carries AppRuntime.* permissions. Before that,
 * only an admin whose sidebar payload lists Control Center (the backend sends it to
 * AppRuntime.View holders only) is let through — and the API's 403 still gates each
 * action. An admin with neither is refused (BUG-2739: used to be let in by default).
 */
export function hasAppRuntimePermission(login: LoginService, permission: string): boolean {
  if (appRuntimePermissionsKnown(login)) {
    return login.permissions().some(p => p.toLowerCase() === permission);
  }
  return canAccessPage({ sidebarKeys: ['control-center'] }, [], login.sidebar());
}
