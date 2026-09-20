import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * The adjust endpoint returns a plain 400 for both invalid-amount and
 * insufficient-balance — the distinguishing signal is the error code/message in
 * the body, not the HTTP status, so it's matched defensively across a few likely
 * body shapes rather than assuming one exact contract.
 */
export function resolveWalletError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.wallet.errors.${key}`);
  const body = e?.error;
  const signal: string = [body?.code, body?.errorCode, body?.message]
    .filter((v): v is string => typeof v === 'string')
    .join(' ');

  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return t('forbidden');

  if (e.status === 400) {
    if (signal.includes('WALLET_ADJUSTMENT_INVALID_AMOUNT')) return t('invalidAmount');
    if (signal.includes('WALLET_ADJUSTMENT_INSUFFICIENT_BALANCE')) return t('insufficientBalance');
    if (typeof body?.message === 'string' && body.message) return body.message;
  }

  return t('generic');
}
