export type AdminAuditStatus = 'Succeeded' | 'Failed' | 'Denied';

export const ADMIN_AUDIT_STATUSES: AdminAuditStatus[] = ['Succeeded', 'Failed', 'Denied'];

// Action codes audited by the API today. New codes can appear at any time,
// so UI code must always fall back to the server-provided actionText.
export const ADMIN_AUDIT_ACTION_CODES = [
  'UserRoleAssigned',
  'UserRoleRemoved',
  'EmployeeEnrolled',
  'EmployeeActivated',
  'EmployeeDeactivated',
  'EmployeeDeleted',
  'BookingCancelled',
  'BookingUnitChanged',
  'SettlementExecuted',
  'SettlementHeld',
  'SettlementFailed',
  'SettlementRetried',
  'SubscriptionOrderApproved',
  'SubscriptionOrderRejected',
  'WalletBalanceAdjusted',
  'WalletLedgerEntryUpdated'
] as const;

export type AuditDatePreset = 'today' | 'week' | 'month';

export interface AdminAuditSnapshot {
  id: string;
  name: string;
}

export interface AdminOperationAuditItem {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRoles: AdminAuditSnapshot[];
  actorDepartments: AdminAuditSnapshot[];
  actionCode: string;
  actionText: string;
  entityType: string;
  entityId: string | null;
  entityDisplayName: string | null;
  affectedDepartmentId: string | null;
  affectedDepartmentName: string | null;
  status: AdminAuditStatus;
  durationMilliseconds: number;
}

export interface AdminOperationAuditDetail extends AdminOperationAuditItem {
  metadata: Record<string, unknown> | null;
  errorCode: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  httpMethod: string | null;
  requestPath: string | null;
}

export interface AdminOperationAuditList {
  items: AdminOperationAuditItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Requested from the backend; counts ignore the status filter and paging. */
  stats?: AdminOperationAuditStats;
}

export interface AdminOperationAuditFilters {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  actorUserId?: string;
  departmentId?: string;
  actionCode?: string;
  entityType?: string;
  status?: AdminAuditStatus;
  search?: string;
}

export interface AdminOperationAuditStats {
  total: number;
  succeeded: number;
  failed: number;
  denied: number;
}
