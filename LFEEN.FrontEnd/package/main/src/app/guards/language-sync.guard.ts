import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { CoreService } from '../services/core.service';

const SUPPORTED_LANGS = ['ar', 'en'];

/**
 * Applies the ':lang' URL segment to CoreService and ngx-translate *before* the
 * matched route's components are created — so the AuthInterceptor's
 * `Accept-Language` header is already correct for the first HTTP request a
 * feature component fires in ngOnInit. Without this, the language was only synced
 * later (on NavigationEnd in AppComponent), so server-localized data came back in
 * the previous language until a manual refresh.
 */
function syncLanguageFromRoute(route: ActivatedRouteSnapshot): boolean {
  const core = inject(CoreService);
  const translate = inject(TranslateService);

  // ':lang' is not a path-less route, so a deep child snapshot may not carry the
  // param — walk up until we find it.
  let lang: string | null = null;
  for (let r: ActivatedRouteSnapshot | null = route; r && !lang; r = r.parent) {
    lang = r.paramMap.get('lang');
  }

  if (!lang || !SUPPORTED_LANGS.includes(lang)) {
    return true; // leave bad/missing lang to the existing redirect guard
  }

  if (core.getLanguage() !== lang) {
    core.setOptions({ language: lang, dir: lang === 'ar' ? 'rtl' : 'ltr' });
  }
  if (translate.currentLang !== lang) {
    translate.use(lang);
  }
  return true;
}

export const languageSyncGuard: CanActivateFn = (route) => syncLanguageFromRoute(route);
export const languageSyncChildGuard: CanActivateChildFn = (route) => syncLanguageFromRoute(route);
