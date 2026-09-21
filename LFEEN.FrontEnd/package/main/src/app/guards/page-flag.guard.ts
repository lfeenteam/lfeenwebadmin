import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PAGE_FLAGS, PageFlagKey } from '../config/page-flags';

// Blocks a route whose page-flags.ts entry is false, redirecting to the
// error page instead of loading the component — even if the URL is typed directly.
export function pageFlagGuard(key: PageFlagKey): CanActivateFn {
  return (_route, state) => {
    if (PAGE_FLAGS[key]) return true;

    const router = inject(Router);
    const lang = state.url.split('/')[1] || 'en';
    return router.parseUrl(`/${lang}/authentication/error`);
  };
}
