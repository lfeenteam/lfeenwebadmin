import { ChangeDetectorRef, Component, DestroyRef, computed, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { BookingService } from './services/booking.service';
import { Booking, BookingApiStatus, BookingListResponse, BookingOrigin, BookingStats, BOOKINGS_PAGE_SIZE, BOOKING_ORIGIN_OPTIONS, BOOKING_STATUS_OPTIONS } from './interfaces/booking.model';
import { SingleDateCalendarComponent } from './components/single-date-calendar/single-date-calendar.component';
import { BookingDetailDrawerComponent } from './components/booking-detail-drawer/booking-detail-drawer.component';
import { ChangeUnitDialogComponent } from './components/change-unit-dialog/change-unit-dialog.component';
import { CancelBookingDialogComponent } from './components/cancel-booking-dialog/cancel-booking-dialog.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { LoginService } from '../../services/login/login.service';
import { ReviewReportsComponent, ReviewReportsCount } from './components/review-reports/review-reports.component';
import { BOOKING_REVIEW_PERMISSIONS, hasBookingPermission } from './interfaces/review-report.model';

/** Page-level view; the reported-reviews queue lives at ?tab=reviews. */
type BookingsView = 'bookings' | 'reviews';

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
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule, SingleDateCalendarComponent, BookingDetailDrawerComponent, DashboardLoadingComponent, ReviewReportsComponent],
  // Dialog components are opened imperatively via MatDialog, so they are not
  // listed in `imports`.
  templateUrl: './all-bookings.component.html',
  styleUrl: './all-bookings.component.scss',
})
export class AllBookingsComponent implements OnInit {
  private translate = inject(TranslateService);
  private cdr       = inject(ChangeDetectorRef);
  private bookingService = inject(BookingService);
  private toastr    = inject(ToastrService);
  private dialog    = inject(MatDialog);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private loginService = inject(LoginService);

  // ── Reported reviews tab ──────────────────────────────────────────────────
  readonly canViewReviews = computed(() =>
    hasBookingPermission(this.loginService.permissions(), BOOKING_REVIEW_PERMISSIONS.view));
  readonly canModerateReviews = computed(() =>
    hasBookingPermission(this.loginService.permissions(), BOOKING_REVIEW_PERMISSIONS.moderate));

  activeView: BookingsView = 'bookings';
  /** Tab badge; null until the queue has been fetched once. */
  reviewsCount: ReviewReportsCount | null = null;
  // The bookings list is only fetched while its tab is shown; a reload requested
  // meanwhile (e.g. a language switch) marks it stale for the next switch back.
  private bookingsStale = true;

  private searchSubject = new Subject<string>();
  // Every filter/paging change pushes here; switchMap cancels any in-flight
  // request so a slow earlier response can never overwrite a newer one.
  private reload$ = new Subject<void>();

  currentLang = this.translate.currentLang || this.translate.defaultLang || 'ar';
  currentDir: 'rtl' | 'ltr' = this.currentLang === 'en' ? 'ltr' : 'rtl';

  searchQuery   = '';
  checkInDate   = '';
  checkOutDate  = '';
  selectedStatus: BookingApiStatus | 'all' = 'all';
  selectedOrigin: BookingOrigin | 'all' = 'all';
  currentPage   = 1;
  pageSize      = BOOKINGS_PAGE_SIZE;

  loading  = false;
  bookings: Booking[] = [];
  totalCount = 0;
  totalPages = 1;
  private stats: BookingStats | null = null;

  displayedColumns = ['bookingNumber', 'client', 'unit', 'dates', 'amount', 'status', 'action'];

  statusOptions = BOOKING_STATUS_OPTIONS;
  originOptions = BOOKING_ORIGIN_OPTIONS;

  mobileFilterOpen = false;

  toggleMobileFilter(): void {
    this.mobileFilterOpen = !this.mobileFilterOpen;
  }

  closeMobileFilter(): void {
    this.mobileFilterOpen = false;
  }

  // ── Booking detail drawer ─────────────────────────────────────────────────
  detailDrawerOpen = false;
  selectedBookingId: string | null = null;

  openBookingDetail(bookingId: string): void {
    this.selectedBookingId = bookingId;
    this.detailDrawerOpen = true;
  }

  closeBookingDetail(): void {
    this.detailDrawerOpen = false;
  }

  // ── Change unit dialog ────────────────────────────────────────────────────
  openChangeUnit(booking: Booking): void {
    const dialogRef = this.dialog.open(ChangeUnitDialogComponent, {
      width: '512px',
      maxWidth: '95vw',
      panelClass: 'change-unit-dialog-panel',
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        currentUnitId: booking.unit.id,
      },
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changed: boolean | undefined) => {
        // The dialog performs the change-unit request and its own toast; just
        // refresh the list when it reports success.
        if (changed) this.reload();
      });
  }

  // ── Cancel booking dialog ────────────────────────────────────────────────
  openCancelBooking(booking: Booking): void {
    const dialogRef = this.dialog.open(CancelBookingDialogComponent, {
      width: '512px',
      maxWidth: '95vw',
      panelClass: 'cancel-booking-dialog-panel',
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
      },
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cancelled: boolean | undefined) => {
        // The dialog performs the cancel request and its own toast; just refresh
        // the list when it reports success.
        if (cancelled) this.reload();
      });
  }

  ngOnInit(): void {
    this.readQueryParams();

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ lang }) => {
        this.currentLang = lang;
        this.currentDir  = lang === 'en' ? 'ltr' : 'rtl';
        // Property/unit/city text comes back localized by the server based on the
        // Accept-Language header, so a lang switch needs a refetch to pick it up.
        this.reload();
      });

    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.searchQuery = term;
        this.currentPage = 1;
        this.reload();
      });

    this.reload$
      .pipe(
        tap(() => {
          this.loading = true;
          this.syncQueryParams();
          this.cdr.markForCheck();
        }),
        switchMap(() => this.bookingService.getBookings({
          pageNumber: this.currentPage,
          pageSize: this.pageSize,
          search: this.searchQuery.trim() || undefined,
          status: this.selectedStatus !== 'all' ? this.selectedStatus : undefined,
          origin: this.selectedOrigin !== 'all' ? this.selectedOrigin : undefined,
          checkInDate: this.checkInDate || undefined,
          checkOutDate: this.checkOutDate || undefined,
        }).pipe(
          catchError(() => {
            this.toastr.error(this.translate.instant('d3.toast.errorOp'));
            return of(null);
          })
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: BookingListResponse | null) => {
        if (res) {
          this.bookings = res.data.map(item => this.bookingService.mapApiItemToBooking(item, this.currentLang));
          this.totalCount = res.totalCount;
          this.totalPages = Math.max(1, res.totalPages);
          this.stats = res.stats;
        } else {
          this.bookings = [];
          this.totalCount = 0;
          this.totalPages = 1;
          this.stats = null;
        }
        this.loading = false;
        this.cdr.markForCheck();
      });

    this.reload();

    // On the bookings tab the queue component isn't mounted, so fetch once for the badge.
    if (this.activeView === 'bookings') this.loadReviewsCount();
  }

  private reload(): void {
    if (this.activeView !== 'bookings') {
      this.bookingsStale = true;
      return;
    }
    this.bookingsStale = false;
    this.reload$.next();
  }

  // ── Page tabs ─────────────────────────────────────────────────────────────
  setView(view: BookingsView): void {
    if (view === this.activeView) return;
    if (view === 'reviews' && !this.canViewReviews()) return;
    this.activeView = view;
    this.closeMobileFilter();
    // reload() syncs the query params itself — one navigation either way, so two
    // back-to-back 'merge' navigations can't race each other over `tab`.
    if (view === 'bookings' && this.bookingsStale) this.reload();
    else this.syncQueryParams();
  }

  onReviewsCountChange(count: ReviewReportsCount): void {
    this.reviewsCount = count;
    this.cdr.markForCheck();
  }

  private loadReviewsCount(): void {
    if (!this.canViewReviews()) return;
    this.bookingService.getReviewReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => this.onReviewsCountChange({
          total: items.length,
          highPriority: items.filter(i => i.isHighPriority).length,
        }),
        error: () => { /* badge simply stays hidden */ },
      });
  }

  reviewsBadge(): string {
    return formatLocalizedNumber(this.reviewsCount?.total ?? 0, this.currentLang);
  }

  // ── Query-param sync ─────────────────────────────────────────────────────
  private readQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;

    if (qp.get('tab') === 'reviews' && this.canViewReviews()) this.activeView = 'reviews';

    this.searchQuery = qp.get('q') ?? '';
    this.checkInDate = qp.get('checkIn') ?? '';
    this.checkOutDate = qp.get('checkOut') ?? '';

    const status = qp.get('status');
    if (status && this.statusOptions.some(o => o.value === status)) {
      this.selectedStatus = status as BookingApiStatus;
    }

    const origin = qp.get('origin');
    if (origin && this.originOptions.some(o => o.value === origin)) {
      this.selectedOrigin = origin as BookingOrigin;
    }

    const page = Number(qp.get('page'));
    if (Number.isInteger(page) && page >= 1) this.currentPage = page;
  }

  private syncQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeView === 'reviews' ? 'reviews' : null,
        q: this.searchQuery.trim() || null,
        status: this.selectedStatus !== 'all' ? this.selectedStatus : null,
        origin: this.selectedOrigin !== 'all' ? this.selectedOrigin : null,
        checkIn: this.checkInDate || null,
        checkOut: this.checkOutDate || null,
        page: this.currentPage > 1 ? this.currentPage : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
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
    return formatLocalizedNumber(value, this.currentLang);
  }

  trackByBookingId(_index: number, booking: Booking): string {
    return booking.id;
  }

  get pagedBookings(): Booking[] {
    return this.bookings;
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages, 2);
  }

  get paginationSummary(): string {
    const start = this.totalCount === 0 ? 0 : Math.min((this.currentPage - 1) * this.pageSize + 1, this.totalCount);
    const end   = Math.min(this.currentPage * this.pageSize, this.totalCount);
    const locale = this.currentLang === 'en' ? 'en-US' : 'ar-SA';
    return this.currentDir === 'rtl'
      ? `عرض ${start.toLocaleString(locale)} - ${end.toLocaleString(locale)} من أصل ${this.totalCount.toLocaleString(locale)} حجز`
      : `Showing ${start.toLocaleString(locale)} - ${end.toLocaleString(locale)} of ${this.totalCount.toLocaleString(locale)} bookings`;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.reload();
  }

  onSearch(q: string): void {
    this.searchSubject.next(q);
  }

  onStatusChange(status: BookingApiStatus | 'all'): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.reload();
  }

  onOriginChange(origin: BookingOrigin | 'all'): void {
    this.selectedOrigin = origin;
    this.currentPage = 1;
    this.reload();
  }

  get hasActiveFilters(): boolean {
    return !!this.searchQuery.trim() || !!this.checkInDate || !!this.checkOutDate
      || this.selectedStatus !== 'all';
  }

  clearFilters(): void {
    if (!this.hasActiveFilters) return;
    this.searchQuery = '';
    this.checkInDate = '';
    this.checkOutDate = '';
    this.selectedStatus = 'all';
    this.currentPage = 1;
    this.reload();
  }

  onCheckInSelect(date: string): void {
    this.checkInDate = date;
    // Keep the range coherent: a check-out that now sits before check-in is dropped.
    if (this.checkOutDate && this.checkOutDate < date) {
      this.checkOutDate = '';
      this.toastr.info(this.translate.instant('d3.bookings.filters.checkOutClearedHint'));
    }
    this.currentPage = 1;
    this.reload();
  }

  onCheckOutSelect(date: string): void {
    if (this.checkInDate && date < this.checkInDate) {
      this.toastr.error(this.translate.instant('d3.bookings.filters.dateRangeError'));
      return;
    }
    this.checkOutDate = date;
    this.currentPage = 1;
    this.reload();
  }

  selectedStatusLabel(): string {
    const opt = this.statusOptions.find(o => o.value === this.selectedStatus);
    return this.translate.instant(opt?.labelKey ?? 'd3.bookings.status.all');
  }

  displayPage(page: number | '...'): string {
    if (page === '...') return '...';
    return page.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA');
  }
}
