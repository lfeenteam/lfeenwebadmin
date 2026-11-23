// Mirrors the /api/settlements payloads. Any `...Utc` timestamp is UTC but comes
// without a trailing `Z` — always parse it with parseApiUtc().

export type SettlementStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'PartiallyCompleted'
  | 'Failed'
  | 'OnHold'
  | (string & {});

export interface Settlement {
  id: string;
  accountId: string;
  merchantName: string | null;
  payoutReference: string;
  bankTransferReference: string | null;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currencyCode: string;
  status: SettlementStatus;
  periodStartUtc: string;
  periodEndUtc: string;
  /** Always null in the list response — only the detail endpoint returns it. */
  notes: string | null;
  createdAtUtc: string;
  processedAtUtc: string | null;
  completedAtUtc: string | null;
  lastActionByAdminUserId: string | null;
  lastActionByAdminName: string | null;
  lastActionAtUtc: string | null;
  transferredAmount: number | null;
  partialSettlementReason: string | null;
  originatingPayoutId: string | null;
  receiptUrl: string | null;
  receiptUploadedAtUtc: string | null;
}

export interface SettlementList {
  items: Settlement[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  summary?: SettlementSummary | null;
}

/** Overview figures for the stats cards — returned with every list page. */
export interface SettlementSummary {
  oldestOutstandingPayoutAgeHours: number | null;
  averageNetAmount: number | null;
  totalPendingAmount: number | null;
  currencyCode: string | null;
}

export interface SettlementListResult {
  items: Settlement[];
  summary: SettlementSummary | null;
}

export interface SettlementBank {
  iban: string | null;
  beneficiaryName: string | null;
  bankName: string | null;
  swiftCode: string | null;
}

export interface SettlementEntry {
  id: string;
  bookingPaymentId: string;
  bookingNumber: string | null;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currencyCode: string;
  /** The booking was refunded after its payout was settled — the line claws that amount back (BUG-1482). */
  isRefundAfterSettlement?: boolean;
}

export interface SettlementDetail extends Settlement {
  /** Detail endpoint only — the list response doesn't carry it. */
  hostName: string | null;
  bank: SettlementBank | null;
  bankInfoStatus: string | null;
  contactPhoneNumber: string | null;
  entries: SettlementEntry[];
}

/** Response of execute / fail / retry / receipt — has no `id` and no `netAmount`. */
export interface SettlementActionResult {
  payoutReference: string;
  status: SettlementStatus;
  bankTransferReference: string | null;
  notes: string | null;
  processedAtUtc: string | null;
  completedAtUtc: string | null;
  lastActionByAdminUserId: string | null;
  lastActionByAdminName: string | null;
  lastActionAtUtc: string | null;
  transferredAmount: number | null;
  partialSettlementReason: string | null;
  originatingPayoutId: string | null;
  receiptUrl: string | null;
  receiptUploadedAtUtc: string | null;
}

export interface ExecuteSettlementRequest {
  bankTransferReference: string;
  /** bank.iban exactly as GET /api/settlements/{id} returned it — the backend 409s if it no longer matches. */
  confirmedIban: string;
  transferredAmount?: number;
  partialReason?: string;
  note?: string;
}

// ── Recalculation (BUG-1482) ──────────────────────────────────
// A refund that lands after a payout was settled is deducted from the next payout;
// the affected payout has to be recalculated before it can be executed.

export type RecalculationAdjustmentKind = 'RefundAfterPayout' | 'RefundAfterSettlement' | (string & {});

export interface RecalculationAdjustment {
  kind: RecalculationAdjustmentKind;
  /** The payout line this adjusts; null = the recalculation adds a new line. */
  entryId?: string | null;
  bookingNumber?: string | null;
  bookingPaymentId?: string | null;
  oldGross?: number | null;
  oldFee?: number | null;
  oldNet?: number | null;
  newGross?: number | null;
  newFee?: number | null;
  newNet?: number | null;
}

/** GET {id}/recalculation (dry run, saves nothing) and POST {id}/recalculate share this shape. */
export interface PayoutRecalculation {
  payoutReference: string;
  status: SettlementStatus;
  oldGross: number;
  oldFee: number;
  oldNet: number;
  newGross: number;
  newFee: number;
  newNet: number;
  adjustments: RecalculationAdjustment[];
  /** Non-empty = the recalculation can't be applied yet (a plain reason, a code, or both). */
  blockers: RecalculationBlocker[];
  applied: boolean;
  hasChanges: boolean;
}

export type RecalculationBlocker = string | { message?: string | null; code?: string | null };

/**
 * One payout returned by GET recalculation-preview. When the item carries its dry-run
 * result (hasChanges / blockers) the list can tell "needs recalculation" from "on hold".
 */
export interface RecalculationPreviewItem {
  payoutId?: string | null;
  id?: string | null;
  payoutReference?: string | null;
  hasChanges?: boolean | null;
  blockers?: RecalculationBlocker[] | null;
}

/**
 * What a payout listed by recalculation-preview actually needs, from its dry run (guide §4.1):
 * - `needed`  — totals change: recalculate before executing ("Needs recalculation"). Blockers,
 *               if any, are shown in the dialog and lock Apply.
 * - `onHold`  — blockers and nothing to change: a refund on one of its bookings is still
 *               running ("Refund in progress") — wait, recalculating won't help.
 * - `none`    — nothing changes and nothing blocks: execute as normal.
 */
export type RecalculationState = 'needed' | 'onHold' | 'none';

export function recalculationStateOf(result: { hasChanges?: boolean | null; blockers?: RecalculationBlocker[] | null }): RecalculationState {
  const blocked = (result.blockers ?? []).some(b => !!(typeof b === 'string' ? b.trim() : (b?.message || b?.code)));
  if (result.hasChanges === true) return 'needed';
  if (blocked) return 'onHold';
  return result.hasChanges === false ? 'none' : 'needed';
}

// ── Merchant debts ───────────────────────────────────────────

/**
 * One refund behind a merchant's debt. The core answers with method / gross / fee / net /
 * refundedAtUtc; the other fields are read when present.
 */
export interface MerchantDebtLine {
  /** Payment method of the refunded booking payment. */
  method?: string | null;
  grossAmount?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
  refundedAtUtc?: string | null;
  kind?: string | null;
  bookingNumber?: string | null;
  payoutReference?: string | null;
  amount?: number | null;
  description?: string | null;
  createdAtUtc?: string | null;
  occurredAtUtc?: string | null;
  [key: string]: unknown;
}

export interface MerchantDebt {
  accountId: string;
  /** Not sent by the core yet — the accountId is shown until it is. */
  merchantName?: string | null;
  tradeName?: string | null;
  /** Owed BY the merchant (refunds clawed back after they were paid). */
  outstandingClawbackNet: number;
  /** Owed TO the merchant (not settled yet). */
  unsettledDuesNet: number;
  balance: number;
  sinceUtc: string | null;
  /** true = the clawback exceeds what's still due — claim it ("Claim"); false = it will net off ("Alert"). */
  isClaim: boolean;
  currencyCode?: string | null;
  lines: MerchantDebtLine[];
}

/** errorCodes execute (and retry) answer with when a payout is blocked by BUG-1482 rules. */
export const PAYOUT_BLOCK_CODES = {
  needsRecalculation: 'PAYOUT_NEEDS_RECALCULATION',
  refundInProgress: 'PAYOUT_REFUND_IN_PROGRESS',
  debtOutstanding: 'MERCHANT_SETTLEMENT_DEBT_OUTSTANDING',
} as const;

export type PayoutBlockKind = 'needsRecalculation' | 'refundInProgress' | 'debtOutstanding';

/** Statuses on which execute / fail are accepted by the backend. */
export const ACTIONABLE_STATUSES: readonly string[] = ['Pending', 'Processing'];

/**
 * Payouts not transferred yet — the only ones recalculation-preview covers and that can be
 * recalculated (guide §4.1 / §6.1). Processing payouts have left the bank and never need it.
 */
export const RECALCULABLE_STATUSES: readonly string[] = ['Pending', 'Failed', 'OnHold'];

/**
 * OnHold payouts are still owed to the merchant (and may need recalculating), so they belong
 * with the current ones. The list endpoint may not accept OnHold yet — that status is fetched
 * as optional and simply left out if refused.
 */
export const CURRENT_TAB_STATUSES: readonly string[] = ['Pending', 'Processing', 'OnHold'];
export const OPTIONAL_LIST_STATUSES: readonly string[] = ['OnHold'];
export const PREVIOUS_TAB_STATUSES: readonly string[] = ['Completed', 'PartiallyCompleted', 'Failed'];

// Receipt upload rules — the server doesn't enforce them, so the UI must.
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_ALLOWED_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'application/pdf'];
