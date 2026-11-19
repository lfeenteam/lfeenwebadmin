import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

/**
 * Merchant debts moved into a tab of Settlements. The old address
 * (/:lang/d3/settlement-debts[?accountId=…]) must still open that tab, filtered on the merchant.
 *
 * A string `redirectTo` with its own query (`settlements?tab=debts`) loses it, so the redirect
 * is a UrlTree built from the guard instead.
 */
export const settlementDebtsRedirectGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const lang = route.pathFromRoot.map(r => r.params['lang']).find(Boolean) || 'ar';
  const accountId = route.queryParamMap.get('accountId')?.trim();
  return inject(Router).createUrlTree(['/', lang, 'd3', 'settlements'], {
    queryParams: { tab: 'debts', ...(accountId ? { accountId } : {}) },
  });
};
