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
}

export interface SettlementDetail extends Settlement {
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
  transferredAmount?: number;
  partialReason?: string;
  note?: string;
}

/** Statuses on which execute / fail are accepted by the backend. */
export const ACTIONABLE_STATUSES: readonly string[] = ['Pending', 'Processing'];

export const CURRENT_TAB_STATUSES: readonly string[] = ['Pending', 'Processing'];
export const PREVIOUS_TAB_STATUSES: readonly string[] = ['Completed', 'PartiallyCompleted', 'Failed'];

// Receipt upload rules — the server doesn't enforce them, so the UI must.
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_ALLOWED_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'application/pdf'];
