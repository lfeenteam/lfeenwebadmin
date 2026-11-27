import { Component, DestroyRef, Input, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import { createDashboardPanel, dashboardPart } from '../../../pages/dashboards/dashboard3/services/dashboard-panel';
import { DashboardSummary } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';
import { LoginService } from '../../../pages/dashboards/dashboard3/services/login/login.service';
import { PAGE_ACCESS, PageAccessKey, canAccessPage } from '../../../guards/page-access';
import { DashboardAccessService, DashboardWidgetId } from '../../../pages/dashboards/dashboard3/services/dashboard-widgets';
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
import { D3IconComponent, D3IconName } from '../d3-icon/d3-icon.component';
import { CountUpDirective } from '../count-up/count-up.directive';
import { CARD_STYLES, KPI_GRID_CLASS, TILE_GRID_CLASS, TONE_CLASS, TREND_CHIP_CLASS } from './cards-top.styles';

type Formatter = (n: number) => string;
type Tone = 'navy' | 'blue' | 'green' | 'red' | 'amber' | 'violet';

interface MetricCard {
  /** Registry id — the card is shown only when DashboardAccessService allows it. */
  id: DashboardWidgetId;
  title: string;
  /** Raw number for the count-up; null = not available (shown as `fallback`). */
  raw: number | null;
  format: Formatter;
  fallback?: string;
  icon: D3IconName;
  tone: Tone;
  trend?: Trend;
  /** true when a higher value is bad (cancellation rate) */
  invertTrend?: boolean;
  /** rate cards show absolute points instead of relative % */
  trendIsPoints?: boolean;
  /** i18n key for what the trend is compared against ("vs last month" / "vs previous period") */
  comparisonLabel?: string;
  /** The API's own previous-period value, for the comparison meter. */
  previous?: number;
  currency?: boolean;
  valueTone?: 'up' | 'blue';
  unavailableHint?: string;
  /** Real list page behind the metric (route under /:lang/d3), only when the admin can open it. */
  link?: CardLink;
  hero?: boolean;
}

interface AppPanel {
  key: 'hosts' | 'guests';
  title: string;
  icon: D3IconName;
  tone: Tone;
  cards: MetricCard[];
  /** Visible tiles of this panel per the registry (known before the data arrives). */
  count: number;
  /** Tile columns for this panel (wider when it's the only panel shown). */
  cols: number;
}

interface CardLink {
  route: string;
  queryParams?: Record<string, string>;
}

// Each metric opens the page that lists what it counts, pre-filtered where that page
// supports it (the bookings list reads ?status=). Shown only when the admin can open it.
const CARD_LINKS: Record<string, CardLink & { access: PageAccessKey }> = {
  revenue: { route: 'settlements', access: 'settlements' },
  completedBookings: { route: 'bookings', queryParams: { status: 'Completed' }, access: 'bookings' },
  averageBookingValue: { route: 'bookings', queryParams: { status: 'Completed' }, access: 'bookings' },
  cancellationRate: { route: 'bookings', queryParams: { status: 'Cancelled' }, access: 'bookings' },
  activeHosts: { route: 'account-management', access: 'accounts' },
  listedUnits: { route: 'units', access: 'units' },
};

@Component({
  selector: 'app-cards-top',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, D3IconComponent, CountUpDirective],
  templateUrl: './cards-top.component.html',
  styleUrl: './cards-top.component.scss'
})
export class CardsTopComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboard = inject(DashboardService);
  private readonly login = inject(LoginService);
  private readonly access = inject(DashboardAccessService);

  /** 'platform' = executive KPIs, 'apps' = host & guest app panels, 'all' = both. */
  readonly part = dashboardPart<'platform' | 'apps'>();

  /** false when the page already renders the section heading (e.g. beside the period filter). */
  @Input() showHeading = true;

  // Tags each response with the period it was fetched for, so the card wording
  // follows the numbers on screen (previous data stays visible while refetching).
  // No from/to = "this month" (the backend picks the current Riyadh month and
  // compares it with last month); any other range is compared by the backend
  // with the same-length period right before it.
  // The summary request is shared (DashboardService caches it per period), so the
  // two instances of this component on the page still make a single call.
  private readonly panel = createDashboardPanel(this.dashboard.filters, (f) =>
    this.dashboard.getSummary(f).pipe(map((summary) => ({ summary, isCurrentMonth: !f.from || !f.to })))
  );
  readonly summary = {
    ...this.panel,
    data: computed(() => this.panel.data()?.summary ?? null),
  };
  private readonly isCurrentMonth = computed(() => this.panel.data()?.isCurrentMonth ?? true);
  readonly lang = signal('ar');

  readonly platformCards = computed(() =>
    this.buildPlatformCards(this.summary.data(), this.lang(), this.isCurrentMonth()).filter((c) => this.access.can(c.id))
  );

  /** Visible KPIs of the overview, known before the data arrives (sizes the skeletons and the grid). */
  readonly platformCount = computed(() => this.access.inSection('overview').length);
  readonly platformSkeletons = computed(() => range(this.platformCount()));
  /** The navy hero styling belongs to revenue only; without it every KPI is an equal card. */
  readonly hasHero = computed(() => this.access.can('revenue'));

  readonly appPanels = computed<AppPanel[]>(() => {
    const s = this.summary.data();
    const lang = this.lang();
    const panels: Omit<AppPanel, 'cols'>[] = [
      { key: 'hosts', title: 'd3.sections.hostsApp', icon: 'hosts', tone: 'blue',
        count: this.access.inSection('hosts').length, cards: this.buildMerchantCards(s, lang) },
      { key: 'guests', title: 'd3.sections.guestsApp', icon: 'guests', tone: 'green',
        count: this.access.inSection('guests').length, cards: this.buildGuestCards(s, lang) },
    ];
    const shown = panels.filter((p) => p.count > 0);
    const solo = shown.length === 1;
    return shown.map((p) => ({
      ...p,
      cards: p.cards.filter((c) => this.access.can(c.id)),
      // Alone, a panel spans the row, so its tiles sit in one line (up to 4) instead of a 2×2 block.
      cols: solo ? Math.min(p.count, 4) : Math.min(p.count, 2),
    }));
  });
  readonly dataQuality = computed(() => this.summary.data()?.dataQuality ?? []);

  /** Tile skeletons match the tiles the admin will actually get. */
  tileSkeletons(panel: AppPanel): number[] {
    return range(panel.count);
  }

  /** In a 2-column tile grid an odd last tile spans the row, so no empty cell is left. */
  tileSpans(panel: AppPanel, index: number, total: number): boolean {
    return panel.cols === 2 && total % 2 === 1 && index === total - 1;
  }

  constructor(private translate: TranslateService) {
    this.lang.set(this.translate.currentLang || 'ar');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.lang.set(event.lang));
  }

  get showPlatform(): boolean {
    return this.part !== 'apps';
  }

  get showApps(): boolean {
    return this.part !== 'platform';
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

  // ── Tailwind classes (literal strings live in cards-top.styles.ts) ──
  readonly S = CARD_STYLES;

  toneClass(tone: Tone): string {
    return TONE_CLASS[tone];
  }

  /** Columns from the number of KPIs this admin may see. */
  readonly kpiGridClass = computed(() => KPI_GRID_CLASS[this.platformCount()] ?? KPI_GRID_CLASS[4]);

  tileGridClass(cols: number): string {
    return TILE_GRID_CLASS[cols] ?? TILE_GRID_CLASS[2];
  }

  trendChipClass(card: MetricCard): string {
    return TREND_CHIP_CLASS[this.trendClass(card) || 'flat'];
  }

  linkCommands(card: MetricCard): string[] | null {
    return card.link ? ['/', this.lang() === 'en' ? 'en' : 'ar', 'd3', card.link.route] : null;
  }

  private linkFor(metric: string): CardLink | undefined {
    const target = CARD_LINKS[metric];
    if (!target) return undefined;
    return canAccessPage(PAGE_ACCESS[target.access], this.login.permissions(), this.login.sidebar())
      ? { route: target.route, queryParams: target.queryParams }
      : undefined;
  }

  private buildPlatformCards(s: DashboardSummary | null, lang: string, isCurrentMonth: boolean): MetricCard[] {
    const p = s?.platform;
    if (!p) return [];
    const comparisonLabel = isCurrentMonth ? 'd3.cards.trendUpLastMonth' : 'd3.cards.vsPreviousPeriod';
    const money: Formatter = (n) => formatMoney(n, lang);
    const int: Formatter = (n) => formatInteger(n, lang);
    const rate: Formatter = (n) => formatRate(n, lang);
    // A metric the server withheld is skipped — never shown as zero (TAS-2508).
    const cards: (MetricCard | null)[] = [
      p.revenue ? {
        id: 'revenue', title: isCurrentMonth ? 'd3.cards.monthlyRevenue' : 'd3.cards.revenue', hero: true,
        raw: p.revenue.value, previous: p.revenue.previousValue, format: money, icon: 'revenue', tone: 'navy',
        currency: true, comparisonLabel, trend: relativeTrend(p.revenue, lang), link: this.linkFor('revenue'),
      } : null,
      p.completedBookings ? {
        id: 'completedBookings', title: 'd3.cards.completedBookings',
        raw: p.completedBookings.value, previous: p.completedBookings.previousValue, format: int, icon: 'bookings', tone: 'green',
        comparisonLabel, trend: relativeTrend(p.completedBookings, lang), link: this.linkFor('completedBookings'),
      } : null,
      p.averageBookingValue ? {
        id: 'averageBookingValue', title: 'd3.cards.avgBookingValue',
        raw: p.averageBookingValue.value, previous: p.averageBookingValue.previousValue, format: money, icon: 'avg-value', tone: 'blue',
        currency: true, comparisonLabel, trend: relativeTrend(p.averageBookingValue, lang), link: this.linkFor('averageBookingValue'),
      } : null,
      p.cancellationRate ? {
        id: 'cancellationRate', title: isCurrentMonth ? 'd3.cards.monthlyCancelRate' : 'd3.cards.cancelRate',
        raw: p.cancellationRate.value, previous: p.cancellationRate.previousValue, format: rate, icon: 'cancel', tone: 'red',
        invertTrend: true, trendIsPoints: true, comparisonLabel, trend: pointsTrend(p.cancellationRate, lang), link: this.linkFor('cancellationRate'),
      } : null,
    ];
    return cards.filter((c): c is MetricCard => c !== null);
  }

  private buildGuestCards(s: DashboardSummary | null, lang: string): MetricCard[] {
    const g = s?.guestApp;
    if (!g) return [];
    const int: Formatter = (n) => formatInteger(n, lang);
    const unavailableText = this.translate.instant('d3.cards.unavailable');
    return [
      { id: 'registeredGuests', title: 'd3.cards.registeredGuests', raw: g.registeredGuests, format: int, icon: 'guests', tone: 'green' },
      { id: 'returningGuests', title: 'd3.cards.returningGuestsRate', raw: g.returningGuestRate, format: (n) => formatRate(n, lang), icon: 'returning', tone: 'green', valueTone: 'up' },
      // null means the source is not connected — never show it as zero.
      {
        id: 'appDownloads', title: 'd3.cards.appDownloads', raw: g.downloads.value, format: int, fallback: unavailableText, icon: 'downloads', tone: 'green',
        unavailableHint: g.downloads.value == null ? g.downloads.requiredSource : undefined,
      },
      { id: 'guestAppRating', title: 'd3.cards.storeRating', raw: g.averageAppRating, format: (n) => formatDecimal(n, lang), fallback: EM_DASH, icon: 'star', tone: 'amber' },
    ];
  }

  private buildMerchantCards(s: DashboardSummary | null, lang: string): MetricCard[] {
    const m = s?.merchantApp;
    if (!m) return [];
    const int: Formatter = (n) => formatInteger(n, lang);
    const rate: Formatter = (n) => formatRate(n, lang);
    return [
      { id: 'activeHosts', title: 'd3.cards.activeHosts', raw: m.activeMerchants, format: int, icon: 'hosts', tone: 'blue', link: this.linkFor('activeHosts') },
      { id: 'listedUnits', title: 'd3.cards.listedUnits', raw: m.listedUnits, format: int, icon: 'units', tone: 'blue', link: this.linkFor('listedUnits') },
      { id: 'occupancyRate', title: 'd3.cards.avgOccupancy', raw: m.occupancyRate, format: rate, icon: 'occupancy', tone: 'blue', valueTone: 'blue' },
      { id: 'hostRetention', title: 'd3.cards.hostRetention', raw: m.merchantRetentionRate, format: rate, icon: 'retention', tone: 'blue', valueTone: 'up' },
    ];
  }
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
