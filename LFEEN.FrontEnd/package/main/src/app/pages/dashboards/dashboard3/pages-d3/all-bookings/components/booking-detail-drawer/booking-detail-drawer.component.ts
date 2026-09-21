import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { BookingDetailApiItem, BookingStatus } from '../../interfaces/booking.model';
import { BookingService } from '../../services/booking.service';
import { BookingFinanceTabComponent } from '../booking-finance-tab/booking-finance-tab.component';
import { BookingServicesTabComponent } from '../booking-services-tab/booking-services-tab.component';
import { BookingLogTabComponent } from '../booking-log-tab/booking-log-tab.component';
import { formatLocalizedDateTime } from 'src/app/utils/date-format.util';

type BookingDetailTab =   'details' | 'finance' |  'log' | 'services'  ;

interface BookingDetailView {
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
    actualCheckIn: { date: string; time: string } | null;
    actualCheckOut: { date: string; time: string } | null;
  };
  dateRangeLabel: string;
}

@Component({
  selector: 'app-booking-detail-drawer',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, BookingFinanceTabComponent, BookingServicesTabComponent, BookingLogTabComponent],
  templateUrl: './booking-detail-drawer.component.html',
  styleUrl: './booking-detail-drawer.component.scss'
})
export class BookingDetailDrawerComponent implements OnChanges, OnDestroy {
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);
  private destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() bookingId: string | null = null;
  @Output() closed = new EventEmitter<void>();

  activeDetailTab: BookingDetailTab = 'details';
  // Tabs are kept in the DOM (hidden) once first opened so switching back and
  // forth doesn't re-fetch each child every time.
  visitedTabs: Record<BookingDetailTab, boolean> = { details: true, finance: false, log: false, services: false };

  loading = false;
  loadError = false;
  bookingDetail: BookingDetailView | null = null;

  private scrollLocked = false;
  // switchMap on this stream so re-opening the drawer for another booking
  // cancels any still-in-flight request for the previous one.
  private detailRequest$ = new Subject<string>();

  constructor() {
    this.detailRequest$
      .pipe(
        tap(() => {
          this.loading = true;
          this.loadError = false;
          this.bookingDetail = null;
        }),
        switchMap(id => this.bookingService.getBookingDetail(id).pipe(
          catchError(() => {
            this.loadError = true;
            return of(null);
          }),
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(item => {
        if (item) {
          try {
            this.bookingDetail = this.mapDetail(item);
          } catch {
            this.loadError = true;
          }
        }
        this.loading = false;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.activeDetailTab = 'details';
      this.visitedTabs = { details: true, finance: false, log: false, services: false };
    }

    if (changes['open']) {
      this.setBodyScrollLock(this.open);
    }

    if (this.open && this.bookingId) {
      this.fetchBookingDetail(this.bookingId);
    } else if (changes['open']?.currentValue === true && !this.bookingId) {
      this.bookingDetail = null;
      this.loadError = true;
    }
  }

  ngOnDestroy(): void {
    this.setBodyScrollLock(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  setDetailTab(tab: BookingDetailTab): void {
    this.activeDetailTab = tab;
    this.visitedTabs[tab] = true;
  }

  close(): void {
    this.closed.emit();
  }

  private setBodyScrollLock(lock: boolean): void {
    if (lock === this.scrollLocked) return;
    this.scrollLocked = lock;
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  statusLabel(status: BookingStatus): string {
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
    return this.translate.instant(map[status]);
  }

  private fetchBookingDetail(bookingId: string): void {
    this.detailRequest$.next(bookingId);
  }

  private mapDetail(item: BookingDetailApiItem): BookingDetailView {
    const checkIn = this.formatDateParts(item.checkIn);
    const checkOut = this.formatDateParts(item.checkOut);
    const actualCheckIn = this.formatDateParts(item.checkedInAtUtc);
    const actualCheckOut = this.formatDateParts(item.checkedOutAtUtc);
    const location = [item.propertyName?.trim(), item.city?.trim()].filter(Boolean).join('، ');
    const companions: string[] = (item.companions ?? [])
      .map(c => c.name?.trim())
      .filter((name): name is string => !!name);

    return {
      number: item.bookingNumber ? `#${item.bookingNumber}` : '-',
      status: this.bookingService.mapStatus(item.displayStatusKey),
      guest: {
        initials: this.bookingService.getInitials(item.customerName),
        colorIndex: this.bookingService.colorIndexForId(item.bookingId),
        name: item.customerName?.trim() || '-',
        phone: item.customerPhone?.trim() || '-',
        companionsCount: companions.length,
        companions,
      },
      unit: {
        number: item.unitNumber?.trim() || '-',
        type: item.unitTypeName?.trim() || '-',
        location: location || '-',
      },
      stay: {
        checkInDate: checkIn?.date ?? '-',
        checkInTime: checkIn?.time ?? '-',
        checkOutDate: checkOut?.date ?? '-',
        checkOutTime: checkOut?.time ?? '-',
        nights: item.nights ?? 0,
        actualCheckIn,
        actualCheckOut,
      },
      dateRangeLabel: checkIn && checkOut ? `${checkIn.date} — ${checkOut.date}` : '-',
    };
  }

  private formatDateParts(iso: string | null): { date: string; time: string } | null {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    return formatLocalizedDateTime(iso, lang);
  }
}
