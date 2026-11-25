export type OrderStatusKind = 'pending' | 'succeeded' | 'cancelled' | 'failed' | 'other';

// Cancelled = the merchant withdrew the order; Failed = the payment was declined or timed out.
const KIND_BY_STATUS: Record<string, OrderStatusKind> = {
  pending: 'pending',
  succeeded: 'succeeded',
  cancelled: 'cancelled',
  failed: 'failed',
};

/** Drives tab filtering, badge color and the label: known kinds use the tab translations. */
export function orderStatusKind(status: string | null | undefined): OrderStatusKind {
  return KIND_BY_STATUS[(status ?? '').toLowerCase()] ?? 'other';
}
