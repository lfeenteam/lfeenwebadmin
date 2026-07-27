import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
export class BookingDetailDrawerComponent implements OnChanges {
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);

  @Input() open = false;
  @Input() bookingId: string | null = null;
  @Output() closed = new EventEmitter<void>();

  activeDetailTab: BookingDetailTab = 'details';

  loading = false;
  loadError = false;
  bookingDetail: BookingDetailView | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.activeDetailTab = 'details';
    }

    if (this.open && this.bookingId) {
      this.fetchBookingDetail(this.bookingId);
    } else if (changes['open']?.currentValue === true && !this.bookingId) {
      this.bookingDetail = null;
      this.loadError = true;
    }
  }

  setDetailTab(tab: BookingDetailTab): void {
    this.activeDetailTab = tab;
  }

  close(): void {
    this.closed.emit();
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
    this.loading = true;
    this.loadError = false;
    this.bookingDetail = null;

    this.bookingService.getBookingDetail(bookingId).subscribe({
      next: item => {
        this.bookingDetail = this.mapDetail(item);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private mapDetail(item: BookingDetailApiItem): BookingDetailView {
    const checkIn = this.formatDateParts(item.checkIn);
    const checkOut = this.formatDateParts(item.checkOut);
    const location = [item.propertyName?.trim(), item.city?.trim()].filter(Boolean).join('، ');
    const companions: string[] = (item.companions ?? [])
      .map(c => c.name?.trim())
      .filter((name): name is string => !!name);

    return {
      number: item.bookingNumber ? `#${item.bookingNumber}` : '-',
      status: this.bookingService.mapStatus(item.displayStatusKey),
      guest: {
        initials: this.bookingService.getInitials(item.customerName),
        colorIndex: this.colorIndexFor(item.bookingId),
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
      },
      dateRangeLabel: checkIn && checkOut ? `${checkIn.date} — ${checkOut.date}` : '-',
    };
  }

  private formatDateParts(iso: string | null): { date: string; time: string } | null {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    return formatLocalizedDateTime(iso, lang);
  }

  private colorIndexFor(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return hash % 5;
  }
}
