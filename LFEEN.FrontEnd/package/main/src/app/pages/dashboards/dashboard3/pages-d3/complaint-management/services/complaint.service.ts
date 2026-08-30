import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, delay, map, of } from 'rxjs';
import { AssignableEmployee, AssignableEmployeePage, AssignClientTicketRequest, AssignTicketRequest, ChatMessage, ClientChat, ClientChatMessage, ClientTicket, ClientTicketDetail, ClientTicketListResponse, ClientTicketMessage, ClientTicketMessagesPage, ClientTicketQueryParams, ClientTicketQueueQueryParams, Complaint, ComplaintStatus, Ticket, TicketActionResult, TicketDetail, TicketListResponse, TicketPropertyFilterItem, TicketQueryParams, TicketsOverviewItem, TicketsOverviewQueryParams, TicketsOverviewResponse, UpdateClientTicketStatusRequest, UpdateStatusRequest } from '../interfaces/complaint.model';
import { PaginatedEmployeeResponse } from '../../../interfaces/department.model';
import { PaginatedPropertyResponse } from '../../../interfaces/building-card.model';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ComplaintService {
  private http = inject(HttpClient);
  private _complaints = signal<Complaint[]>([]);

  readonly complaints = this._complaints.asReadonly();

  getComplaintById(id: string): Complaint | undefined {
    return this._complaints().find(c => c.id === id);
  }

  resolveComplaint(id: string): Observable<void> {
    this._complaints.update(list =>
      list.map(c => c.id === id ? { ...c, resolved: true, status: 'replied' as const } : c)
    );
    return of(undefined).pipe(delay(300));
  }

  sendMessage(complaintId: string, content: string): Observable<void> {
    const now = new Date();
    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderRole: 'support',
      senderName: 'فريق الدعم',
      senderNameEn: 'Support',
      content,
      timestamp: now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      timestampEn: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      createdAtUtc: now.toISOString()
    };
    this._complaints.update(list =>
      list.map(c => c.id === complaintId
        ? { ...c, messages: [...c.messages, msg] }
        : c
      )
    );
    return of(undefined).pipe(delay(200));
  }

  // The endpoint expects multipart/form-data (lowercase field names), not JSON —
  // a plain JSON body gets a 415 Unsupported Media Type back.
  sendClientTicketMessage(ticketId: string, body: string, attachment?: File | null): Observable<void> {
    const form = new FormData();
    form.append('body', body);
    if (attachment) form.append('attachment', attachment);
    return this.http.post<void>(`${environment.apiBaseUrl}/api/client-tickets/${ticketId}/messages`, form);
  }

  getTicketById(externalId: string): Observable<TicketDetail> {
    return this.http.get<TicketDetail>(`${environment.apiBaseUrl}/api/tickets/${externalId}`);
  }

  readonly closeDialogTrigger = signal(0);

  emitCloseDialog(): void {
    this.closeDialogTrigger.update(n => n + 1);
  }

  updateTicketStatus(ticketId: string, status: string, note?: string): Observable<void> {
    const payload: UpdateStatusRequest = { status, ...(note ? { note } : {}) };
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/tickets/${ticketId}/status`, payload);
  }

  updateClientTicketStatus(ticketId: string, status: number, note?: string): Observable<void> {
    const payload: UpdateClientTicketStatusRequest = { status, ...(note ? { note } : {}) };
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/client-tickets/${ticketId}/status`, payload);
  }

  sendTicketReply(ticketId: string, body: string, attachment?: File | null): Observable<TicketActionResult> {
    const form = new FormData();
    if (body) form.append('Body', body);
    form.append('IsInternalNote', 'false');
    if (attachment) form.append('Attachment', attachment);
    return this.http.post<TicketActionResult>(
      `${environment.apiBaseUrl}/api/tickets/${ticketId}/replies`,
      form
    );
  }

  getTickets(params: TicketQueryParams = {}): Observable<TicketListResponse> {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('pageSize', (params.pageSize ?? 20).toString());

    if (params.propertyId !== undefined && params.propertyId !== null) {
      httpParams = httpParams.set('propertyId', params.propertyId.toString());
    }
    if (params.assignedAdminUserId) {
      httpParams = httpParams.set('assignedAdminUserId', params.assignedAdminUserId);
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.department) {
      httpParams = httpParams.set('department', params.department);
    }
    if (params.priority) {
      httpParams = httpParams.set('priority', params.priority);
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.dateFrom) {
      httpParams = httpParams.set('dateFrom', params.dateFrom);
    }
    if (params.dateTo) {
      httpParams = httpParams.set('dateTo', params.dateTo);
    }

    return this.http.get<TicketListResponse>(`${environment.apiBaseUrl}/api/tickets`, { params: httpParams });
  }

  getPropertiesForFilter(): Observable<TicketPropertyFilterItem[]> {
    const params = new HttpParams()
      .set('pageNumber', '1')
      .set('pageSize', '50')
      .set('newestFirst', 'true');
    return this.http
      .get<PaginatedPropertyResponse>(`${environment.apiBaseUrl}/api/properties`, { params })
      .pipe(map(res => res.data.map(p => ({ propertyId: p.propertyId, name: p.name }))));
  }

  mapTicketToComplaint(t: Ticket): Complaint {
    return {
      id: t.externalId,
      ticketId: t.ticketNumber,
      clientName: t.createdByName ?? '-',
      clientInitials: this.getInitials(t.createdByName ?? '-'),
      clientCode: t.propertyName ?? '-',
      status: this.mapTicketStatus(t.status),
      date: new Date(t.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(t.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: 'host',
      resolved: t.status === 5 || t.status === 'Closed' || t.status === 'Resolved',
      messages: [],
      subject: t.subject,
      assignedAdminUserId: t.assignedAdminUserId,
      assignedAdminName: t.assignedAdminName,
      propertyName: t.propertyName ?? null,
      departmentName: t.departmentName,
      priorityName: t.priorityName,
      priorityRaw: typeof t.priority === 'string' ? t.priority : undefined,
      lastMessageAtUtc: t.lastMessageAtUtc ?? null,
    };
  }

  getClientTickets(params: ClientTicketQueryParams): Observable<ClientTicketListResponse> {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('pageSize', (params.pageSize ?? 20).toString());

    if (params.status !== undefined && params.status !== null) {
      httpParams = httpParams.set('status', params.status.toString());
    }
    if (params.department !== undefined && params.department !== null) {
      httpParams = httpParams.set('department', params.department.toString());
    }
    if (params.priority !== undefined && params.priority !== null) {
      httpParams = httpParams.set('priority', params.priority.toString());
    }
    if (params.assignedAgentUserId) {
      httpParams = httpParams.set('assignedAgentUserId', params.assignedAgentUserId);
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<ClientTicketListResponse>(
      `${environment.apiBaseUrl}/api/client-tickets`,
      { params: httpParams }
    );
  }

  // Tickets waiting for an agent (mainly PendingAgent) — used to surface priority
  // items at the top of the main client-tickets list, not as a replacement for it.
  getClientTicketsQueue(params: ClientTicketQueueQueryParams = {}): Observable<ClientTicketListResponse> {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('pageSize', (params.pageSize ?? 50).toString());

    if (params.department !== undefined && params.department !== null) {
      httpParams = httpParams.set('department', params.department.toString());
    }

    return this.http.get<ClientTicketListResponse>(
      `${environment.apiBaseUrl}/api/client-tickets/queue`,
      { params: httpParams }
    );
  }

  // Host tickets use the unified assignment endpoint.
  assignTicket(ticketId: string, adminUserId: string): Observable<void> {
    const payload: AssignTicketRequest = { assignedAdminUserId: adminUserId };
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/tickets/${ticketId}/assignment`, payload);
  }

  // Customer (client) tickets have their own dedicated assignment endpoint.
  assignClientTicket(ticketExternalId: string, agentUserId: string): Observable<void> {
    const payload: AssignClientTicketRequest = { agentUserId };
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/client-tickets/${ticketExternalId}/assign`, payload);
  }

  // Self-claim for a PendingAgent client ticket — called when the current agent starts
  // replying to an unassigned ticket, rather than picking an employee from a list.
  claimClientTicket(ticketExternalId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/client-tickets/${ticketExternalId}/claim`, {});
  }

  getAssignableEmployees(search?: string, page = 1, pageSize = 8): Observable<AssignableEmployeePage> {
    let params = new HttpParams().set('page', page.toString()).set('pageSize', pageSize.toString());
    if (search) {
      params = params.set('search', search);
    }
    return this.http
      .get<PaginatedEmployeeResponse>(`${environment.apiBaseUrl}/api/departments/employees`, { params })
      .pipe(
        map(res => ({
          data: res.data.map(e => ({
            userId: e.userId,
            fullName: e.fullName,
            email: e.email,
            phoneNumber: e.phoneNumber,
            isActive: e.isActive,
            avatar: e.avatar,
          } as AssignableEmployee)),
          totalCount: res.totalCount,
          page: res.page,
          totalPages: res.totalPages,
        }))
      );
  }

  mapClientTicketToComplaint(t: ClientTicket): Complaint {
    const clientName = t.clientName ?? '-';
    return {
      id: t.externalId ?? '-',
      chatExternalId: t.chatExternalId,
      ticketId: t.sessionNumber ?? t.ticketNumber ?? '-',
      clientName,
      clientInitials: this.getInitials(clientName),
      clientCode: '-',
      status: this.mapClientTicketStatus(t.status),
      department: t.department,
      date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
      dateEn: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
      type: 'customer',
      resolved: t.status === 'Resolved' || t.status === 'Closed',
      messages: [],
      subject: t.subject ?? undefined,
      assignedAdminName: t.assignedAgentName,
      lastMessageAtUtc: t.lastMessageAtUtc ?? null,
    };
  }

  getClientTicketById(id: string): Observable<ClientTicketDetail> {
    return this.http.get<ClientTicketDetail>(`${environment.apiBaseUrl}/api/client-tickets/${id}`);
  }

  mapClientTicketDetailToComplaint(detail: ClientTicketDetail, fallback?: Complaint): Complaint {
    const clientName = detail.clientName || fallback?.clientName || '-';

    return {
      id: detail.externalId,
      ticketId: detail.sessionNumber ?? detail.ticketNumber ?? '-',
      clientName,
      clientInitials: this.getInitials(clientName),
      clientCode: fallback?.clientCode ?? '-',
      status: this.mapClientTicketStatus(detail.status),
      date: new Date(detail.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(detail.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: 'customer',
      resolved: detail.status === 'Resolved' || detail.status === 'Closed' || !!detail.closedAtUtc,
      messages: detail.messages.map(m => this.mapClientTicketMessage(m)),
      subject: detail.subject,
      assignedAdminName: detail.assignedAgentName,
    };
  }

  private mapClientTicketMessage(m: ClientTicketMessage): ChatMessage {
    const createdAt = new Date(m.createdAt);
    return {
      id: m.externalId,
      senderRole: m.senderType === 'Client' ? 'client' : 'support',
      senderName: m.senderName,
      content: m.body,
      timestamp: createdAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      timestampEn: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      createdAtUtc: m.createdAt,
      attachment: m.attachment
        ? { fileName: m.attachment.fileName, url: m.attachment.url, contentType: m.attachment.contentType }
        : null,
    };
  }

  // Chat-level detail — replaces getClientTicketById as the source for the open chat's
  // message thread, since it carries the full conversation (including the bot phase)
  // instead of just the session's own messages.
  getClientChatById(chatExternalId: string): Observable<ClientChat> {
    return this.http.get<ClientChat>(`${environment.apiBaseUrl}/api/client-chats/${chatExternalId}`);
  }

  // Older-message pagination for a single session, once its hasMoreMessages is true.
  // `before` is the externalId of the oldest message currently loaded in the UI.
  getClientTicketMessages(ticketExternalId: string, before: string): Observable<ClientTicketMessagesPage> {
    const params = new HttpParams().set('before', before);
    return this.http.get<ClientTicketMessagesPage>(
      `${environment.apiBaseUrl}/api/client-tickets/${ticketExternalId}/messages`,
      { params }
    );
  }

  mapClientChatMessages(messages: ClientChatMessage[]): ChatMessage[] {
    return messages.map(m => this.mapClientChatMessage(m));
  }

  mapClientChatToComplaint(chat: ClientChat, fallback?: Complaint): Complaint {
    const session = chat.sessions.find(s => s.externalId === chat.currentSessionExternalId)
      ?? chat.sessions[chat.sessions.length - 1];
    const clientName = fallback?.clientName || '-';

    if (!session) {
      return {
        id: fallback?.id ?? chat.externalId,
        chatExternalId: chat.externalId,
        ticketId: fallback?.ticketId ?? '-',
        clientName,
        clientInitials: this.getInitials(clientName),
        clientCode: fallback?.clientCode ?? '-',
        status: fallback?.status ?? 'new',
        date: fallback?.date ?? '-',
        dateEn: fallback?.dateEn ?? '-',
        type: 'customer',
        resolved: false,
        messages: [],
        hasMoreMessages: false,
        subject: fallback?.subject,
        assignedAdminName: fallback?.assignedAdminName ?? null,
      };
    }

    return {
      id: session.externalId,
      chatExternalId: chat.externalId,
      ticketId: session.sessionNumber,
      clientName,
      clientInitials: this.getInitials(clientName),
      clientCode: fallback?.clientCode ?? '-',
      status: this.mapClientTicketStatus(session.status),
      date: new Date(session.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(session.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: 'customer',
      resolved: session.status === 'Resolved' || session.status === 'Closed' || !!session.closedAtUtc,
      messages: session.messages.map(m => this.mapClientChatMessage(m)),
      hasMoreMessages: session.hasMoreMessages,
      subject: fallback?.subject,
      assignedAdminName: session.assignedAgentName,
    };
  }

  private mapClientChatMessage(m: ClientChatMessage): ChatMessage {
    const createdAt = new Date(m.createdAt);
    return {
      id: m.externalId,
      senderRole: m.senderType === 'Client' ? 'client' : 'support',
      senderName: m.senderName,
      content: m.body,
      timestamp: createdAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      timestampEn: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      createdAtUtc: m.createdAt,
      attachment: m.attachment
        ? { fileName: m.attachment.fileName, url: m.attachment.url, contentType: m.attachment.contentType }
        : null,
    };
  }

  mapClientTicketStatus(status: string): ComplaintStatus {
    const map: Record<string, ComplaintStatus> = {
      New:          'new',
      Open:         'new',
      BotHandling:  'new',
      Pending:      'pending',
      PendingAgent: 'pending',
      InProgress:   'in_progress',
      WaitingForClient: 'replied',
      Resolved:     'replied',
      Closed:       'closed',
      ClosedByClient: 'closed',
      ClosedByAdmin:  'closed',
    };
    return map[status] ?? 'new';
  }

  getResolvedTicketsOverview(params: TicketsOverviewQueryParams = {}): Observable<TicketsOverviewResponse> {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('pageSize', (params.pageSize ?? 20).toString());

    if (params.type) httpParams = httpParams.set('type', params.type);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);

    return this.http.get<TicketsOverviewResponse>(
      `${environment.apiBaseUrl}/api/tickets-overview/resolved`,
      { params: httpParams }
    );
  }

  mapTicketsOverviewItemToComplaint(item: TicketsOverviewItem): Complaint {
    const repliedAt = new Date(item.repliedAtUtc);
    const clientName = item.userName ?? item.accountName ?? '-';
    return {
      id: item.externalId,
      ticketId: item.ticketNumber,
      clientName,
      clientInitials: this.getInitials(clientName),
      clientCode: '-',
      status: 'replied',
      date: new Date(item.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(item.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: item.ticketType === 'Client' ? 'customer' : 'host',
      resolved: true,
      messages: [],
      subject: item.subject,
      replyDate: repliedAt.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      replyDateEn: repliedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
  }

  private mapTicketStatus(status: string | number): ComplaintStatus {
    const byName: Record<string, ComplaintStatus> = {
      'New':                'new',
      'PendingAdminReply':  'pending',
      'WaitingMerchant':    'in_progress',
      'Resolved':           'replied',
      'Closed':             'closed',
    };
    const byNum: Record<number, ComplaintStatus> = {
      1: 'new', 2: 'pending', 3: 'in_progress', 4: 'replied', 5: 'closed',
    };
    if (typeof status === 'number') return byNum[status] ?? 'new';
    return byName[status] ?? byNum[+status] ?? 'new';
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  }
}
