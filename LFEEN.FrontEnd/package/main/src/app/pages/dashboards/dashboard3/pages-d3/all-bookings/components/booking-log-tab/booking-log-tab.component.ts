import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BookingService } from '../../services/booking.service';
import { BookingActivityLogApiItem, BookingActivityLogSource } from '../../interfaces/booking.model';

type LogActivityType = 'check' | 'payment';

interface LogActivityView {
  type: LogActivityType;
  icon: string;
  title: string;
  date: string;
  time: string;
  actor: string;
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SOURCE_LABEL_KEY: Record<BookingActivityLogSource, string> = {
  Admin: 'd3.bookings.detail.logTab.source.admin',
  Merchant: 'd3.bookings.detail.logTab.source.merchant',
  Guest: 'd3.bookings.detail.logTab.source.guest',
  System: 'd3.bookings.detail.logTab.source.system',
};

@Component({
  selector: 'app-booking-log-tab',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './booking-log-tab.component.html',
  styleUrl: './booking-log-tab.component.scss'
})
export class BookingLogTabComponent implements OnChanges {
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);

  @Input() bookingId: string | null = null;

  loading = false;
  loadError = false;
  activities: LogActivityView[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bookingId'] && this.bookingId) {
      this.fetchActivityLog(this.bookingId);
    }
  }

  private fetchActivityLog(bookingId: string): void {
    this.loading = true;
    this.loadError = false;
    this.activities = [];

    this.bookingService.getBookingActivityLog(bookingId).subscribe({
      next: items => {
        this.activities = items.map(item => this.mapActivity(item));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private mapActivity(item: BookingActivityLogApiItem): LogActivityView {
    const d = new Date(item.atUtc);
    const valid = !isNaN(d.getTime());
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    const months = lang === 'en' ? MONTHS_EN : MONTHS_AR;
    const type: LogActivityType = item.actionKey?.toUpperCase().includes('PAYMENT') ? 'payment' : 'check';

    return {
      type,
      icon: type === 'payment' ? 'credit-card' : 'check',
      title: item.label || '-',
      date: valid ? `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '-',
      time: valid ? `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}` : '-',
      actor: item.actorName?.trim() || this.translate.instant(SOURCE_LABEL_KEY[item.source] ?? SOURCE_LABEL_KEY.System),
    };
  }
}
