import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, delay, expand, map, of, reduce } from 'rxjs';
import { AssignableEmployee, AssignableEmployeePage, AssignClientTicketRequest, AssignTicketRequest, ChatMessage, ClientChatMessageOption, ClientChatMessageOptions, ClientChat,ClientChatMessage, ClientTicket, ClientTicketDetail, ClientTicketListResponse, ClientTicketMessage, ClientTicketMessagesPage, ClientTicketMessageAttachment, ClientTicketQueryParams, ClientTicketQueueQueryParams, Complaint, ComplaintStatus, AR_DATE_LOCALE, EmployeeComplaintDetail, Ticket, TicketActionResult, TicketDetail, TicketListResponse, ResolvedOutcome, TicketPropertyFilterItem, TicketQueryParams, TicketsOverviewItem, TicketsOverviewQueryParams, TicketsOverviewResponse, UpdateClientTicketStatusRequest, UpdateStatusRequest } from '../interfaces/complaint.model';
import { ClientRatingByAgentItem, ClientRatingByAgentQueryParams, ClientRatingListResponse, ClientRatingQueryParams } from '../interfaces/ratings.model';
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
      list.map(c => c.id === id ? { ...c, resolved: true, status: 'resolved' as const } : c)
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
      timestamp: now.toLocaleTimeString(AR_DATE_LOCALE, { hour: '2-digit', minute: '2-digit' }),
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

  /** A complaint against an employee (ComplaintCreated notifications) — not a ticket. */
  getEmployeeComplaintById(id: string): Observable<EmployeeComplaintDetail> {
    return this.http.get<EmployeeComplaintDetail>(`${environment.apiBaseUrl}/api/complaints/${id}`);
  }

  readonly closeDialogTrigger = signal(0);

  /** True while the open host ticket detail can't be closed from the header — it is still
   * loading, wasn't found / failed to load, is already finished (Resolved/Closed), or the
   * admin can't write tickets. The page header hides its "Close & resolve" button then. */
  readonly detailReadOnly = signal(false);

  emitCloseDialog(): void {
    this.closeDialogTrigger.update(n => n + 1);
  }

  updateTicketStatus(ticketId: string, status: string, note?: string): Observable<void> {
    const payload: UpdateStatusRequest = { status, ...(note ? { note } : {}) };
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/tickets/${ticketId}/status`, payload);
  }

  updateClientTicketStatus(ticketId: string, status: string, note?: string): Observable<void> {
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
    if (params.source) {
      httpParams = httpParams.set('source', params.source);
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
      date: new Date(t.createdAt).toLocaleDateString(AR_DATE_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }),
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
      assignedAtUtc: t.assignedAtUtc ?? null,
      lastAgentReplyAtUtc: t.lastAgentReplyAtUtc ?? null,
      // Worker tickets stay type 'host' — reply/status/assign work exactly the same.
      isFromWorker: t.isFromWorker === true,
      sourceName: t.sourceName ?? null,
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
    if (params.isOpen !== undefined) {
      httpParams = httpParams.set('isOpen', String(params.isOpen));
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

  // Read-only. Without ClientTickets.ViewAllRatings the backend scopes the result to the
  // caller's own sessions regardless of agentUserId — don't re-filter the response here.
  getClientRatings(params: ClientRatingQueryParams): Observable<ClientRatingListResponse> {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('pageSize', (params.pageSize ?? 20).toString());

    if (params.agentUserId) httpParams = httpParams.set('agentUserId', params.agentUserId);
    if (params.department)  httpParams = httpParams.set('department', params.department);
    if (params.minRating)   httpParams = httpParams.set('minRating', params.minRating.toString());
    if (params.maxRating)   httpParams = httpParams.set('maxRating', params.maxRating.toString());
    if (params.from)        httpParams = httpParams.set('from', params.from);
    if (params.to)          httpParams = httpParams.set('to', params.to);

    return this.http.get<ClientRatingListResponse>(
      `${environment.apiBaseUrl}/api/client-tickets/ratings`,
      { params: httpParams }
    );
  }

  // Requires ClientTickets.ViewAllRatings outright (403 otherwise). Bare array, no envelope.
  getClientRatingsByAgent(params: ClientRatingByAgentQueryParams = {}): Observable<ClientRatingByAgentItem[]> {
    let httpParams = new HttpParams();
    if (params.department) httpParams = httpParams.set('department', params.department);
    if (params.from)       httpParams = httpParams.set('from', params.from);
    if (params.to)         httpParams = httpParams.set('to', params.to);

    return this.http.get<ClientRatingByAgentItem[]>(
      `${environment.apiBaseUrl}/api/client-tickets/ratings/by-agent`,
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

  /** Every assignable employee, walking all pages — for filter dropdowns that list the whole
   * set at once (a single page used to cut the list off at the first 50). */
  getAllAssignableEmployees(pageSize = 100): Observable<AssignableEmployee[]> {
    return this.getAssignableEmployees(undefined, 1, pageSize).pipe(
      expand(res => res.page < res.totalPages
        ? this.getAssignableEmployees(undefined, res.page + 1, pageSize)
        : EMPTY),
      reduce((all, res) => all.concat(Array.isArray(res?.data) ? res.data : []), [] as AssignableEmployee[]),
    );
  }

  /** The API's own message for a failed assign (e.g. TICKET_ASSIGN_CONFLICT names the current
   * assignee) — null when the response carries none, so the caller can fall back. */
  assignErrorMessage(err: unknown): string | null {
    const body = err instanceof HttpErrorResponse ? err.error : null;
    const message = body && typeof body === 'object' ? (body as { message?: unknown }).message : null;
    return typeof message === 'string' && message.trim() ? message : null;
  }

  isAssignConflict(err: unknown): boolean {
    const body = err instanceof HttpErrorResponse ? err.error : null;
    if (!body || typeof body !== 'object') return false;
    const b = body as { errorCode?: unknown; code?: unknown };
    return b.errorCode === 'TICKET_ASSIGN_CONFLICT' || b.code === 'TICKET_ASSIGN_CONFLICT';
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
      date: t.createdAt ? new Date(t.createdAt).toLocaleDateString(AR_DATE_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
      dateEn: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
      type: 'customer',
      resolved: t.status === 'Resolved' || t.status === 'Closed',
      messages: [],
      subject: t.subject ?? undefined,
      assignedAdminUserId: t.assignedAgentUserId ?? null,
      assignedAdminName: t.assignedAgentName,
      lastMessageAtUtc: t.lastMessageAtUtc ?? null,
      assignedAtUtc: t.assignedAtUtc ?? null,
      lastAgentReplyAtUtc: t.lastAgentReplyAtUtc ?? null,
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
      date: new Date(detail.createdAt).toLocaleDateString(AR_DATE_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(detail.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: 'customer',
      resolved: detail.status === 'Resolved' || detail.status === 'Closed' || !!detail.closedAtUtc,
      messages: detail.messages.map(m => this.mapClientTicketMessage(m)),
      subject: detail.subject,
      assignedAdminName: detail.assignedAgentName,
    };
  }

  private mapClientTicketMessage(m: ClientTicketMessage): ChatMessage {
    return {
      id: m.externalId,
      senderRole: m.senderType === 'Client' ? 'client' : 'support',
      senderName: m.senderName,
      content: m.body,
      ...this.formatMessageTime(m.createdAt),
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
    return this.labelOptionReplies(messages.map(m => this.mapClientChatMessage(m)));
  }

  /** A client's tap on a bot button is stored as the option key ("payment"); show it by the
   * label of the button it came from (labelAr / labelEn of the latest bot options before it).
   * Run on the whole thread after any merge — the bot prompt may sit in an older page.
   * Free text that matches no offered key is left as typed. */
  labelOptionReplies(messages: ChatMessage[]): ChatMessage[] {
    let offered: ClientChatMessageOption[] | undefined;
    return messages.map(m => {
      if (m.senderRole !== 'client') {
        if (m.options?.length) offered = m.options;
        return m;
      }
      const reply = m.content?.trim().toLowerCase();
      const option = reply ? offered?.find(o => o.key?.trim().toLowerCase() === reply) : undefined;
      if (!option) return m;
      const ar = option.labelAr?.trim() || option.labelEn?.trim() || m.content;
      const en = option.labelEn?.trim() || ar;
      return { ...m, content: ar, contentEn: en };
    });
  }

  /** The hub sends a bot message's options as a JSON string; tolerate either key casing
   * and any malformed payload (a bad string just means no labels, not a broken chat). */
  parseHubOptions(optionsJson: string | null | undefined): ClientChatMessageOptions | null {
    if (!optionsJson) return null;
    try {
      const raw = JSON.parse(optionsJson);
      const list: unknown = raw?.options ?? raw?.Options ?? (Array.isArray(raw) ? raw : null);
      if (!Array.isArray(list)) return null;
      const options = list
        .map((o: any) => ({
          key: String(o?.key ?? o?.Key ?? ''),
          labelAr: String(o?.labelAr ?? o?.LabelAr ?? ''),
          labelEn: String(o?.labelEn ?? o?.LabelEn ?? ''),
        }))
        .filter(o => o.key);
      return {
        interactionId: String(raw?.interactionId ?? raw?.InteractionId ?? ''),
        inputType: String(raw?.inputType ?? raw?.InputType ?? ''),
        options,
      };
    } catch {
      return null;
    }
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
      date: new Date(session.createdAt).toLocaleDateString(AR_DATE_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(session.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: 'customer',
      resolved: session.status === 'Resolved' || session.status === 'Closed' || !!session.closedAtUtc,
      messages: this.mapClientChatMessages(session.messages),
      hasMoreMessages: session.hasMoreMessages,
      subject: fallback?.subject,
      assignedAdminName: session.assignedAgentName,
    };
  }

  /** Shared by the loaded thread and live hub messages, so both render identically.
   * Only the attachment fields the bubble shows are required (the hub event omits the rest). */
  mapClientChatMessage(
    m: Omit<ClientChatMessage, 'options' | 'attachment'> & {
      options?: ClientChatMessageOptions | null;
      attachment: Pick<ClientTicketMessageAttachment, 'fileName' | 'url' | 'contentType'> | null;
    }
  ): ChatMessage {
    const options = m.options?.options?.filter(o => !!o?.key);
    return {
      ...(options?.length ? { options } : {}),
      id: m.externalId,
      senderRole: m.senderType === 'Client' ? 'client' : 'support',
      senderName: m.senderName,
      content: m.body,
      ...this.formatMessageTime(m.createdAt),
      createdAtUtc: m.createdAt,
      attachment: m.attachment
        ? { fileName: m.attachment.fileName, url: m.attachment.url, contentType: m.attachment.contentType }
        : null,
    };
  }

  // A missing/unparseable date shows "-" rather than the literal "Invalid Date".
  private formatMessageTime(value: string | null | undefined): { timestamp: string; timestampEn: string } {
    const createdAt = value ? new Date(value) : null;
    if (!createdAt || isNaN(createdAt.getTime())) return { timestamp: '-', timestampEn: '-' };
    return {
      timestamp: createdAt.toLocaleTimeString(AR_DATE_LOCALE, { hour: '2-digit', minute: '2-digit' }),
      timestampEn: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  mapClientTicketStatus(status: string): ComplaintStatus {
    const map: Record<string, ComplaintStatus> = {
      New:          'new',
      Open:         'new',
      BotHandling:  'bot',
      Pending:      'pending',
      PendingAgent: 'pending',
      Assigned:     'in_progress',
      InProgress:   'in_progress',
      WaitingForClient: 'replied',
      Resolved:     'resolved',
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
    // new Date(null) is the 1970 epoch — show '-' instead when the backend has no reply date
    const repliedAt = item.repliedAtUtc ? new Date(item.repliedAtUtc) : null;
    const replyDateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    // `||` not `??` — the API can send userName as "" which `??` would keep as a blank cell.
    const clientName = item.userName?.trim() || item.accountName?.trim() || '-';
    return {
      id: item.externalId,
      ticketId: item.ticketNumber,
      clientName,
      clientInitials: this.getInitials(clientName),
      clientCode: '-',
      status: 'resolved',
      date: new Date(item.createdAt).toLocaleDateString(AR_DATE_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(item.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: item.ticketType === 'Client' ? 'customer' : 'host',
      resolved: true,
      messages: [],
      subject: item.subject,
      replyDate: repliedAt ? repliedAt.toLocaleDateString(AR_DATE_LOCALE, replyDateOptions) : '-',
      replyDateEn: repliedAt ? repliedAt.toLocaleDateString('en-US', replyDateOptions) : '-',
      resolvedOutcome: this.mapResolvedOutcome(item),
    };
  }

  private mapResolvedOutcome(item: TicketsOverviewItem): ResolvedOutcome {
    if (item.closedBySelf === true || item.status === 'ClosedByClient') return 'closedBySelf';
    if (item.status === 'ClosedByAdmin') return 'closedByAdmin';
    return 'resolvedByAgent';
  }

  mapTicketStatus(status: string | number): ComplaintStatus {
    const byName: Record<string, ComplaintStatus> = {
      'New':                'new',
      'PendingAdminReply':  'pending',
      'WaitingMerchant':    'in_progress',
      'Resolved':           'resolved',
      'Closed':             'closed',
    };
    const byNum: Record<number, ComplaintStatus> = {
      1: 'new', 2: 'pending', 3: 'in_progress', 4: 'resolved', 5: 'closed',
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
