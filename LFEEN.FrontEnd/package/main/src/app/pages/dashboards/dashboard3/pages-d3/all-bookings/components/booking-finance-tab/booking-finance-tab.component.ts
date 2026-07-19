import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BookingService } from '../../services/booking.service';
import { BookingFinancialSummary } from '../../interfaces/booking.model';

interface FinanceSummaryView {
  nightlyRate: number;
  nights: number;
  totalRent: number;
  remainingAmount: number;
  paidAmount: number;
  deposit: {
    total: number;
    paid: number;
    remaining: number;
  };
}

@Component({
  selector: 'app-booking-finance-tab',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './booking-finance-tab.component.html',
  styleUrl: './booking-finance-tab.component.scss'
})
export class BookingFinanceTabComponent implements OnChanges {
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);

  @Input() bookingId: string | null = null;

  loading = false;
  loadError = false;
  finance: FinanceSummaryView | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bookingId'] && this.bookingId) {
      this.fetchFinanceSummary(this.bookingId);
    }
  }

  private fetchFinanceSummary(bookingId: string): void {
    this.loading = true;
    this.loadError = false;
    this.finance = null;

    this.bookingService.getBookingFinancialSummary(bookingId).subscribe({
      next: item => {
        this.finance = this.mapFinance(item);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private mapFinance(item: BookingFinancialSummary): FinanceSummaryView {
    return {
      nightlyRate: item.pricePerNight ?? 0,
      nights: item.nights ?? 0,
      totalRent: item.totalRentAmount ?? 0,
      paidAmount: item.paidRentAmount ?? 0,
      remainingAmount: item.remainingRentAmount ?? 0,
      deposit: {
        total: item.requiredDepositAmount ?? 0,
        paid: item.paidDepositAmount ?? 0,
        remaining: item.remainingDepositAmount ?? 0,
      },
    };
  }

  formatAmount(amount: number): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'ar';
    return amount.toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA');
  }

  get currencyIconEn(): boolean {
    return (this.translate.currentLang || this.translate.defaultLang) === 'en';
  }
}
