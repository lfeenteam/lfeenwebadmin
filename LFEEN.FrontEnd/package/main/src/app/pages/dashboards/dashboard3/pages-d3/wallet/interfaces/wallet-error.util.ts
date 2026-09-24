import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

// The wallet API fails in several shapes: our own validation payload (`errors[]`,
// localized by Accept-Language), an untranslated English message forwarded from the
// core system, a 502 when that system is down, and the default ASP.NET problem
// details for a mistyped enum. Known English messages are mapped to our translations.
const KNOWN_MESSAGES: { match: string; key: string }[] = [
  { match: 'insufficient balance', key: 'insufficientBalance' },
  { match: 'does not match its declared file type', key: 'invalidFile' },
  { match: 'maximum of 5 attachments', key: 'maxAttachments' },
  { match: 'only manually created', key: 'notEditable' },
  { match: 'ledger entry not found', key: 'entryNotFound' },
];

export function resolveWalletError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.wallet.errors.${key}`);
  const body = e?.error;
  const message: string = typeof body?.message === 'string' ? body.message : '';

  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return t('forbidden');
  if (e.status === 404) return t('entryNotFound');

  if (e.status === 400) {
    const fieldErrors = body?.errors;
    if (Array.isArray(fieldErrors) && fieldErrors.length) {
      const joined = fieldErrors.map((f: { message?: string }) => f?.message).filter(Boolean).join(' - ');
      if (joined) return joined;
    }
    const lower = message.toLowerCase();
    const known = KNOWN_MESSAGES.find(m => lower.includes(m.match));
    if (known) return t(known.key);
  }

  return t('generic');
}
