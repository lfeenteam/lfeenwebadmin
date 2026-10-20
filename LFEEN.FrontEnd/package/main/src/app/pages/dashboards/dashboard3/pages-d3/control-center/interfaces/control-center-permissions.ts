import { LoginService } from '../../../services/login/login.service';

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
 * environment; until it does nothing is hidden or locked here — the API still answers
 * 403 to anyone lacking the permission, and the screen shows that.
 */
export function appRuntimePermissionsKnown(login: LoginService): boolean {
  return login.permissions().some(p => p.toLowerCase().startsWith('appruntime.'));
}

/** Enforced only once the login response carries AppRuntime.* permissions (see above). */
export function hasAppRuntimePermission(login: LoginService, permission: string): boolean {
  if (!appRuntimePermissionsKnown(login)) return true;
  return login.permissions().some(p => p.toLowerCase() === permission);
}
