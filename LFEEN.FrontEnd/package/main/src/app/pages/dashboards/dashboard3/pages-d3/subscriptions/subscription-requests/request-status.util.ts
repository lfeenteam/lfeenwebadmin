export type OrderStatusKind = 'pending' | 'succeeded' | 'failed' | 'other';

const KIND_BY_STATUS: Record<string, OrderStatusKind> = {
  pending: 'pending',
  succeeded: 'succeeded',
  failed: 'failed',
};

/** Drives tab filtering, badge color and the label: known kinds use the tab translations. */
export function orderStatusKind(status: string | null | undefined): OrderStatusKind {
  return KIND_BY_STATUS[(status ?? '').toLowerCase()] ?? 'other';
}
