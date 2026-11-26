import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import { createDashboardPanel } from '../../../pages/dashboards/dashboard3/services/dashboard-panel';
import { DashboardSummary, UnavailableMetric } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';
import {
  EM_DASH,
  Trend,
  formatDecimal,
  formatInteger,
  formatMoney,
  formatRate,
  pointsTrend,
  relativeTrend,
} from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/dashboard-format';

interface MetricCard {
  title: string;
  value: string;
  iconName?: string;
  trend?: Trend;
  /** true when a higher value is bad (cancellation rate) */
  invertTrend?: boolean;
  /** rate cards show absolute points instead of relative % */
  trendIsPoints?: boolean;
  /** i18n key for what the trend is compared against ("vs last month" / "vs previous period") */
  comparisonLabel?: string;
  alert?: boolean;
  currency?: boolean;
  valueTone?: 'up' | 'blue';
  unavailableHint?: string;
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
  private readonly dashboard = inject(DashboardService);

  // Tags each response with the period it was fetched for, so the card wording
  // follows the numbers on screen (previous data stays visible while refetching).
  // No from/to = "this month" (the backend picks the current Riyadh month and
  // compares it with last month); any other range is compared by the backend
  // with the same-length period right before it.
  private readonly panel = createDashboardPanel(this.dashboard.filters, (f) =>
    this.dashboard.getSummary(f).pipe(map((summary) => ({ summary, isCurrentMonth: !f.from || !f.to })))
  );
  readonly summary = {
    ...this.panel,
    data: computed(() => this.panel.data()?.summary ?? null),
  };
  private readonly isCurrentMonth = computed(() => this.panel.data()?.isCurrentMonth ?? true);
  readonly lang = signal('ar');

  readonly platformCards = computed(() => this.buildPlatformCards(this.summary.data(), this.lang(), this.isCurrentMonth()));
  readonly hostsCards = computed(() => this.buildMerchantCards(this.summary.data(), this.lang()));
  readonly guestsCards = computed(() => this.buildGuestCards(this.summary.data(), this.lang()));
  readonly dataQuality = computed(() => this.summary.data()?.dataQuality ?? []);
  readonly skeletons = [0, 1, 2, 3];

  constructor(private translate: TranslateService) {
    this.lang.set(this.translate.currentLang || 'ar');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.lang.set(event.lang));
  }

  get currencyIconSrc(): string {
    return this.lang() === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconAlt(): string {
    return this.lang() === 'en' ? 'SAR' : 'ريال سعودي';
  }

  get currencyIconEn(): boolean {
    return this.lang() === 'en';
  }

  trendClass(card: MetricCard): 'up' | 'warn' | '' {
    const dir = card.trend?.direction;
    if (!dir || dir === 'flat') return '';
    const good = card.invertTrend ? dir === 'down' : dir === 'up';
    return good ? 'up' : 'warn';
  }

  private buildPlatformCards(s: DashboardSummary | null, lang: string, isCurrentMonth: boolean): MetricCard[] {
    if (!s) return [];
    const p = s.platform;
    const comparisonLabel = isCurrentMonth ? 'd3.cards.trendUpLastMonth' : 'd3.cards.vsPreviousPeriod';
    return [
      { title: isCurrentMonth ? 'd3.cards.monthlyRevenue' : 'd3.cards.revenue', value: formatMoney(p.revenue.value, lang), iconName: 'device-tablet', currency: true, comparisonLabel, trend: relativeTrend(p.revenue, lang) },
      { title: 'd3.cards.completedBookings', value: formatInteger(p.completedBookings.value, lang), iconName: 'calendar-event', comparisonLabel, trend: relativeTrend(p.completedBookings, lang) },
      { title: 'd3.cards.avgBookingValue', value: formatMoney(p.averageBookingValue.value, lang), iconName: 'trending-down', currency: true, comparisonLabel, trend: relativeTrend(p.averageBookingValue, lang) },
      { title: isCurrentMonth ? 'd3.cards.monthlyCancelRate' : 'd3.cards.cancelRate', value: formatRate(p.cancellationRate.value, lang), alert: true, invertTrend: true, trendIsPoints: true, comparisonLabel, trend: pointsTrend(p.cancellationRate, lang) },
    ];
  }

  private buildGuestCards(s: DashboardSummary | null, lang: string): MetricCard[] {
    if (!s) return [];
    const g = s.guestApp;
    return [
      { title: 'd3.cards.registeredGuests', value: formatInteger(g.registeredGuests, lang) },
      { title: 'd3.cards.returningGuestsRate', value: formatRate(g.returningGuestRate, lang), valueTone: 'up' },
      { title: 'd3.cards.appDownloads', ...this.unavailable(g.downloads, lang) },
      { title: 'd3.cards.storeRating', iconName: 'star', value: g.averageAppRating == null ? EM_DASH : formatDecimal(g.averageAppRating, lang) },
    ];
  }

  private buildMerchantCards(s: DashboardSummary | null, lang: string): MetricCard[] {
    if (!s) return [];
    const m = s.merchantApp;
    return [
      { title: 'd3.cards.activeHosts', value: formatInteger(m.activeMerchants, lang) },
      { title: 'd3.cards.listedUnits', value: formatInteger(m.listedUnits, lang) },
      { title: 'd3.cards.avgOccupancy', value: formatRate(m.occupancyRate, lang), valueTone: 'blue' },
      { title: 'd3.cards.hostRetention', value: formatRate(m.merchantRetentionRate, lang), valueTone: 'up' },
    ];
  }

  // null means the source is not connected — never show it as zero.
  private unavailable(metric: UnavailableMetric, lang: string): Pick<MetricCard, 'value' | 'unavailableHint'> {
    return metric.value == null
      ? { value: this.translate.instant('d3.cards.unavailable'), unavailableHint: metric.requiredSource }
      : { value: formatInteger(metric.value, lang) };
  }
}
