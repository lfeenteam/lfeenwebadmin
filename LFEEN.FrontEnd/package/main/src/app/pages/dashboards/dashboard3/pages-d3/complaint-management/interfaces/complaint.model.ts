import { AR_LOCALE } from 'src/app/utils/locale-format.util';

export type ComplaintStatus ='new' | 'bot' | 'in_progress' | 'closed' | 'pending' | 'replied' | 'resolved';

/** Statuses where no agent has engaged yet ('bot' = still with the virtual assistant). */
export function isUnengagedStatus(status: ComplaintStatus): boolean {
  return status === 'new' || status === 'bot';
}

/** Arabic locale for the complaint screens — the admin-wide one (Gregorian, Latin digits). */
export const AR_DATE_LOCALE = AR_LOCALE;
export type ComplaintTab    = 'customers' | 'hosts' | 'resolved' | 'ratings';

export interface Ticket {
  externalId: string;
  ticketNumber: string;
  propertyId: number | null;
  propertyExternalId: string | null;
  propertyName: string | null;
  createdByName: string | null;
  subject: string;
  department: string;
  departmentName: string;
  status: string | number;
  statusName: string;
  priority: string;
  priorityName: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAtUtc: string | null;
  assignedAdminUserId: string | null;
  assignedAdminName: string | null;
  /** Requested from the backend — optional until the API sends them. */
  assignedAtUtc?: string | null;
  lastAgentReplyAtUtc?: string | null;
  /** BUG-2453: which app opened the ticket. Missing on older backends → treat as HostApp. */
  source?: TicketSource;
  /** Ready-to-show source label ("مضيف" / "عامل"). */
  sourceName?: string | null;
  /** True for tickets opened from the service (worker) app. Use this, not senderType —
   * worker messages come back as senderType "Merchant" on purpose. */
  isFromWorker?: boolean;
}

/** GET /api/tickets `source`: the app the ticket was opened from. */
export type TicketSource = 'HostApp' | 'ServiceApp';

export interface TicketListResponse {
  data: Ticket[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
  stats: null;
}

export interface TicketQueryParams {
  propertyId?: number;
  assignedAdminUserId?: string;
  // GET /api/tickets: status/priority take numeric codes as strings ('1','2'…),
  // department takes the enum name ('General'…). All sent verbatim.
  status?: string;
  department?: string;
  priority?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  /** ServiceApp = worker tickets only, HostApp = host tickets only, omitted = all. */
  source?: TicketSource;
  page?: number;
  pageSize?: number;
}

export const HOST_TICKETS_PAGE_SIZE = 20;

export const HOST_TICKET_SOURCE_OPTIONS: { value: TicketSource; labelKey: string }[] = [
  { value: 'HostApp', labelKey: 'd3.complaints.hostFilters.source.host' },
  { value: 'ServiceApp', labelKey: 'd3.complaints.hostFilters.source.worker' },
];

// GET /api/tickets status codes: 1=New, 2=PendingAdminReply.
export const HOST_TICKET_STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: '1', labelKey: 'd3.complaints.hostFilters.status.new' },
  { value: '2', labelKey: 'd3.complaints.hostFilters.status.pendingAdminReply' },
];

// GET /api/tickets priority codes: 1=Low, 2=Normal, 3=High, 4=Urgent.
export const HOST_TICKET_PRIORITY_OPTIONS: { value: string; labelKey: string }[] = [
  { value: '1', labelKey: 'd3.complaints.customerFilters.priority.low' },
  { value: '2', labelKey: 'd3.complaints.customerFilters.priority.normal' },
  { value: '3', labelKey: 'd3.complaints.customerFilters.priority.high' },
  { value: '4', labelKey: 'd3.complaints.customerFilters.priority.urgent' },
];

export interface TicketPropertyFilterItem {
  propertyId: number;
  name: string;
}

export interface TicketMessage {
  externalId: string;
  senderType: number | string;
  senderTypeName: string;
  senderUserId: string;
  senderName: string;
  adminSenderRole?: string | null;
  adminSenderDepartment?: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  attachment?: TicketAttachment | null;
}

export interface TicketAttachment {
  externalId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface TicketStatusHistory {
  fromStatus: string | null;
  toStatus: string;
  changedByType: number;
  changedByUserId: string;
  changedByName: string;
  adminSenderRole: string | null;
  adminSenderDepartment: string | null;
  note: string | null;
  createdAt: string;
}

export interface UpdateStatusRequest {
  status: string;
  note?: string;
}

export interface UpdateClientTicketStatusRequest {
  status: string;
  note?: string;
}

export interface TicketActionResult {
  externalId: string;
  message: string;
  reply: TicketMessage;
}

export interface TicketDetail {
  externalId: string;
  ticketNumber: string;
  subject: string;
  status: string;
  statusName: string;
  priority: string;
  department: string;
  departmentName?: string;
  propertyName?: string;
  accountName?: string;
  createdByName?: string | null;
  assignedAdminUserId: string | null;
  assignedAdminName: string | null;
  createdByType: string;
  createdByUserId: string;
  closedAtUtc: string | null;
  source?: TicketSource;
  sourceName?: string | null;
  isFromWorker?: boolean;
  initialMessage: TicketMessage;
  messages: TicketMessage[];
  attachments?: TicketAttachment[];
  statusHistory: TicketStatusHistory[];
}

export interface ChatMessageAttachment {
  fileName: string;
  url: string;
  contentType: string;
}

export interface ChatMessage {
  id: string;
  senderRole: 'client' | 'support' | 'bot';
  senderName: string;
  senderNameEn?: string;
  content: string;
  contentEn?: string;
  timestamp: string;
  timestampEn?: string;
  createdAtUtc: string;
  attachment?: ChatMessageAttachment | null;
  /** Buttons a bot message offered — used to show the client's reply (sent as the option
   * key, e.g. "payment") by its label instead. */
  options?: ClientChatMessageOption[];
}

export interface ClientTicket {
  externalId: string;
  chatExternalId?: string;
  sessionNumber?: string;
  /** Older responses used this name — sessionNumber is what the API returns now. */
  ticketNumber?: string;
  subject: string;
  department: string;
  status: string;
  currentHandler?: string;
  priority: string;
  clientName: string | null;
  assignedAgentName: string | null;
  /** Requested from the backend — optional until the API sends them. */
  assignedAgentUserId?: string | null;
  assignedAtUtc?: string | null;
  lastAgentReplyAtUtc?: string | null;
  lastMessagePreview: string | null;
  lastMessageAtUtc: string | null;
  createdAt: string;
}

export interface ClientTicketListResponse {
  data: ClientTicket[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}

export interface ClientTicketMessageAttachment {
  externalId: string;
  fileName: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}

export interface ClientTicketMessage {
  externalId: string;
  senderType: string;
  senderName: string;
  body: string;
  attachment: ClientTicketMessageAttachment | null;
  createdAt: string;
}

export interface ClientTicketStatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  note: string | null;
  createdAt: string;
}

export interface ClientTicketDetail {
  relatedBookingId: string | null;
  closedAtUtc: string | null;
  messages: ClientTicketMessage[];
  hasMoreMessages?: boolean;
  statusHistory: ClientTicketStatusHistoryEntry[];
  externalId: string;
  chatExternalId?: string;
  sessionNumber?: string;
  /** Older responses used this name — sessionNumber is what the API returns now. */
  ticketNumber?: string;
  subject: string;
  department: string;
  status: string;
  currentHandler?: string;
  priority: string;
  clientName: string | null;
  assignedAgentName: string | null;
  /** Optional until every API build sends it. */
  assignedAgentUserId?: string | null;
  lastMessagePreview: string | null;
  lastMessageAtUtc: string | null;
  createdAt: string;
}

export interface ClientChatMessageOption {
  key: string;
  labelAr: string;
  labelEn: string;
}

export interface ClientChatMessageOptions {
  interactionId: string;
  inputType: string;
  options: ClientChatMessageOption[];
}

export interface ClientChatMessage {
  externalId: string;
  /** 'Client' | 'Bot' | 'Agent' — anything other than 'Client' renders as a support bubble. */
  senderType: string;
  senderName: string;
  body: string;
  options: ClientChatMessageOptions | null;
  attachment: ClientTicketMessageAttachment | null;
  createdAt: string;
}

export interface ClientChatSession {
  externalId: string;
  sessionNumber: string;
  department: string;
  status: string;
  currentHandler: string;
  assignedAgentName: string | null;
  createdAt: string;
  closedAtUtc: string | null;
  messages: ClientChatMessage[];
  hasMoreMessages: boolean;
}

// GET /api/client-tickets/{ticketExternalId}/messages?before={oldest loaded messageId} —
// paginates older messages within a single session once its hasMoreMessages is true.
export interface ClientTicketMessagesPage {
  messages: ClientChatMessage[];
  hasMore: boolean;
}

// GET /api/client-chats/{chatExternalId} — a chat can hold multiple sessions over time
// (e.g. re-escalations); currentSessionExternalId points at the one currently active.
export interface ClientChat {
  externalId: string;
  currentSessionExternalId: string;
  clientLastReadAtUtc: string | null;
  agentLastReadAtUtc: string | null;
  sessions: ClientChatSession[];
}

export interface ClientTicketQueryParams {
  // Enum params are the API's own string names (status=PendingAgent, department=Booking,
  // priority=High …) — GET /api/client-tickets does not accept numeric codes.
  status?: string;
  department?: string;
  priority?: string;
  assignedAgentUserId?: string;
  search?: string;
  /** true = every status except Resolved/ClosedByClient/ClosedByAdmin, false = only those,
   * omitted = all statuses. Filtered server-side so page size and totalCount stay accurate. */
  isOpen?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ClientTicketQueueQueryParams {
  department?: string;
  page?: number;
  pageSize?: number;
}

export const CLIENT_TICKETS_PAGE_SIZE = 8;

// `value` is the status name GET /api/client-tickets filters on. The customers tab always
// sends isOpen=true, so only open statuses belong here — Resolved/Closed* live in the
// "resolved" tab. Labels reuse the row badge keys so the filter matches what rows show.
export const CLIENT_TICKET_STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'BotHandling',  labelKey: 'd3.complaints.status.bot' },
  { value: 'PendingAgent', labelKey: 'd3.complaints.status.pending' },
  { value: 'Assigned',     labelKey: 'd3.complaints.status.inProgress' },
];

// department / priority filter values — the same string names the API expects.
export const CLIENT_TICKET_DEPARTMENT_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'General',   labelKey: 'd3.complaints.customerFilters.dept.general' },
  { value: 'Booking',   labelKey: 'd3.complaints.customerFilters.dept.booking' },
  { value: 'Payment',   labelKey: 'd3.complaints.customerFilters.dept.payment' },
  { value: 'Technical', labelKey: 'd3.complaints.customerFilters.dept.technical' },
  { value: 'Account',   labelKey: 'd3.complaints.customerFilters.dept.account' },
];

export const CLIENT_TICKET_PRIORITY_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'Low',    labelKey: 'd3.complaints.customerFilters.priority.low' },
  { value: 'Normal', labelKey: 'd3.complaints.customerFilters.priority.normal' },
  { value: 'High',   labelKey: 'd3.complaints.customerFilters.priority.high' },
  { value: 'Urgent', labelKey: 'd3.complaints.customerFilters.priority.urgent' },
];

// String names the backend's status field actually accepts on PATCH /api/client-tickets/{id}/status.
// Only these four are ever set manually by an agent — the rest (BotHandling, PendingAgent,
// Assigned, ClosedByClient) are system-driven.
export const CLIENT_TICKET_STATUS = {
  InProgress: 'InProgress',
  WaitingForClient: 'WaitingForClient',
  Resolved: 'Resolved',
  ClosedByAdmin: 'ClosedByAdmin',
} as const;

const CLOSED_TICKET_STATUSES = new Set(['resolved', 'closed', 'closedbyclient', 'closedbyadmin', '5']);

/** Whether a host or client ticket is already finished (Resolved / Closed*), so it
 * can no longer be assigned. Host tickets may send the numeric code 5 for Closed. */
export function isClosedTicketStatus(status: string | number | null | undefined, closedAtUtc?: string | null): boolean {
  if (closedAtUtc) return true;
  return status != null && CLOSED_TICKET_STATUSES.has(String(status).toLowerCase());
}

export interface TicketsOverviewItem {
  externalId: string;
  ticketNumber: string;
  ticketType: 'Client' | 'Merchant';
  userName: string | null;
  accountName?: string | null;
  subject: string;
  repliedAtUtc: string | null;
  createdAt: string;
  /** Real final status (e.g. Resolved, ClosedByClient, ClosedByAdmin). */
  status?: string | null;
  /** True when the requester (client/host) closed it themselves. */
  closedBySelf?: boolean | null;
}

/** How a ticket in the "resolved" tab actually ended — drives its status badge. */
export type ResolvedOutcome = 'closedBySelf' | 'closedByAdmin' | 'resolvedByAgent';

export interface TicketsOverviewResponse {
  data: TicketsOverviewItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}

export interface TicketsOverviewQueryParams {
  type?: 'Client' | 'Merchant';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const RESOLVED_TYPE_OPTIONS: { value: 'Client' | 'Merchant'; labelKey: string }[] = [
  { value: 'Client', labelKey: 'd3.complaints.table.typeClient' },
  { value: 'Merchant', labelKey: 'd3.complaints.table.typeMerchant' },
];

export const RESOLVED_TICKETS_PAGE_SIZE = 8;

export interface Complaint {
  id: string;
  /** GET /api/client-chats/{chatExternalId} — only set for customer-type complaints. */
  chatExternalId?: string;
  ticketId: string;
  clientName: string;
  clientNameEn?: string;
  clientInitials: string;
  clientCode: string;
  status: ComplaintStatus;
  date: string;
  dateEn?: string;
  type: 'customer' | 'host';
  resolved: boolean;
  messages: ChatMessage[];
  /** Whether older messages exist beyond what's currently loaded (customer chats only). */
  hasMoreMessages?: boolean;
  subject?: string;
  subjectEn?: string;
  replyDate?: string;
  replyDateEn?: string;
  /** "resolved" tab only — how the ticket ended. */
  resolvedOutcome?: ResolvedOutcome;
  assignedAdminUserId?: string | null;
  assignedAdminName?: string | null;
  propertyName?: string | null;
  departmentName?: string;
  /** Raw department enum name from the client-tickets API (e.g. "General"); localized in the table. */
  department?: string;
  priorityName?: string;
  priorityRaw?: string;
  lastMessageAtUtc?: string | null;
  assignedAtUtc?: string | null;
  lastAgentReplyAtUtc?: string | null;
  /** Host tickets only — opened from the service (worker) app. Still type 'host'. */
  isFromWorker?: boolean;
  sourceName?: string | null;
}

/** Hours an assigned ticket may sit without the agent acting before anyone can reassign it. */
export const ASSIGN_DELAY_THRESHOLD_HOURS = 6;

export interface AssignableEmployee {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  avatar?: string | null;
}

/** A deactivated employee can't sign in, so a complaint must never be assigned to them (BUG-2501).
 * Only an explicit `false` counts — a missing flag is treated as active. */
export function isInactiveEmployee(employee: Pick<AssignableEmployee, 'isActive'> | null | undefined): boolean {
  return employee?.isActive === false;
}

export interface AssignableEmployeePage {
  data: AssignableEmployee[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface AssignTicketRequest {
  assignedAdminUserId: string;
}

export interface AssignClientTicketRequest {
  agentUserId: string;
}
