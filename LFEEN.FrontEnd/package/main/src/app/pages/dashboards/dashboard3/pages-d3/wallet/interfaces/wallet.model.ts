// Mirrors the /api/wallet/{merchantAccountId} payloads. `...Utc` timestamps are UTC
// but come without a trailing `Z` — always parse them with parseApiUtc().

export type WalletDirection = 'Credit' | 'Debit';

export type WalletEntryType =
  | 'AdminAdjustment'
  | 'CallCharge'
  | 'CallRefundAdjustment'
  | 'SubscriptionPayment'
  | 'TopUp'
  | (string & {});

export type WalletCategoryValue = 'Compensation' | 'Refund' | 'Penalty' | 'Correction' | 'Other';

export interface WalletCategory {
  value: WalletCategoryValue;
  nameAr: string;
  nameEn: string;
}

export interface WalletBalance {
  balance: number;
  currencyCode: string;
}

export interface WalletAttachment {
  id: string;
  fileName: string;
  url: string;
  contentType: string;
  /** Bytes. */
  size: number;
}

export interface WalletLedgerEntry {
  id: string;
  type: WalletEntryType;
  /** The sign source — `amount` is always positive. */
  direction: WalletDirection;
  amount: number;
  /** Historical snapshot at the time of the entry, not the current balance. */
  balanceBeforeOperation: number;
  balanceAfterOperation: number;
  description: string | null;
  category: WalletCategoryValue | null;
  categoryNameAr: string | null;
  categoryNameEn: string | null;
  attachments: WalletAttachment[];
  createdBy: string | null;
  createdAtUtc: string;
  updatedBy: string | null;
  updatedAtUtc: string | null;
}

export interface WalletAdjustInput {
  /** Signed: positive = credit, negative = debit. Cannot be 0. */
  amount: number;
  category: WalletCategoryValue;
  reason?: string;
  files: File[];
  /** One per confirm click; resent unchanged on a retry so the server applies it once. */
  idempotencyKey: string;
}

/**
 * Two shapes: applied right away (`ledgerEntryId` + `newBalance`), or — when the amount
 * is above the approval threshold — held for a second admin (`pendingApprovalId` only).
 */
export interface WalletAdjustResult {
  newBalance?: number | null;
  ledgerEntryId?: string | null;
  pendingApprovalId?: string | null;
}

export function isPendingApproval(res: WalletAdjustResult | null | undefined): boolean {
  return !!res?.pendingApprovalId && !res.ledgerEntryId;
}

/** A row of GET /api/wallet/adjustments/pending. Optional fields are shown only when sent. */
export interface WalletPendingAdjustment {
  id: string;
  merchantAccountId: string;
  merchantName?: string | null;
  /** Signed: positive = credit, negative = debit. */
  amount: number;
  category?: WalletCategoryValue | null;
  categoryNameAr?: string | null;
  categoryNameEn?: string | null;
  reason?: string | null;
  requestedBy?: string | null;
  requestedByAdminName?: string | null;
  requestedAtUtc?: string | null;
  createdAtUtc?: string | null;
  attachments?: WalletAttachment[] | null;
}

export interface WalletUpdateEntryInput {
  /** undefined = unchanged, '' = clear the description. */
  reason?: string;
  category?: WalletCategoryValue;
  newFiles?: File[];
  removedAttachmentIds?: string[];
}

export const MANUAL_ENTRY_TYPE = 'AdminAdjustment';

/**
 * Permission for the maker-checker queue. The backend name isn't confirmed yet, so any
 * of these (lowercased) grants it — trim the list once it is.
 */
export const WALLET_APPROVE_PERMISSIONS: readonly string[] = [
  'wallet.approve',
  'wallet.approveadjustment',
  'wallet.approveadjustments',
];

export function canApproveWalletAdjustments(permissions: readonly string[]): boolean {
  return permissions.some(p => WALLET_APPROVE_PERMISSIONS.includes(p.toLowerCase()));
}

export const WALLET_MAX_ATTACHMENTS = 5;
export const WALLET_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const WALLET_ALLOWED_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

/**
 * The server doesn't tie a category to a sign (it would accept a positive "Penalty"),
 * so the UI steers the admin: these categories force the direction, the others are free.
 */
export const CATEGORY_FORCED_DIRECTION: Partial<Record<WalletCategoryValue, WalletDirection>> = {
  Compensation: 'Credit',
  Refund: 'Credit',
  Penalty: 'Debit',
};

/** Categories whose description says the most — the reason is mandatory in the UI. */
export const CATEGORIES_REQUIRING_REASON: readonly WalletCategoryValue[] = ['Other', 'Correction'];
