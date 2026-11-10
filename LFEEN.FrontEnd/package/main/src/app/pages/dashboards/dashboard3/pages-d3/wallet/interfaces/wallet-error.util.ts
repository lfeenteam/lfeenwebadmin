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

// Error codes are matched before the HTTP status: a 404 can mean either a wrong
// account or a missing entry, and a 403 can be a permission or a same-admin rule.
const KNOWN_CODES: Record<string, string> = {
  WALLET_ACCOUNT_NOT_FOUND: 'accountNotFound',
  RELEASE_HOLD_SAME_ADMIN_NOT_ALLOWED: 'sameAdminNotAllowed',
};

/** The error code wherever the backend puts it: `code`, `errorCode`, or inside `errors[]`. */
export function walletErrorCode(err: unknown): string | null {
  const body = (err as HttpErrorResponse)?.error;
  if (!body || typeof body !== 'object') return null;
  const direct = body.code ?? body.errorCode;
  if (typeof direct === 'string' && direct) return direct;
  if (Array.isArray(body.errors)) {
    const nested = body.errors.find((f: { code?: string }) => typeof f?.code === 'string' && f.code);
    if (nested) return nested.code;
  }
  const message = typeof body.message === 'string' ? body.message : '';
  return Object.keys(KNOWN_CODES).find(c => message.includes(c)) ?? null;
}

export function resolveWalletError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.wallet.errors.${key}`);
  const body = e?.error;
  const message: string = typeof body?.message === 'string' ? body.message : '';

  const code = walletErrorCode(err);
  if (code && KNOWN_CODES[code]) return t(KNOWN_CODES[code]);
  // Approving your own request: the code isn't fixed yet, so any SAME_ADMIN variant maps here.
  if (code?.includes('SAME_ADMIN')) return t('sameAdminNotAllowed');

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
