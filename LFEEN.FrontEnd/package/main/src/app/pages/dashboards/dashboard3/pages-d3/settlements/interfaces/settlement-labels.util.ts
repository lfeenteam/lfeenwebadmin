import { TranslateService } from '@ngx-translate/core';
import { RecalculationBlocker } from './settlement.model';

const KIND_KEYS: Record<string, string> = {
  RefundAfterPayout: 'd3.settlements.recalc.kind.refundAfterPayout',
  RefundAfterSettlement: 'd3.settlements.recalc.kind.refundAfterSettlement',
};

/** Adjustment / debt line kind → label key; an unknown kind reads "Adjustment" rather than the raw value. */
export function adjustmentKindKey(kind: string | null | undefined): string {
  return KIND_KEYS[(kind ?? '').trim()] ?? 'd3.settlements.recalc.kind.adjustment';
}

/** Blocker codes we have our own wording for (the same rules execute refuses with). */
const BLOCKER_CODE_KEYS: Record<string, string> = {
  PAYOUT_REFUND_IN_PROGRESS: 'd3.settlements.errors.block.refundInProgress',
  MERCHANT_SETTLEMENT_DEBT_OUTSTANDING: 'd3.settlements.errors.block.debtOutstanding',
  PAYOUT_NEEDS_RECALCULATION: 'd3.settlements.errors.block.needsRecalculation',
};

const CODE_LIKE = /^[A-Z][A-Z0-9_]+$/;

/**
 * A blocker as the admin should read it: the server's message when it sent one; a known
 * code in our own words; an unknown code as a generic reason that still names the code.
 */
export function blockerText(blocker: RecalculationBlocker, translate: TranslateService): string {
  const raw = typeof blocker === 'string' ? { message: blocker, code: null } : blocker ?? {};
  let message = (raw.message ?? '').toString().trim();
  let code = (raw.code ?? '').toString().trim().toUpperCase();
  // A bare string that is really a code (e.g. "PAYOUT_REFUND_IN_PROGRESS").
  if (!code && CODE_LIKE.test(message)) {
    code = message;
    message = '';
  }
  if (code && BLOCKER_CODE_KEYS[code]) return translate.instant(BLOCKER_CODE_KEYS[code]);
  if (message) return message;
  return code ? translate.instant('d3.settlements.recalc.blockerUnknown', { code }) : '';
}

export function blockerTexts(blockers: RecalculationBlocker[] | null | undefined, translate: TranslateService): string[] {
  return (blockers ?? []).map(b => blockerText(b, translate)).filter(Boolean);
}

const PAYMENT_METHOD_KEYS: Record<string, string> = {
  banktransfer: 'd3.settlements.paymentMethods.bankTransfer',
  mada: 'd3.settlements.paymentMethods.mada',
  card: 'd3.settlements.paymentMethods.card',
  creditcard: 'd3.settlements.paymentMethods.card',
  applepay: 'd3.settlements.paymentMethods.applePay',
  stcpay: 'd3.settlements.paymentMethods.stcPay',
  wallet: 'd3.settlements.paymentMethods.wallet',
  tabby: 'd3.settlements.paymentMethods.tabby',
  tamara: 'd3.settlements.paymentMethods.tamara',
};

/** Payment method → label key, or null to show the server value as-is. */
export function paymentMethodKey(method: string | null | undefined): string | null {
  const normalized = (method ?? '').replace(/[\s_-]/g, '').toLowerCase();
  return PAYMENT_METHOD_KEYS[normalized] ?? null;
}
