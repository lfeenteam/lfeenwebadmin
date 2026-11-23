// Shared by properties and units: both expose the same ban/unban endpoints and response shape.
export type ListingKind = 'property' | 'unit';
export type BanDialogMode = 'ban' | 'editReason' | 'unban';

export interface BanRequest {
  // 1..1000 chars, not whitespace-only.
  reason: string;
}

export interface ListingBanResult {
  id: number;
  // 'Banned' after ban/update, 'UnderReview' after unban.
  status: string;
  banReason: string | null;
  // UTC without the trailing Z — use parseApiUtc before displaying.
  bannedAt: string | null;
  // Always null for units.
  affectedUnitsCount: number | null;
  cancelledBookingsCount: number;
}

export const BAN_REASON_MAX_LENGTH = 1000;

export type BanAction = 'Ban' | 'UpdateReason' | 'Unban';

export interface BanHistoryItem {
  action: BanAction;
  // null for Unban.
  reason: string | null;
  adminId: string | null;
  adminName: string | null;
  // Unit history only: set when the action came from the parent property's ban.
  triggeredByPropertyId: number | null;
  createdAt: string;
}

// Unlike the list endpoints there's no totalPages/nextpage — derive it from totalCount.
export interface BanHistoryResponse {
  items: BanHistoryItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

// ── Ban refunds (/api/listing-ban-refunds) ─────────────────────────────────

export type RefundStatus = 'Pending' | 'Succeeded' | 'ManualReview' | 'Resolved';

export type RefundFailureReasonCode = 'GATEWAY_ERROR' | 'REQUIRES_MANUAL_REVIEW' | 'MAX_ATTEMPTS_REACHED' | 'UNKNOWN';

export interface ListingBanRefund {
  id: number;
  bookingId: string;
  bookingNumber: string | null;
  propertyId: number | null;
  unitId: number | null;
  // Display names, localized by Accept-Language. Null when the building/unit was deleted — fall back to the ids.
  propertyName?: string | null;
  unitNumber?: string | null;
  guestName: string | null;
  // What's still owed out of what was actually paid — not the booking total.
  // 0 on legacy rows for unpaid bookings (no longer created); those are "nothing to refund", not "refunded".
  amount: number;
  currencyCode: string | null;
  attempts: number;
  // Raw gateway message; shown under "Technical details" so the admin can decide between retry and manual handling.
  lastError: string | null;
  // Stable code for the last failure — map on this, not on the text.
  failureReasonCode: RefundFailureReasonCode | string | null;
  // The same failure, localized by the backend (Accept-Language) — safe to show inline.
  failureReason: string | null;
  status: RefundStatus;
  createdAt: string;
  lastAttemptAt: string | null;
  // Only set while Pending and waiting for a retry.
  nextAttemptAt: string | null;
  resolvedAt: string | null;
  resolvedByAdminId: string | null;
  resolvedByAdminName: string | null;
  resolutionNote: string | null;
}

export interface RefundListResponse {
  items: ListingBanRefund[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export const REFUND_NOTE_MAX_LENGTH = 1000;

// Review statuses a listing can be banned from; anything else returns CANNOT_BAN_IN_CURRENT_STATUS.
export const BANNABLE_STATUSES = ['Approved', 'HasPendingChanges', 'UnderReview'] as const;
