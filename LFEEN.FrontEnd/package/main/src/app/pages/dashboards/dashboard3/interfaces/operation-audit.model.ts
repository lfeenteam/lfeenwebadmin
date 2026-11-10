export type AdminAuditStatus = 'Succeeded' | 'Failed' | 'Denied';

export const ADMIN_AUDIT_STATUSES: AdminAuditStatus[] = ['Succeeded', 'Failed', 'Denied'];

export interface AdminAuditActionGroup {
  /** i18n key under d3.teamManagement.opsLog.actionGroups */
  key: string;
  codes: readonly string[];
}

// Action codes audited by the API today, grouped for the action-type filter.
// New codes can appear at any time, so UI code must always fall back to the
// server-provided actionText.
export const ADMIN_AUDIT_ACTION_GROUPS: readonly AdminAuditActionGroup[] = [
  {
    key: 'employees',
    codes: ['UserRoleAssigned', 'UserRoleRemoved', 'EmployeeEnrolled', 'EmployeeActivated', 'EmployeeDeactivated', 'EmployeeDeleted']
  },
  { key: 'bookings', codes: ['BookingCancelled', 'BookingUnitChanged'] },
  { key: 'settlements', codes: ['SettlementExecuted', 'SettlementHeld', 'SettlementFailed', 'SettlementRetried'] },
  { key: 'subscriptions', codes: ['SubscriptionOrderApproved', 'SubscriptionOrderRejected'] },
  { key: 'wallets', codes: ['WalletBalanceAdjusted', 'WalletLedgerEntryUpdated'] },
  { key: 'units', codes: ['UnitBanned', 'UnitUnbanned', 'UnitApproved', 'UnitRejected', 'UnitBanReasonUpdated'] },
  {
    key: 'properties',
    codes: ['PropertyBanned', 'PropertyUnbanned', 'PropertyApproved', 'PropertyRejected', 'PropertyBanReasonUpdated']
  },
  { key: 'complaints', codes: ['ComplaintCreated', 'ComplaintAssigned', 'ComplaintStatusUpdated', 'ComplaintNoteAdded'] },
  {
    key: 'clientTickets',
    codes: [
      'ClientTicketAssigned',
      'ClientTicketClaimed',
      'ClientTicketMessageSent',
      'ClientTicketPriorityUpdated',
      'ClientTicketStatusUpdated'
    ]
  },
  { key: 'merchantTickets', codes: ['TicketReplyAdded', 'TicketAssigned', 'TicketPriorityUpdated', 'TicketStatusUpdated'] },
  {
    key: 'platformOffers',
    codes: [
      'PlatformOfferCreated',
      'PlatformOfferUpdated',
      'PlatformOfferActivated',
      'PlatformOfferDeactivated',
      'PlatformOfferDeleted',
      'PlatformOfferExclusionPeriodAdded',
      'PlatformOfferExclusionPeriodDeleted',
      'PlatformOfferTermAdded',
      'PlatformOfferTermDeleted',
      'PlatformOfferUnitAdded',
      'PlatformOfferUnitDeleted',
      'PlatformOfferMessageUpserted',
      'PlatformOfferMessageDeleted'
    ]
  },
  { key: 'callScripts', codes: ['IvrCallScriptCreated', 'IvrCallScriptUpdated'] },
  {
    key: 'clientFaq',
    codes: ['ClientFaqCreated', 'ClientFaqUpdated', 'ClientFaqActivated', 'ClientFaqDeactivated', 'ClientFaqDeleted']
  },
  { key: 'platformSettings', codes: ['ReviewRewardSettingsUpdated'] }
];

export type AuditDatePreset = 'today' | 'week' | 'month';

/** What the filter bar shows as selected; '' means "all". */
export interface AuditFilterSelection {
  search: string;
  actionCode: string;
  departmentId: string;
  status: string;
  datePreset: AuditDatePreset | '';
}

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
  /** Counts for the summary cards; ignores paging. */
  summary?: AdminOperationAuditSummary;
}

/** Raw `summary` object as returned by GET /api/operation-audits. */
export interface AdminOperationAuditSummary {
  totalOperations: number | null;
  successfulOperations: number | null;
  failedOperations: number | null;
  deniedOperations: number | null;
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
