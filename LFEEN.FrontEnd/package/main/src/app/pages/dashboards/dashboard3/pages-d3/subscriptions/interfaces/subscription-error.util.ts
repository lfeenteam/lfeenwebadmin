import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * The admin API forwards EQAMATIK errors as `{ success: false, message }` with the
 * message already localized via Accept-Language — so 400/409 show the server text.
 * EQAMATIK's own 401/403/422 reach us as 502, hence the generic network message.
 */
export function resolveSubscriptionError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.subscriptionErrors.${key}`);
  const message: string = typeof e?.error?.message === 'string' ? e.error.message.trim() : '';

  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return t('forbidden');
  if (e.status === 404) return message || t('notFound');
  if ((e.status === 400 || e.status === 409) && message) return message;
  if (e.status === 409) return t('stale');

  return t('generic');
}

/**
 * The item changed or disappeared server-side, so the list should be reloaded: a 404, or a 409
 * such as an already-processed order or SUBSCRIPTION_PROPERTY_NOT_ELIGIBLE (property banned
 * after the order was placed). SUBSCRIPTION_ORDER_PARTIALLY_ACTIVATED is the exception — the
 * guide says to only show its message.
 */
export function isStaleSubscriptionError(err: unknown): boolean {
  const e = err as HttpErrorResponse;
  if (e?.status === 404) return true;
  return e?.status === 409 && e?.error?.errorCode !== 'SUBSCRIPTION_ORDER_PARTIALLY_ACTIVATED';
}
