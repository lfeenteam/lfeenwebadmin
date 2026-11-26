import { Injectable, inject } from '@angular/core';
import { LoginService } from './login/login.service';
import { canWriteModule, hasPermission } from 'src/app/guards/page-access';

/**
 * Permission checks for showing/hiding actions (BUG-2739). Reads the login signal,
 * so a `computed(() => this.perms.canWrite('roles'))` follows the session.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private login = inject(LoginService);

  /** Exact permission, e.g. `has('settings.manage')` (case-insensitive). */
  has(name: string): boolean {
    return hasPermission(this.login.permissions(), name);
  }

  hasAny(...names: string[]): boolean {
    return names.some(n => this.has(n));
  }

  /**
   * Any non-view permission of the module(s), e.g. `canWrite('roles')` or
   * `canWrite(['clientfaq', 'faq'])` — for actions whose exact backend permission
   * name isn't known here. See canWriteModule.
   */
  canWrite(prefixes: string | string[]): boolean {
    return canWriteModule(this.login.permissions(), prefixes);
  }
}
