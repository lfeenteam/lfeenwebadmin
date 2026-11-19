import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { transportErrorMessage } from '../../../utils/transport-error.util';

/** Our copy for known codes — used only when the backend sends no localized message. */
const ERROR_CODE_KEYS: Record<string, string> = {
  ESIM_ORDER_NOT_REFUNDABLE: 'refundNotRefundable',
  ESIM_REFUND_TOO_LARGE:     'refundTooLarge',
  ESIM_REFUND_IN_PROGRESS:   'refundInProgress',
};

/**
 * EQAMATIK's 400/403/404/409 are forwarded as `{ success: false, message, errorCode? }`;
 * anything else upstream arrives as 502. Our own 401/403 come back with an empty body.
 * `notFoundKey` overrides the 404 copy (e.g. for an order rather than a SIM).
 */
export function resolveEsimError(err: unknown, translate: TranslateService, notFoundKey = 'notFound'): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.esim.errors.${key}`);
  // A validation 400 carries the field's message in errors[]; prefer it over the generic one.
  const fieldMessage: unknown = e?.error?.errors?.[0]?.message;
  const message: string = typeof fieldMessage === 'string' && fieldMessage.trim()
    ? fieldMessage.trim()
    : typeof e?.error?.message === 'string' ? e.error.message.trim() : '';
  const codeKey = ERROR_CODE_KEYS[e?.error?.errorCode ?? ''];

  // A known business code wins over the status: the gateway has sent ESIM_REFUND_TOO_LARGE as a 502.
  if (codeKey) return message || t(codeKey);
  const transport = transportErrorMessage(err, translate);
  if (transport) return transport;
  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return message || t('forbidden');
  if (e.status === 404) return message || t(notFoundKey);
  if ((e.status === 400 || e.status === 409) && message) return message;

  return t('generic');
}
