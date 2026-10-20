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

// Not "completed": the global todo styles strike that class through.
export function auditStatusClass(status: AdminAuditStatus): 'succeeded' | 'failed' | 'denied' {
  if (status === 'Succeeded') return 'succeeded';
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

/** Strips the IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4). */
export function formatAuditIp(ip: string | null): string | null {
  return ip ? ip.replace(/^::ffff:/i, '') : null;
}

/** Short, human summary of a user agent, e.g. "Chrome 154 · Android 16". */
export function summarizeUserAgent(ua: string | null): string | null {
  if (!ua) return null;

  const browser =
    match(ua, /Edg\/(\d+)/, 'Edge') ??
    match(ua, /OPR\/(\d+)/, 'Opera') ??
    match(ua, /Firefox\/(\d+)/, 'Firefox') ??
    match(ua, /Chrome\/(\d+)/, 'Chrome') ??
    match(ua, /Version\/(\d+).*Safari/, 'Safari') ??
    match(ua, /PostmanRuntime\/(\d+)/, 'Postman');

  const os =
    match(ua, /Android (\d+)/, 'Android') ??
    match(ua, /iPhone OS (\d+)/, 'iOS') ??
    match(ua, /Windows NT (\d+)/, 'Windows') ??
    (/Mac OS X/.test(ua) ? 'macOS' : null) ??
    (/Linux/.test(ua) ? 'Linux' : null);

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function match(ua: string, re: RegExp, name: string): string | null {
  const m = ua.match(re);
  return m ? `${name} ${m[1]}` : null;
}

/** transferredAmount → "Transferred amount" (fallback for metadata keys without a translation). */
export function humanizeKey(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
