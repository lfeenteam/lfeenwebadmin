import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { Subscription } from 'rxjs';

export type BookingStatus = 'confirmed' | 'checked_in' | 'awaiting_checkin' | 'awaiting_checkout';

export interface Booking {
  id: string;
  bookingNumber: string;
  client: { name: string; phone: string; initials: string; colorIndex: number };
  unit: { name: string; property: string; location: string };
  checkIn: Date;
  checkOut: Date;
  amount: number;
  status: BookingStatus;
}

interface MetricCard {
  titleKey: string;
  value: string;
  icon: string;
  tone: 'green' | 'gray' | 'black' | 'orange';
  isCurrency?: boolean;
}

@Component({
  selector: 'app-all-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './all-bookings.component.html',
  styleUrl: './all-bookings.component.scss'
})
export class AllBookingsComponent implements OnInit, OnDestroy {
  private translate = inject(TranslateService);
  private cdr       = inject(ChangeDetectorRef);
  private langSub?: Subscription;

  currentLang = this.translate.currentLang || this.translate.defaultLang || 'ar';
  currentDir: 'rtl' | 'ltr' = this.currentLang === 'en' ? 'ltr' : 'rtl';

  searchQuery   = '';
  checkInDate   = '';
  checkOutDate  = '';
  selectedStatus: BookingStatus | 'all' = 'all';
  currentPage   = 1;
  pageSize      = 10;

  metrics: MetricCard[] = [
    { titleKey: 'd3.bookings.cards.totalBookings',   value: '١,٢٤٨', icon: 'calendar',       tone: 'black'  },
    { titleKey: 'd3.bookings.cards.confirmed',        value: '٨٤٢',   icon: 'circle-check',   tone: 'green'  },
    { titleKey: 'd3.bookings.cards.awaitingArrival',  value: '١٥٦',   icon: 'clock-hour-3',   tone: 'orange' },
    { titleKey: 'd3.bookings.cards.todayRevenue',     value: '١٢,٤٥٠',    icon: 'coin',      tone: 'black', isCurrency: true },
  ];

  allBookings: Booking[] = [
    {
      id: '1', bookingNumber: '#BK-BB421',
      client: { name: 'أحمد العتيبي',   phone: '+966 50 123 ****', initials: 'أع', colorIndex: 0 },
      unit:   { name: 'وحدة 250', property: 'برج الحمد - الدمام', location: 'الدمام' },
      checkIn:  new Date('2024-10-14'), checkOut: new Date('2024-10-18'),
      amount: 2450, status: 'confirmed'
    },
    {
      id: '2', bookingNumber: '#BK-BB422',
      client: { name: 'سارة القحطاني', phone: '+966 55 987 ****', initials: 'سق', colorIndex: 1 },
      unit:   { name: 'وحدة 250', property: 'برج الحمد - الدمام', location: 'الدمام' },
      checkIn:  new Date('2024-10-12'), checkOut: new Date('2024-10-16'),
      amount: 2450, status: 'checked_in'
    },
    {
      id: '3', bookingNumber: '#BK-BB423',
      client: { name: 'فهد الحربي',     phone: '+966 54 456 ****', initials: 'فح', colorIndex: 2 },
      unit:   { name: 'وحدة 250', property: 'برج الحمد - الدمام', location: 'الدمام' },
      checkIn:  new Date('2024-10-15'), checkOut: new Date('2024-10-20'),
      amount: 2450, status: 'awaiting_checkin'
    },
    {
      id: '4', bookingNumber: '#BK-BB424',
      client: { name: 'نورة الشهري',    phone: '+966 56 789 ****', initials: 'نش', colorIndex: 3 },
      unit:   { name: 'وحدة 250', property: 'برج الحمد - الدمام', location: 'الدمام' },
      checkIn:  new Date('2024-10-01'), checkOut: new Date('2024-10-14'),
      amount: 2450, status: 'awaiting_checkout'
    },
    {
      id: '5', bookingNumber: '#BK-BB425',
      client: { name: 'خالد المطيري',   phone: '+966 55 321 ****', initials: 'خم', colorIndex: 4 },
      unit:   { name: 'وحدة 310', property: 'برج الأندلس - الرياض', location: 'الرياض' },
      checkIn:  new Date('2024-10-20'), checkOut: new Date('2024-10-25'),
      amount: 3200, status: 'confirmed'
    },
    {
      id: '6', bookingNumber: '#BK-BB426',
      client: { name: 'منى السبيعي',    phone: '+966 50 654 ****', initials: 'من', colorIndex: 0 },
      unit:   { name: 'وحدة 115', property: 'مجمع الأمير - جدة', location: 'جدة' },
      checkIn:  new Date('2024-10-18'), checkOut: new Date('2024-10-22'),
      amount: 1800, status: 'confirmed'
    },
    {
      id: '7', bookingNumber: '#BK-BB427',
      client: { name: 'عبدالله الغامدي', phone: '+966 54 112 ****', initials: 'عغ', colorIndex: 1 },
      unit:   { name: 'وحدة 88',  property: 'برج الحمد - الدمام', location: 'الدمام' },
      checkIn:  new Date('2024-10-10'), checkOut: new Date('2024-10-13'),
      amount: 1500, status: 'awaiting_checkout'
    },
    {
      id: '8', bookingNumber: '#BK-BB428',
      client: { name: 'ريم العمري',     phone: '+966 56 443 ****', initials: 'رع', colorIndex: 2 },
      unit:   { name: 'وحدة 45',  property: 'برج الأندلس - الرياض', location: 'الرياض' },
      checkIn:  new Date('2024-10-22'), checkOut: new Date('2024-10-27'),
      amount: 2100, status: 'awaiting_checkin'
    },
    {
      id: '9', bookingNumber: '#BK-BB429',
      client: { name: 'سلطان الزهراني', phone: '+966 55 778 ****', initials: 'سز', colorIndex: 3 },
      unit:   { name: 'وحدة 200', property: 'مجمع الأمير - جدة', location: 'جدة' },
      checkIn:  new Date('2024-10-16'), checkOut: new Date('2024-10-19'),
      amount: 2750, status: 'checked_in'
    },
    {
      id: '10', bookingNumber: '#BK-BB430',
      client: { name: 'هنوف الدوسري',  phone: '+966 54 990 ****', initials: 'هد', colorIndex: 4 },
      unit:   { name: 'وحدة 175', property: 'برج الحمد - الدمام', location: 'الدمام' },
      checkIn:  new Date('2024-10-25'), checkOut: new Date('2024-10-30'),
      amount: 3500, status: 'confirmed'
    },
    {
      id: '11', bookingNumber: '#BK-BB431',
      client: { name: 'محمد الشمري',   phone: '+966 50 211 ****', initials: 'مش', colorIndex: 0 },
      unit:   { name: 'وحدة 320', property: 'برج الأندلس - الرياض', location: 'الرياض' },
      checkIn:  new Date('2024-10-28'), checkOut: new Date('2024-11-02'),
      amount: 4100, status: 'awaiting_checkin'
    },
    {
      id: '12', bookingNumber: '#BK-BB432',
      client: { name: 'فاطمة الحربي',  phone: '+966 55 566 ****', initials: 'فح', colorIndex: 1 },
      unit:   { name: 'وحدة 60',  property: 'مجمع الأمير - جدة', location: 'جدة' },
      checkIn:  new Date('2024-10-05'), checkOut: new Date('2024-10-08'),
      amount: 1200, status: 'awaiting_checkout'
    }
  ];

  displayedColumns = ['bookingNumber', 'client', 'unit', 'dates', 'amount', 'status', 'action'];

  statusOptions: { value: BookingStatus | 'all'; labelKey: string }[] = [
    { value: 'all',              labelKey: 'd3.bookings.status.all'             },
    { value: 'confirmed',        labelKey: 'd3.bookings.status.confirmed'        },
    { value: 'checked_in',       labelKey: 'd3.bookings.status.checkedIn'        },
    { value: 'awaiting_checkin', labelKey: 'd3.bookings.status.awaitingCheckin'  },
    { value: 'awaiting_checkout',labelKey: 'd3.bookings.status.awaitingCheckout' },
  ];

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(({ lang }) => {
      this.currentLang = lang;
      this.currentDir  = lang === 'en' ? 'ltr' : 'rtl';
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  get filteredBookings(): Booking[] {
    let result = this.allBookings;

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(b =>
        b.bookingNumber.toLowerCase().includes(q) ||
        b.client.name.includes(q) ||
        b.client.phone.includes(q) ||
        b.unit.property.includes(q)
      );
    }

    if (this.selectedStatus !== 'all') {
      result = result.filter(b => b.status === this.selectedStatus);
    }

    if (this.checkInDate) {
      const d = new Date(this.checkInDate);
      result = result.filter(b => b.checkIn >= d);
    }

    if (this.checkOutDate) {
      const d = new Date(this.checkOutDate);
      result = result.filter(b => b.checkOut <= d);
    }

    return result;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBookings.length / this.pageSize));
  }

  get totalCount(): number {
    return this.filteredBookings.length;
  }

  get pagedBookings(): Booking[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredBookings.slice(start, start + this.pageSize);
  }

  get visiblePages(): (number | '...')[] {
    const n = this.totalPages;
    const c = this.currentPage;
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    if (c <= 4)     return [1, 2, 3, 4, '...', n - 1, n];
    if (c >= n - 3) return [1, 2, '...', n - 3, n - 2, n - 1, n];
    return [1, 2, '...', c, '...', n - 1, n];
  }

  get paginationSummary(): string {
    const start = Math.min((this.currentPage - 1) * this.pageSize + 1, this.totalCount);
    const end   = Math.min(this.currentPage * this.pageSize, this.totalCount);
    return `عرض ${start} - ${end} من أصل ${this.totalCount} حجز`;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  onSearch(q: string): void {
    this.searchQuery = q;
    this.currentPage = 1;
  }

  onStatusChange(status: BookingStatus | 'all'): void {
    this.selectedStatus = status;
    this.currentPage = 1;
  }

  onDateChange(): void {
    this.currentPage = 1;
  }

  statusLabel(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      confirmed:          'مؤكد',
      checked_in:         'مسجل دخول',
      awaiting_checkin:   'بانتظار تسجيل الدخول',
      awaiting_checkout:  'بانتظار تسجيل الخروج',
    };
    return map[status];
  }

  selectedStatusLabel(): string {
    if (this.selectedStatus === 'all') return 'كل الحالات';
    return this.statusLabel(this.selectedStatus);
  }

  formatDate(date: Date): string {
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  formatAmount(amount: number): string {
    return `﷼ ${amount.toLocaleString('ar-SA')}`;
  }

  formatAmountNumber(amount: number): string {
    return amount.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA');
  }

  displayPage(page: number | '...'): string {
    return page === '...' ? '...' : String(page);
  }
}
