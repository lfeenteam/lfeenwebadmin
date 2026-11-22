import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BookingService } from '../../services/booking.service';
import { BookingServiceRequestApiItem } from '../../interfaces/booking.model';
import { formatLocalizedDayMonth } from 'src/app/utils/date-format.util';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';

type ServiceRequestStatusTone = 'done' | 'closed' | 'open';

interface ServiceRequestView {
  id: string;
  name: string;
  date: string;
  price: number | null;
  isFree: boolean;
  statusLabel: string;
  statusTone: ServiceRequestStatusTone;
  /** Cancelled / rejected requests don't count toward the total. */
  countsTowardTotal: boolean;
  rating: number | null;
  ratingLabel: string | null;
  icon: string;
}

const CLOSED_STATUS_KEYS = ['cancelled', 'canceled', 'rejected'];

@Component({
  selector: 'app-booking-services-tab',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './booking-services-tab.component.html',
  styleUrl: './booking-services-tab.component.scss'
})
export class BookingServicesTabComponent implements OnChanges {
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);
  private destroyRef = inject(DestroyRef);

  @Input() bookingId: string | null = null;

  loading = false;
  loadError = false;
  requests: ServiceRequestView[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bookingId'] && this.bookingId) {
      this.fetchServiceRequests(this.bookingId);
    }
  }

  get total(): number {
    return this.requests.reduce((sum, r) => sum + (r.countsTowardTotal ? (r.price ?? 0) : 0), 0);
  }

  formatAmount(amount: number): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    return formatLocalizedNumber(amount, lang);
  }

  get currencyIconEn(): boolean {
    return (this.translate.currentLang || this.translate.defaultLang) === 'en';
  }

  private fetchServiceRequests(bookingId: string): void {
    this.loading = true;
    this.loadError = false;
    this.requests = [];

    this.bookingService.getBookingServiceRequests(bookingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: res => {
        this.requests = res.data.map(item => this.mapRequest(item));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private mapRequest(item: BookingServiceRequestApiItem): ServiceRequestView {
    // The API localizes title / statusLabel / overallRatingLabel by Accept-Language,
    // so they are shown as-is; the raw enums (requestType, status) are never displayed.
    const statusKey = (item.statusKey || item.status || '').toLowerCase().replace(/[^a-z]/g, '');
    const isClosed = CLOSED_STATUS_KEYS.includes(statusKey);
    const hasRating = item.isRated && item.overallRating !== null && item.overallRating !== undefined;

    return {
      id: item.externalId,
      name: item.title?.trim() || '-',
      date: this.formatDate(item.createdAtUtc),
      price: item.price,
      isFree: (item.pricingStatus || '').toLowerCase() === 'free',
      statusLabel: item.statusLabel?.trim() || item.status || '',
      statusTone: statusKey === 'completed' ? 'done' : isClosed ? 'closed' : 'open',
      countsTowardTotal: !isClosed,
      rating: hasRating ? item.overallRating : null,
      ratingLabel: hasRating ? (item.overallRatingLabel?.trim() || null) : null,
      icon: this.iconFor(item.requestTypeKey),
    };
  }

  private formatDate(iso: string | null): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    return formatLocalizedDayMonth(iso, lang);
  }

  private iconFor(requestTypeKey: string | null): string {
    const key = (requestTypeKey || '').toLowerCase();
    if (key.includes('laundry')) return 'wash-machine';
    if (key.includes('towel')) return 'bath';
    if (key.includes('clean')) return 'wash';
    if (key.includes('problem')) return 'alert-triangle';
    if (key.includes('maint')) return 'tool';
    if (key.includes('food') || key.includes('meal') || key.includes('kitchen')) return 'tools-kitchen-2';
    if (key.includes('drink') || key.includes('beverage')) return 'cup';
    return 'clipboard-list';
  }
}
