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
  /** Non-empty = the recalculation can't be applied yet; each entry is a server-localized reason. */
  blockers: (string | { message?: string | null; code?: string | null })[];
  applied: boolean;
  hasChanges: boolean;
}

/** One payout returned by GET recalculation-preview. */
export interface RecalculationPreviewItem {
  payoutId?: string | null;
  id?: string | null;
  payoutReference?: string | null;
}

// ── Merchant debts ───────────────────────────────────────────

export interface MerchantDebtLine {
  kind?: string | null;
  bookingNumber?: string | null;
  payoutReference?: string | null;
  amount?: number | null;
  netAmount?: number | null;
  description?: string | null;
  createdAtUtc?: string | null;
  occurredAtUtc?: string | null;
  [key: string]: unknown;
}

export interface MerchantDebt {
  accountId: string;
  merchantName?: string | null;
  /** Owed BY the merchant (refunds clawed back after they were paid). */
  outstandingClawbackNet: number;
  /** Owed TO the merchant (not settled yet). */
  unsettledDuesNet: number;
  balance: number;
  sinceUtc: string | null;
  /** The clawback exceeds what's still due to the merchant — it has to be claimed from them. */
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

export const CURRENT_TAB_STATUSES: readonly string[] = ['Pending', 'Processing'];
export const PREVIOUS_TAB_STATUSES: readonly string[] = ['Completed', 'PartiallyCompleted', 'Failed'];

// Receipt upload rules — the server doesn't enforce them, so the UI must.
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_ALLOWED_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'application/pdf'];
