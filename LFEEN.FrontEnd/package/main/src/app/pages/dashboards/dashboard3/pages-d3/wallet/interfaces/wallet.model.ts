// Mirrors the /api/wallet/{merchantAccountId} payloads. `createdAtUtc` comes with
// a trailing `Z` already, but parseApiUtc() handles both cases so it's used anyway.

export type WalletLedgerEntryType =
  | 'TopUp'
  | 'CallCharge'
  | 'CallRefundAdjustment'
  | 'AdminAdjustment'
  | (string & {});

export interface WalletBalance {
  balance: number;
  currencyCode: string;
}

export interface WalletLedgerEntry {
  id: string;
  type: WalletLedgerEntryType;
  /** Signed: positive = credit, negative = debit. */
  amount: number;
  balanceBeforeOperation: number;
  balanceAfterOperation: number;
  description: string | null;
  createdAtUtc: string;
}

export interface WalletAdjustRequest {
  /** Signed: positive = credit, negative = debit. Cannot be 0. */
  amount: number;
  reason?: string;
}

export interface WalletAdjustResult {
  newBalance: number;
}
