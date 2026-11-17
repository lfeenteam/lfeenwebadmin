import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import {
  CANCELLATION_REFUND_PERMISSIONS, hasCancellationRefundPermission,
} from '../pages/dashboards/dashboard3/pages-d3/cancellation-refunds/cancellation-refund.model';

// Blocks the stalled cancellation refunds page for admins without CancellationRefunds.View.
// Redirects like page-flag.guard.ts, even when the URL is typed directly.
export const cancellationRefundsViewGuard: CanActivateFn = (_route, state) => {
  if (hasCancellationRefundPermission(inject(LoginService), CANCELLATION_REFUND_PERMISSIONS.view)) return true;

  const router = inject(Router);
  const lang = state.url.split('/')[1] || 'en';
  return router.parseUrl(`/${lang}/authentication/error`);
};
