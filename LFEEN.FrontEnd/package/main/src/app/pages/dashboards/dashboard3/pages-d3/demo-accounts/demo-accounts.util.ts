import { TranslateService } from '@ngx-translate/core';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import type { DemoAccount } from '../../interfaces/demo-account.model';
import type { DemoAction } from './components/demo-action-dialog/demo-action-dialog.component';

// ── Actions (§5.3) — shared by the details header and the list's ⋮ menu ──

export interface DemoActionButton {
  action: DemoAction;
  icon: string;
  labelKey: string;
}

/** In display order; Disable is rendered apart as the danger item. */
export const DEMO_ACTION_BUTTONS: DemoActionButton[] = [
  { action: 'resend', icon: 'send', labelKey: 'd3.demoAccounts.actions.resend' },
  { action: 'resetPin', icon: 'key', labelKey: 'd3.demoAccounts.actions.resetPin' },
  { action: 'extend', icon: 'calendar-plus', labelKey: 'd3.demoAccounts.actions.extend' },
  { action: 'unlock', icon: 'lock-open', labelKey: 'd3.demoAccounts.actions.unlock' },
];

/** The toast after an action that returned the account. Reset PIN has its own dialog instead. */
export function demoActionToast(
  action: DemoAction,
  account: DemoAccount,
  translate: TranslateService,
  lang: string
): { ok: boolean; message: string } | null {
  const t = (key: string, params?: object) => translate.instant(`d3.demoAccounts.toasts.${key}`, params);
  switch (action) {
    case 'resend': {
      // 200 even when delivery failed — the real result is the newest attempt.
      const last = account.deliveries?.[0];
      return last?.succeeded === true
        ? { ok: true, message: t('resent') }
        : { ok: false, message: `${t('resendFailed')}${last?.error ? `: ${last.error}` : ''}` };
    }
    case 'extend':
      return { ok: true, message: t('extended', { date: formatRiyadhDate(account.expiresAt, lang) ?? '' }) };
    case 'unlock':
      return { ok: true, message: t('unlocked') };
    case 'disable':
      return { ok: true, message: t('disabled') };
    default:
      return null;
  }
}

// ── Errors (§8) ─────────────────────────────────────────────────────────
// Branch on errorCode only — never on the HTTP status or the message text.

export interface DemoFieldError {
  /** Lower-cased form field name, or null when the error has no field. */
  field: string | null;
  message: string;
}

export interface DemoApiError {
  code: string | null;
  status: number;
  /** Server message (already localized) — the fallback when no own text exists. */
  message: string;
  fieldErrors: DemoFieldError[];
}

// Codes with their own Arabic/English text under d3.demoAccounts.errors.*.
const KNOWN_CODES = new Set([
  'DEMO_DISABLED',
  'DEMO_LIMIT_REACHED',
  'DEMO_REQUEST_DUPLICATE',
  'DEMO_EMAIL_REQUIRED',
  'DEMO_PHONE_REQUIRED',
  'DEMO_DURATION_INVALID',
  'DEMO_ACCOUNT_NOT_FOUND',
  'DEMO_ACCOUNT_DISABLED',
  'DEMO_CREATE_FAILED',
  'DEMO_USER_MISSING',
  'PIN_TOO_WEAK',
]);

export function readDemoError(err: any): DemoApiError {
  const body = err?.error && typeof err.error === 'object' ? err.error : {};
  const errors = Array.isArray(body.errors) ? body.errors : [];
  return {
    code: typeof body.errorCode === 'string' ? body.errorCode : null,
    status: typeof err?.status === 'number' ? err.status : 0,
    message: typeof body.message === 'string' ? body.message : '',
    fieldErrors: errors
      .filter((e: any) => e?.message)
      .map((e: any) => ({ field: e.field ? String(e.field).toLowerCase() : null, message: String(e.message) })),
  };
}

/** True when no answer reached the browser (network / timeout / gateway) — the only case a create may reuse its key. */
export function isNoAnswerError(e: DemoApiError): boolean {
  return e.status === 0 || e.status === 502 || e.status === 504;
}

/** The text to show for an error: our own translation per code, else the server message. */
export function demoErrorMessage(e: DemoApiError, translate: TranslateService): string {
  if (e.code === 'PIN_TOO_WEAK') return translate.instant('d3.demoAccounts.validation.pin');
  if (e.code && KNOWN_CODES.has(e.code)) return translate.instant(`d3.demoAccounts.errors.${e.code}`);
  if (e.status === 403) return translate.instant('d3.demoAccounts.errors.forbidden');
  if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) return e.fieldErrors.map(f => f.message).join(' - ');
  if ((!e.code && (e.status === 0 || e.status >= 500)) || e.code === 'INTERNAL_ERROR') {
    return translate.instant('d3.demoAccounts.errors.unexpected');
  }
  return e.message || translate.instant('d3.demoAccounts.errors.unexpected');
}

// ── Dates (§1) ──────────────────────────────────────────────────────────
// API dates are UTC (often without an offset); they are always shown in Riyadh time
// as 18/11/2026 or 18/11/2026 12:00 م.

const RIYADH_TZ = 'Asia/Riyadh';

function riyadhParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  return parts.reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
}

export function formatRiyadhDate(value: string | Date | null | undefined, lang: string, withTime = false): string | null {
  const date = value instanceof Date ? value : parseApiUtc(value);
  if (!date) return null;
  const p = riyadhParts(date);
  const day = `${p['day']}/${p['month']}/${p['year']}`;
  if (!withTime) return day;
  const pm = (p['dayPeriod'] ?? '').toLowerCase().startsWith('p');
  const period = lang === 'en' ? (pm ? 'PM' : 'AM') : (pm ? 'م' : 'ص');
  return `${day} ${p['hour']}:${p['minute']} ${period}`;
}

/** A fresh Idempotency-Key — crypto.randomUUID() needs a secure context, so fall back on plain http. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
