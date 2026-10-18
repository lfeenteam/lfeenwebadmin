export type OrderStatusKind = 'underReview' | 'approved' | 'rejected' | 'other';

const KIND_BY_STATUS: Record<string, OrderStatusKind> = {
  underreview: 'underReview',
  approved: 'approved',
  rejected: 'rejected',
};

/** Only drives tab filtering, badge color and whether review actions show — the label always comes from statusLabel. */
export function orderStatusKind(status: string | null | undefined): OrderStatusKind {
  return KIND_BY_STATUS[(status ?? '').toLowerCase()] ?? 'other';
}
