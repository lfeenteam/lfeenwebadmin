// Guest review moderation — admin queue of reported BookingReview comments.
// GET api/bookings/reviews/reports returns a bare array (no { data } envelope);
// approve/reject return a bare `true`.

/** Which of the review's three independent comments a report targets. Sent/received as-is. */
export type ReviewTargetField = 'Unit' | 'Host' | 'App';

/** One queue row = one reported comment (grouped server-side, never one row per report). */
export interface ReviewReportItem {
  bookingReviewId: number;
  reviewExternalId: string;
  targetField: ReviewTargetField;
  /** Always the real text, even when already auto-hidden from the public. */
  commentText: string;
  reportCount: number;
  /** true once the auto-hide threshold (5) was reached — the comment is hidden publicly. */
  isHighPriority: boolean;
  /** Optional reporter reasons in report order; may repeat and may be shorter than reportCount. */
  reasons: string[];
  firstReportedAt: string;
  lastReportedAt: string;
}

export interface ApproveReviewReportRequest {
  blockedWord: string;
}

/** Bookings.* permissions, lower-cased like the rest of the login permission checks. */
export const BOOKING_REVIEW_PERMISSIONS = {
  /** GET /reviews/reports */
  view: 'bookings.view',
  /** approve / reject */
  moderate: 'bookings.update',
} as const;

/**
 * Enforced only once the login response carries Bookings.* permissions — it doesn't yet
 * on every environment. Until then nothing is hidden here; the API still answers 403.
 */
export function hasBookingPermission(permissions: string[], permission: string): boolean {
  const lower = permissions.map(p => p.toLowerCase());
  if (!lower.some(p => p.startsWith('bookings.'))) return true;
  return lower.includes(permission);
}

export const REVIEW_TARGET_FIELD_LABEL_KEY: Record<ReviewTargetField, string> = {
  Unit: 'd3.bookings.reviewReports.target.unit',
  Host: 'd3.bookings.reviewReports.target.host',
  App:  'd3.bookings.reviewReports.target.app',
};

export const REVIEW_TARGET_FIELD_ICON: Record<ReviewTargetField, string> = {
  Unit: 'home',
  Host: 'user',
  App:  'device-mobile',
};

/**
 * Two error shapes reach the client: a proxied business-rule rejection
 * ({ errorCode, message }) and the proxy's own request validation
 * ({ errors: [{ field, message }] }). Branch on errorCode, never on message.
 */
export function reviewReportErrorCode(err: any): string | null {
  return typeof err?.error?.errorCode === 'string' ? err.error.errorCode : null;
}

/**
 * BOOKING_REVIEW_REPORT_NOT_FOUND (already actioned elsewhere) or BOOKING_REVIEW_NOT_FOUND:
 * either way the queue row is stale and should just be dropped.
 */
export function isReviewReportGone(err: any): boolean {
  return reviewReportErrorCode(err)?.endsWith('_NOT_FOUND') ?? false;
}

/** A displayable message from either error shape, or null to fall back to a generic toast. */
export function reviewReportErrorMessage(err: any): string | null {
  const body = err?.error;
  const first = Array.isArray(body?.errors) ? body.errors.find((e: any) => e?.message)?.message : null;
  return first || (typeof body?.message === 'string' && body.message.trim() ? body.message : null);
}

export function reviewReportKey(item: Pick<ReviewReportItem, 'bookingReviewId' | 'targetField'>): string {
  return `${item.bookingReviewId}:${item.targetField}`;
}
