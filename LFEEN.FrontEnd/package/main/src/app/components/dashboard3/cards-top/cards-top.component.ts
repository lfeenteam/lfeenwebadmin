import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface MetricCard {
  title: string;
  value: string;
  iconName?: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'warn' | 'blue';
  trendNote?: string;
  alert?: boolean;
  currency?: boolean;
  trendPrefix?: string;
  trendSuffixKey?: string;
}

@Component({
  selector: 'app-cards-top',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './cards-top.component.html',
  styleUrl: './cards-top.component.scss'
})
export class CardsTopComponent {
  private readonly destroyRef = inject(DestroyRef);
  currentLang = 'ar';

  constructor(private translate: TranslateService) {
    this.currentLang = this.translate.currentLang || 'ar';
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.currentLang = event.lang;
      });
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconAlt(): string {
    return this.currentLang === 'en' ? 'SAR' : 'ريال سعودي';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  platformCards: MetricCard[] = [
    {
      title: 'd3.cards.monthlyRevenue',
      value: '1,250,000',
      iconName: 'device-tablet',
      trendPrefix: '+12.6%',
      trendSuffixKey: 'd3.cards.trendUpLastMonth',
      trendType: 'up',
      currency: true
    },
    {
      title: 'd3.cards.completedBookings',
      value: '4,281',
      iconName: 'calendar-event',
      trendPrefix: '+8.2%',
      trendSuffixKey: 'd3.cards.trendUpLastMonth',
      trendType: 'up'
    },
    {
      title: 'd3.cards.avgBookingValue',
      value: '297',
      iconName: 'trending-down',
      trendNote: 'd3.cards.stable',
      currency: true
    },
    {
      title: 'd3.cards.monthlyCancelRate',
      value: '8.4%',
      alert: true,
      trendPrefix: '1.2%',
      trendSuffixKey: 'd3.cards.concerningIncrease',
      trendType: 'warn'
    }
  ];

  hostsCards: MetricCard[] = [
    { title: 'd3.cards.registeredGuests', value: '45.8k' },
    { title: 'd3.cards.returningGuestsRate', value: '68.4%', trendType: 'up' },
    { title: 'd3.cards.appDownloads', value: '120k' },
    { title: 'd3.cards.storeRating', value: '4.8', iconName: 'star' },
  ];

  guestsCards: MetricCard[] = [
    { title: 'd3.cards.activeHosts', value: '12,402' },
    { title: 'd3.cards.listedUnits', value: '35,910' },
    { title: 'd3.cards.avgOccupancy', value: '72.1%', trendType: 'blue' },
    { title: 'd3.cards.hostRetention', value: '94.2%', trendType: 'up' }
  ];
}
