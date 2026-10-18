import { AdminAuditStatus, AdminOperationAuditItem } from '../../../../interfaces/operation-audit.model';

const ACTION_ICONS: Record<string, string> = {
  UserRoleAssigned: 'shield-plus',
  UserRoleRemoved: 'shield-minus',
  EmployeeEnrolled: 'user-plus',
  EmployeeActivated: 'user-check',
  EmployeeDeactivated: 'user-off',
  EmployeeDeleted: 'user-x',
  BookingCancelled: 'calendar-x',
  BookingUnitChanged: 'arrows-exchange',
  SettlementExecuted: 'cash',
  SettlementHeld: 'player-pause',
  SettlementFailed: 'alert-triangle',
  SettlementRetried: 'refresh',
  SubscriptionOrderApproved: 'circle-check',
  SubscriptionOrderRejected: 'circle-x',
  WalletBalanceAdjusted: 'wallet',
  WalletLedgerEntryUpdated: 'receipt'
};

// Unknown (future) action codes get a neutral icon.
export function auditActionIcon(actionCode: string): string {
  return ACTION_ICONS[actionCode] ?? 'activity';
}

export function auditStatusClass(status: AdminAuditStatus): 'completed' | 'failed' | 'denied' {
  if (status === 'Succeeded') return 'completed';
  if (status === 'Denied') return 'denied';
  return 'failed';
}

export function auditStatusKey(status: AdminAuditStatus): string {
  return `d3.teamManagement.opsLog.status.${status}`;
}

export function auditDepartmentName(item: AdminOperationAuditItem): string | null {
  return item.affectedDepartmentName ?? item.actorDepartments[0]?.name ?? null;
}

export function auditInitials(name: string): string {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('');
}

export function formatAuditDate(value: string, lang: string): { date: string; time: string } {
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: value, time: '' };

  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
  return {
    date: d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  };
}

/**
 * Maps an audited entity to a page in this admin app (relative to /:lang/d3).
 * Only MerchantAccount has a per-entity page; the others open their list page.
 * Returns null when there is nowhere sensible to go.
 */
export function auditEntityRoute(item: AdminOperationAuditItem): string[] | null {
  const routes: Record<string, (id: string | null) => string[] | null> = {
    MerchantAccount: id => (id ? ['wallet', id] : null),
    Booking: () => ['bookings'],
    Settlement: () => ['settlements'],
    SubscriptionOrder: () => ['subscriptions', 'requests']
  };

  return routes[item.entityType]?.(item.entityId) ?? null;
}
