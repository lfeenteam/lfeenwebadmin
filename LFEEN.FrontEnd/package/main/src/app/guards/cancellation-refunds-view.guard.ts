import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';
import {
  CANCELLATION_REFUND_PERMISSIONS, hasCancellationRefundPermission,
} from '../pages/dashboards/dashboard3/pages-d3/cancellation-refunds/cancellation-refund.model';
import { forbiddenRedirect } from './page-access.guard';

// Blocks the stalled cancellation refunds page for admins without CancellationRefunds.View,
// even when the URL is typed directly — to the "no permission" page (BUG-2496).
export const cancellationRefundsViewGuard: CanActivateFn = (_route, state) => {
  if (hasCancellationRefundPermission(inject(LoginService), CANCELLATION_REFUND_PERMISSIONS.view)) return true;
  return forbiddenRedirect(state);
};
