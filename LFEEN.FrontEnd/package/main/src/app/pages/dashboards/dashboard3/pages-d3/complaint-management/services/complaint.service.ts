import { Injectable, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ChatMessage, Complaint } from '../interfaces/complaint.model';

const MOCK_DATA: Complaint[] = [
  {
    id: '1',
    clientName: 'سارة القحطاني',
    clientNameEn: 'Sarah Al-Qahtani',
    clientInitials: 'SQ',
    clientCode: 'G-2488',
    status: 'new',
    date: 'منذ 5 ساعات',
    dateEn: '5 hours ago',
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
    id: '2',
    clientName: 'محمد العتيبي',
    clientNameEn: 'Mohammed Al-Otaibi',
    clientInitials: 'MA',
    clientCode: 'G-1922',
    status: 'in_progress',
    date: 'منذ ساعتين',
    dateEn: '2 hours ago',
    type: 'customer',
    resolved: false,
    messages: []
  },
  {
    id: '3',
    clientName: 'فهد الحارثي',
    clientNameEn: 'Fahad Al-Harthi',
    clientInitials: 'FH',
    clientCode: 'G-3301',
    status: 'closed',
    date: 'أمس 4:30 م',
    dateEn: 'Yesterday 4:30 PM',
    type: 'customer',
    resolved: false,
    messages: []
  },
  {
    id: '4',
    clientName: 'نورة الرويلي',
    clientNameEn: 'Noura Al-Ruwaili',
    clientInitials: 'NA',
    clientCode: 'G-5509',
    status: 'in_progress',
    date: 'أمس 9:15 ص',
    dateEn: 'Yesterday 9:15 AM',
    type: 'customer',
    resolved: false,
    messages: []
  },
  {
    id: '5',
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
    clientName: 'ريم العتيبي',
    clientNameEn: 'Reem Al-Otaibi',
    clientInitials: 'RA',
    clientCode: 'G-7741',
    status: 'closed',
    date: 'منذ يومين',
    dateEn: '2 days ago',
    type: 'customer',
    resolved: true,
    messages: []
  },
  {
    id: '8',
    clientName: 'بندر الشهري',
    clientNameEn: 'Bandar Al-Shahri',
    clientInitials: 'BS',
    clientCode: 'H-4410',
    status: 'closed',
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

  resolveComplaint(id: string): Observable<void> {
    this._complaints.update(list =>
      list.map(c => c.id === id ? { ...c, resolved: true, status: 'closed' as const } : c)
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
