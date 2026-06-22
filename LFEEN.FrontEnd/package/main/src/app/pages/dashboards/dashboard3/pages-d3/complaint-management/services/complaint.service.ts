import { Injectable, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ChatMessage, Complaint } from '../interfaces/complaint.model';

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
    clientName: 'ريم العتيبي',
    clientNameEn: 'Reem Al-Otaibi',
    clientInitials: 'RA',
    clientCode: 'G-7741',
    status: 'replied',
    date: 'منذ يومين',
    dateEn: '2 days ago',
    type: 'customer',
    resolved: true,
    messages: []
  },
  {
    id: '8',
    ticketId: 'T-8795',
    clientName: 'بندر الشهري',
    clientNameEn: 'Bandar Al-Shahri',
    clientInitials: 'BS',
    clientCode: 'H-4410',
    status: 'replied',
    date: 'منذ 3 أيام',
    dateEn: '3 days ago',
    type: 'host',
    resolved: true,
    messages: []
  }
];

@Injectable({ providedIn: 'root' })
export class ComplaintService {
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
}
