import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, delay, map, of } from 'rxjs';
import { AssignableEmployee, AssignableEmployeePage, AssignTicketRequest, ChatMessage, ClientTicket, ClientTicketDetail, ClientTicketListResponse, ClientTicketMessage, ClientTicketQueryParams, Complaint, ComplaintStatus, ReplyRequest, Ticket, TicketActionResult, TicketDetail, TicketListResponse, TicketsOverviewItem, TicketsOverviewQueryParams, TicketsOverviewResponse, UpdateStatusRequest } from '../interfaces/complaint.model';
import { PaginatedEmployeeResponse } from '../../../interfaces/department.model';
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
    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderRole: 'support',
      senderName: 'فريق الدعم',
      senderNameEn: 'Support',
      content,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      timestampEn: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    this._complaints.update(list =>
      list.map(c => c.id === complaintId
        ? { ...c, messages: [...c.messages, msg] }
        : c
      )
    );
    return of(undefined).pipe(delay(200));
  }

  sendClientTicketMessage(ticketId: string, body: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/client-tickets/${ticketId}/messages`, { body });
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

  sendTicketReply(ticketId: string, body: string): Observable<TicketActionResult> {
    const payload: ReplyRequest = { body, isInternalNote: false };
    return this.http.post<TicketActionResult>(
      `${environment.apiBaseUrl}/api/tickets/${ticketId}/replies`,
      payload
    );
  }

  getTickets(status?: number): Observable<Complaint[]> {
    let params = new HttpParams();
    if (status !== undefined) {
      params = params.set('status', status.toString());
    }
    return this.http
      .get<TicketListResponse>(`${environment.apiBaseUrl}/api/tickets`, { params })
      .pipe(map(res => res.data.map(t => this.mapTicketToComplaint(t))));
  }

  private mapTicketToComplaint(t: Ticket): Complaint {
    return {
      id: t.externalId,
      ticketId: t.ticketNumber,
      clientName: t.accountName,
      clientInitials: this.getInitials(t.accountName),
      clientCode: t.propertyName,
      status: this.mapTicketStatus(t.status),
      date: new Date(t.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
      dateEn: new Date(t.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      type: 'host',
      resolved: t.status === 5 || t.status === 'Closed' || t.status === 'Resolved',
      messages: [],
      subject: t.subject,
      assignedAdminUserId: t.assignedAdminUserId,
      assignedAdminName: t.assignedAdminName,
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

  assignTicket(ticketId: string, adminUserId: string, ticketType: 'customer' | 'host'): Observable<void> {
    const payload: AssignTicketRequest = { adminUserId };
    const resource = ticketType === 'customer' ? 'client-tickets' : 'tickets';
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/${resource}/${ticketId}/assign`, payload);
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
      ticketId: t.ticketNumber ?? '-',
      clientName,
      clientInitials: this.getInitials(clientName),
      clientCode: '-',
      status: this.mapClientTicketStatus(t.status),
      date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
      dateEn: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-',
      type: 'customer',
      resolved: t.status === 'Resolved' || t.status === 'Closed',
      messages: [],
      subject: t.subject ?? undefined,
      assignedAdminName: t.assignedAgentName,
    };
  }

  getClientTicketById(id: string): Observable<ClientTicketDetail> {
    return this.http.get<ClientTicketDetail>(`${environment.apiBaseUrl}/api/client-tickets/${id}`);
  }

  mapClientTicketDetailToComplaint(detail: ClientTicketDetail, fallback?: Complaint): Complaint {
    const clientMessage = detail.messages.find(m => m.senderType === 'Client');
    const clientName = clientMessage?.senderName || fallback?.clientName || '-';

    return {
      id: detail.externalId,
      ticketId: detail.ticketNumber,
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
      attachment: m.attachment
        ? { fileName: m.attachment.fileName, url: m.attachment.url, contentType: m.attachment.contentType }
        : null,
    };
  }

  mapClientTicketStatus(status: string): ComplaintStatus {
    const map: Record<string, ComplaintStatus> = {
      New:      'new',
      Open:     'new',
      Pending:  'pending',
      InProgress: 'in_progress',
      Resolved: 'replied',
      Closed:   'closed',
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
    return {
      id: item.externalId,
      ticketId: item.ticketNumber,
      clientName: item.userName,
      clientInitials: this.getInitials(item.userName),
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
