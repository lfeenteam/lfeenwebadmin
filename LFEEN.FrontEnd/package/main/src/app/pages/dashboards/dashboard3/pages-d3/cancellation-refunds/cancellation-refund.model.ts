import { LoginService } from '../../services/login/login.service';

/**
 * Why the job stalled. Only GATEWAY_ERROR, UNKNOWN and null can be fixed by a retry; the
 * others need the money refunded outside the system and the case closed with mark-resolved.
 */
export type CancellationRefundFailureCode =
  | 'MANUAL_REFUND_REQUIRED'
  | 'GATEWAY_ERROR'
  | 'MAX_ATTEMPTS_REACHED'
  | 'REQUIRES_MANUAL_REVIEW'
  | 'UNKNOWN';

/**
 * A guest-cancellation refund job that failed 6 times (~7.3h) and stopped in ManualReview.
 * The list only ever holds ManualReview jobs, oldest first.
 */
export interface CancellationRefund {
  id: number;
  bookingId: string;
  accountId: string;
  bookingNumber: string | null;
  propertyId: number | null;
  /** Localized per Accept-Language. */
  propertyName: string | null;
  unitId: number | null;
  unitNumber: string | null;
  guestName: string | null;
  /** Computed live from the booking's financials, not a stored snapshot. */
  amount: number;
  currencyCode: string | null;
  attempts: number;
  /** Raw, untranslated — for support only; show failureReason instead. */
  lastError: string | null;
  failureReasonCode: CancellationRefundFailureCode | string | null;
  /** Localized per Accept-Language. */
  failureReason: string | null;
  createdAtUtc: string;
  lastAttemptAtUtc: string | null;
  resolvedAt?: string | null;
  resolvedByAdminId?: string | null;
  resolvedByAdminName?: string | null;
  resolutionNote?: string | null;
}

export interface CancellationRefundListResponse {
  items: CancellationRefund[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

/** POST .../{id}/mark-resolved — after the money was refunded outside the system. The admin comes from the token. */
export interface CancellationRefundResolveRequest {
  refundedAmount: number;
  referenceNumber?: string;
  note?: string;
}

export const RESOLVE_REFERENCE_MAX_LENGTH = 100;
export const RESOLVE_NOTE_MAX_LENGTH = 1000;

/** Codes a retry can never fix — only "mark resolved" closes them. */
const NOT_RETRYABLE_CODES = new Set(['MANUAL_REFUND_REQUIRED', 'MAX_ATTEMPTS_REACHED', 'REQUIRES_MANUAL_REVIEW']);

export function isRetryable(row: CancellationRefund): boolean {
  return !NOT_RETRYABLE_CODES.has((row.failureReasonCode ?? '').toUpperCase());
}

/** CancellationRefunds.* permissions, lower-cased like the rest of the login permission checks. */
export const CANCELLATION_REFUND_PERMISSIONS = {
  view: 'cancellationrefunds.view',
  manage: 'cancellationrefunds.manage',
} as const;

export function hasCancellationRefundPermission(login: LoginService, permission: string): boolean {
  const perms = login.permissions().map(p => p.toLowerCase());
  // Manage is useless without seeing the list, so it implies View.
  if (permission === CANCELLATION_REFUND_PERMISSIONS.view && perms.includes(CANCELLATION_REFUND_PERMISSIONS.manage)) return true;
  return perms.includes(permission);
}
