import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import { SidebarService } from '../pages/dashboards/dashboard3/services/sidebar.service';
import { PAGE_ACCESS, PageAccessKey, canAccessPage } from './page-access';

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
