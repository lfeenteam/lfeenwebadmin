import { RecalculationBlocker } from './settlement.model';

const KIND_KEYS: Record<string, string> = {
  RefundAfterPayout: 'd3.settlements.recalc.kind.refundAfterPayout',
  RefundAfterSettlement: 'd3.settlements.recalc.kind.refundAfterSettlement',
};

/** Debt lines carry no kind: every one of them is a refund that landed after its payout was settled. */
export const DEBT_LINE_KIND_KEY = KIND_KEYS['RefundAfterSettlement'];

/** Adjustment / debt line kind → label key; an unknown kind reads "Adjustment" rather than the raw value. */
export function adjustmentKindKey(kind: string | null | undefined): string {
  return KIND_KEYS[(kind ?? '').trim()] ?? 'd3.settlements.recalc.kind.adjustment';
}

/**
 * Blockers are technical English texts from the core (a refund on one of the payout's bookings
 * hasn't finished). The admin is shown one fixed, localized summary
 * (`d3.settlements.recalc.blockerSummary`); these raw texts only go under a collapsed "Details".
 */
export function rawBlockerTexts(blockers: RecalculationBlocker[] | null | undefined): string[] {
  return (blockers ?? [])
    .map(b => (typeof b === 'string' ? b : [b?.code, b?.message].filter(Boolean).join(': ')))
    .map(b => (b ?? '').toString().trim())
    .filter(Boolean);
}

const STATUS_KEYS: Record<string, string> = {
  Pending: 'pending',
  Processing: 'processing',
  Completed: 'approved',
  PartiallyCompleted: 'partiallyCompleted',
  Failed: 'rejected',
  OnHold: 'onHold',
};

/** Payout status → label key, or null to show the server value as-is. */
export function settlementStatusKey(status: string | null | undefined): string | null {
  const key = STATUS_KEYS[(status ?? '').trim()];
  return key ? `d3.settlements.status.${key}` : null;
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
  visa: 'd3.settlements.paymentMethods.visa',
  mastercard: 'd3.settlements.paymentMethods.mastercard',
  gatewayonline: 'd3.settlements.paymentMethods.gatewayOnline',
};

/** Payment method → label key, or null to show the server value as-is. */
export function paymentMethodKey(method: string | null | undefined): string | null {
  const normalized = (method ?? '').replace(/[\s_-]/g, '').toLowerCase();
  return PAYMENT_METHOD_KEYS[normalized] ?? null;
}
