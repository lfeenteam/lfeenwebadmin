import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { ToastrService } from 'ngx-toastr';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { BookingService } from './services/booking.service';
import { Booking, BookingApiStatus, BookingStats, BOOKINGS_PAGE_SIZE, BOOKING_STATUS_OPTIONS, BookingStatus } from './interfaces/booking.model';
import { SingleDateCalendarComponent } from './components/single-date-calendar/single-date-calendar.component';

interface MetricCard {
  titleKey: string;
  value: string;
  icon: string;
  tone: 'green' | 'gray' | 'black' | 'orange';
  isCurrency?: boolean;
}

type BookingDetailTab = 'services' | 'log' | 'finance' | 'details';

interface BookingDetailStatic {
  number: string;
  status: BookingStatus;
  guest: {
    initials: string;
    colorIndex: number;
    name: string;
    phone: string;
    companionsCount: number;
    companions: string[];
  };
  unit: {
    number: string;
    type: string;
    location: string;
  };
  stay: {
    checkInDate: string;
    checkInTime: string;
    checkOutDate: string;
    checkOutTime: string;
    nights: number;
  };
  dateRangeLabel: string;
}

@Component({
  selector: 'app-all-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule, SingleDateCalendarComponent],
  templateUrl: './all-bookings.component.html',
  styleUrl: './all-bookings.component.scss'
})
export class AllBookingsComponent implements OnInit, OnDestroy {
  private translate = inject(TranslateService);
  private cdr       = inject(ChangeDetectorRef);
  private bookingService = inject(BookingService);
  private toastr    = inject(ToastrService);
  private langSub?: Subscription;
  private searchSub?: Subscription;
  private searchSubject = new Subject<string>();

  currentLang = this.translate.currentLang || this.translate.defaultLang || 'ar';
  currentDir: 'rtl' | 'ltr' = this.currentLang === 'en' ? 'ltr' : 'rtl';

  searchQuery   = '';
  checkInDate   = '';
  checkOutDate  = '';
  selectedStatus: BookingApiStatus | 'all' = 'all';
  currentPage   = 1;
  pageSize      = BOOKINGS_PAGE_SIZE;

  loading  = false;
  bookings: Booking[] = [];
  totalCount = 0;
  totalPages = 1;
  private stats: BookingStats | null = null;

  displayedColumns = ['bookingNumber', 'client', 'unit', 'dates', 'amount', 'status', 'action'];

  statusOptions = BOOKING_STATUS_OPTIONS;

  mobileFilterOpen = false;

  toggleMobileFilter(): void {
    this.mobileFilterOpen = !this.mobileFilterOpen;
  }

  closeMobileFilter(): void {
    this.mobileFilterOpen = false;
  }

  // ── Booking detail drawer (static mock data) ─────────────────────────────
  detailDrawerOpen = false;
  activeDetailTab: BookingDetailTab = 'details';

  readonly bookingDetail: BookingDetailStatic = {
    number: '#BK-88421',
    status: 'confirmed',
    guest: {
      initials: 'أع',
      colorIndex: 1,
      name: 'أحمد العتيبي',
      phone: '+966 50 123 ****',
      companionsCount: 2,
      companions: ['سلمى العتيبي', 'عبدالله العتيبي'],
    },
    unit: {
      number: '250 وحدة',
      type: 'شقة فندقية',
      location: 'برج الحمد، الدمام',
    },
    stay: {
      checkInDate: '14 أكتوبر 2024',
      checkInTime: '14:00',
      checkOutDate: '18 أكتوبر 2024',
      checkOutTime: '10:00',
      nights: 4,
    },
    dateRangeLabel: '14 أكتوبر 2024 — 18 أكتوبر 2024',
  };

  openBookingDetail(): void {
    this.activeDetailTab = 'details';
    this.detailDrawerOpen = true;
  }

  closeBookingDetail(): void {
    this.detailDrawerOpen = false;
  }

  setDetailTab(tab: BookingDetailTab): void {
    this.activeDetailTab = tab;
  }

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(({ lang }) => {
      this.currentLang = lang;
      this.currentDir  = lang === 'en' ? 'ltr' : 'rtl';
      this.cdr.detectChanges();
      // Property/unit/city text comes back localized by the server based on the
      // Accept-Language header, so a lang switch needs a refetch to pick it up.
      this.loadBookings();
    });

    this.searchSub = this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(term => {
        this.searchQuery = term;
        this.currentPage = 1;
        this.loadBookings();
      });

    this.loadBookings();
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.searchSub?.unsubscribe();
  }

  private loadBookings(): void {
    this.loading = true;
    this.bookingService.getBookings({
      pageNumber: this.currentPage,
      pageSize: this.pageSize,
      search: this.searchQuery.trim() || undefined,
      status: this.selectedStatus !== 'all' ? this.selectedStatus : undefined,
      checkInDate: this.checkInDate || undefined,
      checkOutDate: this.checkOutDate || undefined,
    }).subscribe({
      next: res => {
        this.bookings = res.data.map((item, i) => this.bookingService.mapApiItemToBooking(item, i % 5));
        this.totalCount = res.totalCount;
        this.totalPages = Math.max(1, res.totalPages);
        this.stats = res.stats;
        this.loading = false;
      },
      error: () => {
        this.bookings = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.loading = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  get metrics(): MetricCard[] {
    return [
      { titleKey: 'd3.bookings.cards.totalBookings',  value: this.formatMetricNumber(this.stats?.totalCount ?? 0),   icon: 'calendar',     tone: 'black' },
      { titleKey: 'd3.bookings.cards.confirmed',       value: this.formatMetricNumber(this.stats?.confirmedCount ?? 0), icon: 'circle-check', tone: 'green' },
      { titleKey: 'd3.bookings.cards.awaitingArrival', value: this.formatMetricNumber(this.stats?.awaitingArrivalCount ?? 0), icon: 'clock-hour-3', tone: 'orange' },
      { titleKey: 'd3.bookings.cards.todayRevenue',    value: this.formatMetricNumber(this.stats?.todayRevenue ?? 0), icon: 'coin', tone: 'black', isCurrency: true },
    ];
  }

  private formatMetricNumber(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA');
  }

  get pagedBookings(): Booking[] {
    return this.bookings;
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
    const start = this.totalCount === 0 ? 0 : Math.min((this.currentPage - 1) * this.pageSize + 1, this.totalCount);
    const end   = Math.min(this.currentPage * this.pageSize, this.totalCount);
    return this.currentDir === 'rtl'
      ? `عرض ${start} - ${end} من أصل ${this.totalCount} حجز`
      : `Showing ${start} - ${end} of ${this.totalCount} bookings`;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadBookings();
  }

  onSearch(q: string): void {
    this.searchSubject.next(q);
  }

  onStatusChange(status: BookingApiStatus | 'all'): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.loadBookings();
  }

  onDateChange(): void {
    this.currentPage = 1;
    this.loadBookings();
  }

  get hasActiveFilters(): boolean {
    return !!this.searchQuery.trim() || !!this.checkInDate || !!this.checkOutDate || this.selectedStatus !== 'all';
  }

  clearFilters(): void {
    if (!this.hasActiveFilters) return;
    this.searchQuery = '';
    this.checkInDate = '';
    this.checkOutDate = '';
    this.selectedStatus = 'all';
    this.currentPage = 1;
    this.loadBookings();
  }

  onCheckInSelect(date: string): void {
    this.checkInDate = date;
    this.onDateChange();
  }

  onCheckOutSelect(date: string): void {
    this.checkOutDate = date;
    this.onDateChange();
  }

  statusLabel(status: BookingStatus): string {
    const key = this.statusLabelKey(status);
    return key ? this.translate.instant(key) : '-';
  }

  private statusLabelKey(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      blocked:           'd3.bookings.status.blocked',
      cancelled:         'd3.bookings.status.cancelled',
      expired:           'd3.bookings.status.expired',
      no_show:           'd3.bookings.status.noShow',
      completed:         'd3.bookings.status.completed',
      awaiting_checkout: 'd3.bookings.status.awaitingCheckout',
      checked_in:        'd3.bookings.status.checkedIn',
      awaiting_checkin:  'd3.bookings.status.awaitingCheckin',
      awaiting_ack:      'd3.bookings.status.awaitingAck',
      confirmed:         'd3.bookings.status.confirmed',
      pending:           'd3.bookings.status.pending',
      on_hold:           'd3.bookings.status.onHold',
      unconfirmed:       'd3.bookings.status.unconfirmed',
      unknown:           'd3.bookings.status.unknown',
    };
    return map[status];
  }

  selectedStatusLabel(): string {
    const opt = this.statusOptions.find(o => o.value === this.selectedStatus);
    return this.translate.instant(opt?.labelKey ?? 'd3.bookings.status.all');
  }

  formatDate(date: Date | null): string {
    if (!date) return '-';
    const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const months = this.currentLang === 'en' ? monthsEn : monthsAr;
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  formatAmountNumber(amount: number): string {
    return amount.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA');
  }

  displayPage(page: number | '...'): string {
    return page === '...' ? '...' : String(page);
  }
}
