export type ComplaintStatus = 'new' | 'in_progress' | 'closed' | 'pending' | 'replied';
export type ComplaintTab    = 'customers' | 'hosts' | 'resolved';

export interface Ticket {
  externalId: string;
  ticketNumber: string;
  propertyId: number;
  propertyExternalId: string;
  propertyName: string;
  accountId: string;
  accountName: string;
  subject: string;
  department: string;
  departmentName: string;
  status: string | number;
  statusName: string;
  priority: string;
  priorityName: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAtUtc: string;
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
  status?: number;
  department?: number;
  priority?: number;
  assignedAdminUserId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const HOST_TICKETS_PAGE_SIZE = 8;

export const HOST_TICKET_STATUS_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 1, labelKey: 'd3.complaints.status.new' },
  { value: 2, labelKey: 'd3.complaints.status.pending' },
  { value: 3, labelKey: 'd3.complaints.status.inProgress' },
  { value: 4, labelKey: 'd3.complaints.status.replied' },
];

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

export interface ReplyRequest {
  body: string;
  isInternalNote: boolean;
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
  propertyName?: string;
  accountName: string;
  assignedAdminUserId: string | null;
  assignedAdminName: string | null;
  createdByType: string;
  createdByUserId: string;
  closedAtUtc: string | null;
  initialMessage: TicketMessage;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
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
  ticketNumber: string;
  subject: string;
  department: string;
  status: string;
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
  ticketNumber: string;
  subject: string;
  department: string;
  status: string;
  priority: string;
  clientName: string | null;
  assignedAgentName: string | null;
  lastMessagePreview: string | null;
  lastMessageAtUtc: string | null;
  createdAt: string;
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
  subject?: string;
  subjectEn?: string;
  replyDate?: string;
  replyDateEn?: string;
  assignedAdminUserId?: string | null;
  assignedAdminName?: string | null;
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
  adminUserId: string;
}

export interface AssignHostTicketRequest {
  assignedAdminUserId: string;
}
