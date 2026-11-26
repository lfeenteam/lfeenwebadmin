import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import { SidebarService } from '../pages/dashboards/dashboard3/services/sidebar.service';
import { PAGE_ACCESS, PageAccessKey, canAccessPage, canWriteModule } from './page-access';

function langOf(state: RouterStateSnapshot): string {
  const lang = state.url.split('/')[1];
  return lang === 'en' || lang === 'ar' ? lang : 'ar';
}

/**
 * Where a permission guard sends an admin who may not open the page:
 * the "you don't have permission" page — not the 404 page (BUG-2496).
 * Call inside an injection context (a guard).
 */
export function forbiddenRedirect(state: RouterStateSnapshot): UrlTree {
  return inject(Router).parseUrl(`/${langOf(state)}/d3/no-access`);
}

/**
 * Blocks a page the admin has no permission for (see page-access.ts), even when the
 * URL is typed directly. Put it after authGuard, which may refresh the session first.
 * The dashboard is the default landing page, so an admin without it is sent to the
 * first page they can open instead of a "no permission" page.
 */
export function pageAccessGuard(key: PageAccessKey): CanActivateFn {
  return (_route, state) => {
    const login = inject(LoginService);
    if (canAccessPage(PAGE_ACCESS[key], login.permissions(), login.sidebar())) return true;

    if (key === 'dashboard') {
      return inject(Router).parseUrl(inject(SidebarService).landingUrl(langOf(state)));
    }
    return forbiddenRedirect(state);
  };
}

/**
 * For create/edit pages: also requires a write permission of the module (see
 * canWriteModule), so a view-only admin typing e.g. /roles/add lands on the
 * "no permission" page instead of a form whose save answers 403 (BUG-2739).
 * Put it after pageAccessGuard.
 */
export function pageWriteGuard(prefixes: string | string[]): CanActivateFn {
  return permissionGuard(perms => canWriteModule(perms, prefixes));
}

/**
 * A page whose data call needs a permission other than its module's view one
 * (e.g. the wallet approvals queue) — refused up front rather than showing the 403
 * as a "retry" state (BUG-2739). Put it after pageAccessGuard.
 */
export function permissionGuard(check: (permissions: string[]) => boolean): CanActivateFn {
  return (_route, state) => {
    if (check(inject(LoginService).permissions() ?? [])) return true;
    return forbiddenRedirect(state);
  };
}
