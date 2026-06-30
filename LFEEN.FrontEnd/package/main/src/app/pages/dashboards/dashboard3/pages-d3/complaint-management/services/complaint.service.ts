import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, delay, map, of } from 'rxjs';
import { ChatMessage, Complaint, ComplaintStatus, ReplyRequest, Ticket, TicketActionResult, TicketDetail, TicketListResponse, UpdateStatusRequest } from '../interfaces/complaint.model';
import { environment } from 'src/environments/environment';

const MOCK_DATA: Complaint[] = [
  {
    id: '9',
    ticketId: 'T-8842',
    clientName: 'فهد السيف',
    clientNameEn: 'Fahad Al-Sayf',
    clientInitials: 'FS',
    clientCode: 'G-2488',
    status: 'new',
    date: 'منذ ١٠ دقائق',
    dateEn: '10 minutes ago',
    type: 'customer',
    resolved: false,
    messages: [
      {
        id: 'm1',
        senderRole: 'client',
        senderName: 'فهد السيف',
        senderNameEn: 'Fahad Al-Sayf',
        content: 'السلام عليكم فريق ألفين. عندي مشكلة في تحديث الأسعار لشهر نوفمبر. قمت بتغيير السعر في تطبيق المضيفين، ولكن لا يظهر التغيير في نتائج البحث. أرجو المساعدة فوراً لأن هذا يؤثر على الحجوزات القادمة.',
        contentEn: 'Hello LFEEN team. I have a problem updating prices for November. I changed the price in the host app but the change does not appear in search results. Please help urgently as this is affecting upcoming bookings.',
        timestamp: '٩:٩١ م',
        timestampEn: '9:10 PM'
      },
      {
        id: 'm2',
        senderRole: 'bot',
        senderName: 'فريق الدعم',
        senderNameEn: 'Support',
        content: 'وعليكم السلام أستاذ فهد، نعتذر عن هذا الإزعاج. جاري مراجعة المشكلة من خلال فريقنا التقني، وفي حال المزامنة الضرورية سنقوم بالاتفاق معك على حل خلال أقل من ساعة.',
        contentEn: 'Hello Fahad, we apologize for the inconvenience. Our technical team is reviewing the issue and we will agree on a solution with you within less than an hour.',
        timestamp: '٩:٧١ م',
        timestampEn: '9:17 PM'
      }
    ]
  },
  {
    id: '2',
    ticketId: 'T-8839',
    clientName: 'محمد العتيبي',
    clientNameEn: 'Mohammed Al-Otaibi',
    clientInitials: 'MA',
    clientCode: 'G-1922',
    status: 'new',
    date: 'منذ ساعتين',
    dateEn: '2 hours ago',
    type: 'customer',
    resolved: false,
    messages: []
  },
  {
    id: '1',
    ticketId: 'T-8835',
    clientName: 'سارة القحطاني',
    clientNameEn: 'Sarah Al-Qahtani',
    clientInitials: 'SQ',
    clientCode: 'G-3301',
    status: 'in_progress',
    date: 'أمس، ٤:٣٠ م',
    dateEn: 'Yesterday 4:30 PM',
    type: 'customer',
    resolved: false,
    messages: [
      {
        id: '1',
        senderRole: 'client',
        senderName: 'سارة القحطاني',
        senderNameEn: 'Sarah Al-Qahtani',
        content: 'السلام عليكم لم يتم استرداد مبلغ التأمين حتى الآن رغم مرور 24 ساعة على المغادرة من شقة بناج.',
        contentEn: 'Hello, the insurance deposit has not been refunded yet, although 24 hours have passed since leaving the Benaj apartment.',
        timestamp: '9:10 م',
        timestampEn: '9:10 PM'
      },
      {
        id: '2',
        senderRole: 'bot',
        senderName: 'فريق الدعم',
        senderNameEn: 'Support',
        content: 'وعليكم السلام يا سارة، نعتذر عن التأخير. جاري التحقق من حالة الوحدة مع المضيف فوراً وسيتم الرد عليك خلال ساعة.',
        contentEn: 'Hello Sarah, we apologize for the delay. We are checking the unit status with the host now and will reply within an hour.',
        timestamp: '9:17 م',
        timestampEn: '9:17 PM'
      },
      {
        id: '3',
        senderRole: 'client',
        senderName: 'سارة القحطاني',
        senderNameEn: 'Sarah Al-Qahtani',
        content: 'شكراً جزيلاً لسرعة الرد بانتظاركم.',
        contentEn: 'Thank you for the quick response. I will be waiting.',
        timestamp: '9:15 م',
        timestampEn: '9:15 PM'
      }
    ]
  },
  {
    id: '4',
    ticketId: 'T-8830',
    clientName: 'نورة الرويلي',
    clientNameEn: 'Noura Al-Ruwaili',
    clientInitials: 'NR',
    clientCode: 'G-5509',
    status: 'in_progress',
    date: 'أمس، ٩:١٥ ص',
    dateEn: 'Yesterday 9:15 AM',
    type: 'customer',
    resolved: false,
    messages: []
  },
  {
    id: '3',
    ticketId: 'T-8826',
    clientName: 'فهد الحارثي',
    clientNameEn: 'Fahad Al-Harthi',
    clientInitials: 'FH',
    clientCode: 'G-4412',
    status: 'new',
    date: 'منذ 4 ساعات',
    dateEn: '4 hours ago',
    type: 'customer',
    resolved: false,
    messages: []
  },
  {
    id: '5',
    ticketId: 'T-8820',
    clientName: 'خالد العمري',
    clientNameEn: 'Khaled Al-Omari',
    clientInitials: 'KA',
    clientCode: 'H-1122',
    status: 'new',
    date: 'منذ 3 ساعات',
    dateEn: '3 hours ago',
    type: 'host',
    resolved: false,
    messages: []
  },
  {
    id: '6',
    ticketId: 'T-8815',
    clientName: 'منى السلمي',
    clientNameEn: 'Mona Al-Sulami',
    clientInitials: 'MS',
    clientCode: 'H-2233',
    status: 'in_progress',
    date: 'أمس 2:00 م',
    dateEn: 'Yesterday 2:00 PM',
    type: 'host',
    resolved: false,
    messages: []
  },
  {
    id: '7',
    ticketId: 'T-8800',
    clientName: 'سارة القحطاني',
    clientNameEn: 'Sarah Al-Qahtani',
    clientInitials: 'SQ',
    clientCode: 'G-2488',
    status: 'replied',
    date: 'منذ يومين',
    dateEn: '2 days ago',
    type: 'customer',
    resolved: true,
    subject: 'استرداد مبلغ التأمين لم يتم',
    subjectEn: 'Insurance deposit was not refunded',
    replyDate: '١٤ أكتوبر، ٩:٤٥ ص',
    replyDateEn: 'Oct 14, 9:45 AM',
    messages: [
      {
        id: 'r1',
        senderRole: 'client',
        senderName: 'سارة القحطاني',
        senderNameEn: 'Sarah Al-Qahtani',
        content: 'السلام عليكم لم يتم استرداد مبلغ التأمين حتى الآن رغم مرور 24 ساعة على المغادرة.',
        contentEn: 'Hello, the insurance deposit has not been refunded yet, although 24 hours have passed since checkout.',
        timestamp: '٩:١٠ ص',
        timestampEn: '9:10 AM'
      },
      {
        id: 'r2',
        senderRole: 'support',
        senderName: 'فريق الدعم',
        senderNameEn: 'Support',
        content: 'تم استرداد المبلغ بالكامل، يرجى التحقق من حسابك خلال 24 ساعة.',
        contentEn: 'The full amount has been refunded. Please check your account within 24 hours.',
        timestamp: '٩:٤٥ ص',
        timestampEn: '9:45 AM'
      }
    ]
  },
  {
    id: '8',
    ticketId: 'T-8795',
    clientName: 'محمد العتيبي',
    clientNameEn: 'Mohammed Al-Otaibi',
    clientInitials: 'MA',
    clientCode: 'G-1922',
    status: 'replied',
    date: 'منذ 3 أيام',
    dateEn: '3 days ago',
    type: 'host',
    resolved: true,
    subject: 'مشكلتي في الدخول للوحدة (الفعل)',
    subjectEn: 'Problem accessing the unit (actual)',
    replyDate: '١٤ أكتوبر، ٨:١ ص',
    replyDateEn: 'Oct 14, 8:01 AM',
    messages: []
  },
  {
    id: '10',
    ticketId: 'T-8790',
    clientName: 'فهد الحارثي',
    clientNameEn: 'Fahad Al-Harthi',
    clientInitials: 'FH',
    clientCode: 'G-3301',
    status: 'replied',
    date: 'منذ 4 أيام',
    dateEn: '4 days ago',
    type: 'customer',
    resolved: true,
    subject: 'تأخري في استلام المفاتيح',
    subjectEn: 'Delay in receiving the keys',
    replyDate: '١٣ أكتوبر، ٥:٣٠ م',
    replyDateEn: 'Oct 13, 5:30 PM',
    messages: []
  },
  {
    id: '11',
    ticketId: 'T-8785',
    clientName: 'نورة الرويلي',
    clientNameEn: 'Noura Al-Ruwaili',
    clientInitials: 'NR',
    clientCode: 'G-5509',
    status: 'replied',
    date: 'منذ 4 أيام',
    dateEn: '4 days ago',
    type: 'customer',
    resolved: true,
    subject: 'تغيير موعد الحجز',
    subjectEn: 'Change booking date',
    replyDate: '١٣ أكتوبر، ٩:١٥ ص',
    replyDateEn: 'Oct 13, 9:15 AM',
    messages: []
  },
  {
    id: '12',
    ticketId: 'T-8780',
    clientName: 'خالد المنصور',
    clientNameEn: 'Khaled Al-Mansour',
    clientInitials: 'KM',
    clientCode: 'G-4412',
    status: 'replied',
    date: 'منذ 5 أيام',
    dateEn: '5 days ago',
    type: 'host',
    resolved: true,
    subject: 'طلب صيانة طارئة للمكيف',
    subjectEn: 'Emergency AC maintenance request',
    replyDate: '١٢ أكتوبر، ١١:٢ ص',
    replyDateEn: 'Oct 12, 11:02 AM',
    messages: []
  },
  {
    id: '13',
    ticketId: 'T-8775',
    clientName: 'ريم عبدالله',
    clientNameEn: 'Reem Abdullah',
    clientInitials: 'RA',
    clientCode: 'G-7714',
    status: 'replied',
    date: 'منذ أسبوع',
    dateEn: '1 week ago',
    type: 'customer',
    resolved: true,
    subject: 'شكوى من ضيفيني في المعر',
    subjectEn: 'Complaint about guests in the unit',
    replyDate: '١١ أكتوبر، ٣:٤٦ م',
    replyDateEn: 'Oct 11, 3:46 PM',
    messages: []
  }
];

@Injectable({ providedIn: 'root' })
export class ComplaintService {
  private http = inject(HttpClient);
  private _complaints = signal<Complaint[]>(MOCK_DATA);

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
