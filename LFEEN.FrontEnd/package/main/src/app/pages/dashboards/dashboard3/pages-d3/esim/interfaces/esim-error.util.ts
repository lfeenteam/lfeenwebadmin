import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * EQAMATIK's 400/403/404/409 are forwarded as `{ success: false, message, errorCode? }`;
 * anything else upstream arrives as 502. Our own 401/403 come back with an empty body.
 */
export function resolveEsimError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.esim.errors.${key}`);
  const message: string = typeof e?.error?.message === 'string' ? e.error.message.trim() : '';

  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return message || t('forbidden');
  if (e.status === 404) return message || t('notFound');
  if ((e.status === 400 || e.status === 409) && message) return message;

  return t('generic');
}
