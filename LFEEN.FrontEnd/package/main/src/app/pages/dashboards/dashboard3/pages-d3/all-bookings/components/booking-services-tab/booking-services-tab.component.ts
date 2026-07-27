import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BookingService } from '../../services/booking.service';
import { BookingServiceRequestApiItem } from '../../interfaces/booking.model';
import { formatLocalizedDayMonth } from 'src/app/utils/date-format.util';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';

interface ServiceRequestView {
  name: string;
  category: string;
  date: string;
  price: number | null;
  icon: string;
}

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
    return this.requests.reduce((sum, r) => sum + (r.price ?? 0), 0);
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

    this.bookingService.getBookingServiceRequests(bookingId).subscribe({
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
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    const localizedTitle = lang === 'en' ? (item.titleEn || item.title) : (item.titleAr || item.title);

    return {
      name: localizedTitle?.trim() || '-',
      category: item.unitTaskType?.trim() || item.requestType?.trim() || '-',
      date: this.formatDate(item.createdAtUtc),
      price: item.price,
      icon: this.iconFor(item.unitTaskType, item.requestTypeKey),
    };
  }

  private formatDate(iso: string | null): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    return formatLocalizedDayMonth(iso, lang);
  }

  private iconFor(unitTaskType: string | null, requestTypeKey: string | null): string {
    const key = (unitTaskType || requestTypeKey || '').toLowerCase();
    if (key.includes('clean')) return 'wash';
    if (key.includes('maint')) return 'tool';
    if (key.includes('food') || key.includes('meal') || key.includes('kitchen')) return 'tools-kitchen-2';
    if (key.includes('drink') || key.includes('beverage')) return 'cup';
    return 'clipboard-list';
  }
}
