export type ComplaintStatus = 'new' | 'in_progress' | 'closed' | 'pending' | 'replied';
export type ComplaintTab    = 'customers' | 'hosts' | 'resolved';

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
}

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
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const HOST_TICKETS_PAGE_SIZE = 20;

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
  status: number;
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
  status?: number;
  department?: number;
  priority?: number;
  assignedAgentUserId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ClientTicketQueueQueryParams {
  department?: number;
  page?: number;
  pageSize?: number;
}

export const CLIENT_TICKETS_PAGE_SIZE = 8;

export const CLIENT_TICKET_STATUS_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 0, labelKey: 'd3.complaints.clientStatus.open' },
  { value: 1, labelKey: 'd3.complaints.clientStatus.pending' },
  { value: 2, labelKey: 'd3.complaints.clientStatus.resolved' },
];

export const CLIENT_TICKET_STATUS = {
  New: 1,
  Assigned: 2,
  InProgress: 3,
  WaitingClient: 4,
  Resolved: 5,
  Closed: 6,
} as const;

export interface TicketsOverviewItem {
  externalId: string;
  ticketNumber: string;
  ticketType: 'Client' | 'Merchant';
  userName: string | null;
  accountName?: string | null;
  subject: string;
  repliedAtUtc: string;
  createdAt: string;
}

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
  assignedAdminUserId?: string | null;
  assignedAdminName?: string | null;
  propertyName?: string | null;
  departmentName?: string;
  priorityName?: string;
  priorityRaw?: string;
  lastMessageAtUtc?: string | null;
}

export interface AssignableEmployee {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  avatar?: string | null;
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
