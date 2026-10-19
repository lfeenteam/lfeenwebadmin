export type OrderStatusKind = 'pending' | 'succeeded' | 'failed' | 'other';

const KIND_BY_STATUS: Record<string, OrderStatusKind> = {
  pending: 'pending',
  succeeded: 'succeeded',
  failed: 'failed',
};

/** Only drives tab filtering and badge color — the label always comes from statusLabel. */
export function orderStatusKind(status: string | null | undefined): OrderStatusKind {
  return KIND_BY_STATUS[(status ?? '').toLowerCase()] ?? 'other';
}
