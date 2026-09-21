import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * Settlement errors come in several shapes: a localized validation payload, an
 * untranslated English message forwarded from the core system, and a 502 for
 * infra failures. Known backend messages are mapped to our own translations;
 * anything else falls back to the server text.
 */
export function resolveSettlementError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.settlements.errors.${key}`);
  const message: string = typeof e?.error?.message === 'string' ? e.error.message : '';

  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return t('forbidden');
  if (e.status === 404) return t('notFound');
  if (e.status === 409) return t('stale');

  if (e.status === 400) {
    const lower = message.toLowerCase();
    if (lower.includes('no bank account')) return t('noBankAccount');
    if (lower.includes('cannot exceed')) return t('amountExceeds');
    if (lower.includes('partialreason is required')) return t('partialReasonRequired');
    const fieldErrors = e.error?.errors;
    if (Array.isArray(fieldErrors) && fieldErrors.length) {
      const joined = fieldErrors.map((f: { message?: string }) => f?.message).filter(Boolean).join(' - ');
      if (joined) return joined;
    }
    if (message) return message;
  }

  return t('generic');
}

/** 409 = the payout already moved on (someone else acted, or a retried request landed). */
export function isStaleStateError(err: unknown): boolean {
  return (err as HttpErrorResponse)?.status === 409;
}
