import { Component, DestroyRef, computed, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  NgApexchartsModule,
  ChartComponent as ApexChartComponent,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexFill,
  ApexGrid,
  ApexDataLabels,
  ApexTooltip,
  ApexMarkers,
} from 'ng-apexcharts';
import { AppPluralPipe } from '../../../pipes/app-plural.pipe';
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import { createDashboardPanel, dashboardPart, inertPanel } from '../../../pages/dashboards/dashboard3/services/dashboard-panel';
import { DashboardGrowth, DashboardSummary } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';
import {
  EM_DASH,
  dashboardLocale,
  formatDecimal,
  formatInteger,
  formatRate,
} from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/dashboard-format';
import { D3IconComponent, D3IconName } from '../d3-icon/d3-icon.component';
import { CountUpDirective } from '../count-up/count-up.directive';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  fill: ApexFill;
  grid: ApexGrid;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  markers: ApexMarkers;
  colors: string[];
};

interface ComparisonRow {
  label: string;
  hosts: string;
  guests: string;
  /** Values that need attention (open complaints) are tinted amber. */
  attention?: boolean;
}

type GrowthSeriesKey = 'newGuests' | 'newMerchants' | 'bookings';

interface GrowthTab {
  key: GrowthSeriesKey;
  label: string;
  icon: D3IconName;
  /** Monochrome shade per series (black → slate), matching the dashboard's white/black/gray palette. */
  color: string;
}

const TABS: GrowthTab[] = [
  { key: 'newGuests', label: 'd3.chart.tabNewGuests', icon: 'guests', color: '#0F172B' },
  { key: 'newMerchants', label: 'd3.chart.tabNewHosts', icon: 'hosts', color: '#334155' },
  { key: 'bookings', label: 'd3.chart.tabBookings', icon: 'bookings', color: '#475569' },
];

const AXIS_COLOR = '#90A1B9';
const GRID_COLOR = '#EEF2F7';
/** Most date labels under the chart; the rest are skipped so they never overlap. */
const MAX_X_LABELS = 6;
/** dataQuality code: male/female percentages cover identity-verified guests only. */
const GENDER_UNKNOWN_CODE = 'GENDER_UNKNOWN_FOR_UNVERIFIED_GUESTS';

type GrowthPoint = DashboardGrowth['points'][number];

/**
 * Bucket dates in the period's own time zone (the API sends it), so a Riyadh day never
 * shows as the previous day. A monthly bucket is named by its month, others by their day.
 */
function bucketDate(point: GrowthPoint, growth: DashboardGrowth, lang: string, long: boolean): string {
  const date = new Date(point.startUtc);
  if (isNaN(date.getTime())) return point.label;
  const options: Intl.DateTimeFormatOptions = growth.granularity === 'monthly'
    ? { month: 'long', year: 'numeric' }
    : { day: 'numeric', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}) };
  try {
    return date.toLocaleDateString(dashboardLocale(lang), { ...options, timeZone: growth.period?.timeZone });
  } catch {
    // Unknown time zone name: fall back to the browser's.
    return date.toLocaleDateString(dashboardLocale(lang), options);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

@Component({
  selector: 'app-dashboard3-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, TranslateModule, AppPluralPipe, D3IconComponent, CountUpDirective],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss'
})
export class ChartComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboard = inject(DashboardService);
  private readonly translate = inject(TranslateService);

  /** 'growth' = the growth chart, 'comparison' = hosts vs guests table + gender split. */
  readonly part = dashboardPart<'growth' | 'comparison'>();
  readonly showGrowth = this.part !== 'comparison';
  readonly showComparison = this.part !== 'growth';

  readonly growth = this.showGrowth
    ? createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getGrowth(f))
    : inertPanel<DashboardGrowth>();
  readonly summary = this.showComparison
    ? createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getSummary(f))
    : inertPanel<DashboardSummary>();
  readonly lang = signal(this.translate.currentLang || 'ar');

  private readonly apex = viewChild(ApexChartComponent);

  readonly tabs = TABS;
  readonly activeTab = signal(0);

  readonly growthPoints = computed(() => this.growth.data()?.points ?? []);
  readonly activeKey = computed(() => TABS[this.activeTab()].key);

  /** Every value of the active tab is zero — a flat line would read as a broken chart. */
  readonly isEmpty = computed(() => {
    const key = this.activeKey();
    return this.growthPoints().every((p) => !p[key]);
  });

  /** The API's own totals for the period, shown in each tab. */
  totalFor(key: GrowthSeriesKey): number | null {
    return this.growth.data()?.totals?.[key] ?? null;
  }

  readonly formatTotal = (n: number) => formatInteger(n, this.lang());

  // Built from the data and language only — the active tab is read untracked, so switching
  // tabs never rebuilds the chart: setTab() morphs the existing one (see below).
  readonly chartOptions = computed<ChartOptions>(() => {
    const growth = this.growth.data();
    const lang = this.lang();
    return this.buildOptions(growth, lang, untracked(this.activeTab));
  });

  readonly comparisonRows = computed<ComparisonRow[]>(() => this.buildRows(this.summary.data(), this.lang()));

  /**
   * Guest gender split. Male/female percentages are shares of guests whose gender
   * is actually known (verified), so the bar covers the known guests only and the
   * unknown guests are reported beside it — never folded into "female".
   */
  readonly genderDistribution = computed(() => {
    const s = this.summary.data();
    const g = s?.guestApp;
    if (!g) return null;

    // The backend flags verified-only percentages through dataQuality even when the
    // unknown-gender counts are not in the payload — still tell the admin.
    const verifiedOnlyFlag = (s?.dataQuality ?? []).some((q) => q.code === GENDER_UNKNOWN_CODE);
    const male = g.malePercentage ?? 0;
    const female = g.femalePercentage ?? 0;
    const hasUnknownField = typeof g.unknownGenderCount === 'number';
    const unknownCount = hasUnknownField ? (g.unknownGenderCount as number) : 0;
    const knownCount = hasUnknownField ? Math.max(0, g.registeredGuests - unknownCount) : null;

    return {
      segments: [
        { label: 'd3.chart.segMale', value: male, color: '#0F172B' },
        { label: 'd3.chart.segFemale', value: female, color: '#94A3B8' },
      ],
      // No known-gender guests → a 0%/0% bar would be meaningless, show a note instead.
      hasKnownData: knownCount !== 0 && male + female > 0,
      hasUnknownField,
      verifiedOnlyNote: !hasUnknownField && verifiedOnlyFlag,
      knownCount: knownCount ?? 0,
      totalCount: g.registeredGuests,
      unknownCount,
      unknownPercentage: g.unknownGenderPercentage ?? 0,
    };
  });

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.lang.set(event.lang));
  }

  setTab(idx: number): void {
    if (idx === this.activeTab()) return;
    this.activeTab.set(idx);
    const next = this.buildOptions(this.growth.data(), this.lang(), idx);
    // Animate the switch on the live chart instead of re-creating it.
    this.apex()?.updateOptions(
      { series: next.series, colors: next.colors, yaxis: next.yaxis, markers: next.markers, fill: next.fill, tooltip: next.tooltip },
      false,
      !reducedMotion(),
    );
  }

  /** Arrow keys move between the segmented tabs (WAI-ARIA tabs pattern). */
  onTabKey(event: KeyboardEvent): void {
    const forward = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    if (!forward && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const rtl = this.lang() !== 'en';
    let idx = this.activeTab();
    if (event.key === 'Home') idx = 0;
    else if (event.key === 'End') idx = TABS.length - 1;
    else {
      const step = (event.key === 'ArrowRight') !== rtl ? 1 : -1;
      idx = (idx + step + TABS.length) % TABS.length;
    }
    this.setTab(idx);
    const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[idx]?.focus();
  }

  formatPercent(value: number): string {
    return formatRate(value, this.lang());
  }

  formatCount(value: number): string {
    return formatInteger(value, this.lang());
  }

  private buildOptions(growth: DashboardGrowth | null, lang: string, tabIdx: number): ChartOptions {
    const points = growth?.points ?? [];
    const tab = TABS[tabIdx];
    const values = points.map((p) => p[tab.key]);
    const max = Math.max(1, ...values);
    const axisDates = growth ? points.map((p) => bucketDate(p, growth, lang, false)) : [];
    const tooltipDates = growth ? points.map((p) => bucketDate(p, growth, lang, true)) : [];
    // Whole numbers only: never more ticks than the top value (no "0.5 bookings").
    const yTicks = Math.min(4, Math.ceil(max));
    const seriesName = this.translate.instant(tab.label);
    const animate = !reducedMotion();

    return {
      series: [{ name: seriesName, data: values }],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'Cairo, sans-serif',
        parentHeightOffset: 0,
        animations: {
          enabled: animate,
          speed: 600,
          animateGradually: { enabled: false, delay: 0 },
          dynamicAnimation: { enabled: animate, speed: 450 },
        },
      },
      colors: [tab.color],
      stroke: { curve: 'smooth', width: 2.75, lineCap: 'round' },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0,
          opacityFrom: 0.22,
          opacityTo: 0,
          stops: [0, 95],
        },
      },
      // Light dashed horizontal lines only, so the values can be read without clutter.
      grid: {
        show: true,
        borderColor: GRID_COLOR,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { left: 8, right: 16, top: 4, bottom: 0 },
      },
      dataLabels: { enabled: false },
      // A dot only on the hovered bucket — fixed decorative dots looked like data points.
      markers: {
        size: 0,
        colors: ['#FFFFFF'],
        strokeColors: tab.color,
        strokeWidth: 2.5,
        hover: { size: 6 },
      },
      tooltip: {
        enabled: true,
        // Custom card: period on top, colored dot + series + value below.
        custom: ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) => {
          const value = series?.[0]?.[dataPointIndex];
          const date = tooltipDates[dataPointIndex] ?? '';
          return `<div class="d3-apx-tip">
            <div class="d3-apx-tip-date">${escapeHtml(date)}</div>
            <div class="d3-apx-tip-row">
              <span class="d3-apx-tip-dot" style="background:${tab.color}"></span>
              <span class="d3-apx-tip-name">${escapeHtml(seriesName)}</span>
              <span class="d3-apx-tip-value">${escapeHtml(value == null ? EM_DASH : formatInteger(value, lang))}</span>
            </div>
          </div>`;
        },
      },
      xaxis: {
        categories: axisDates,
        tickAmount: Math.min(MAX_X_LABELS, Math.max(1, points.length - 1)),
        labels: {
          show: true,
          rotate: 0,
          hideOverlappingLabels: true,
          style: { colors: AXIS_COLOR, fontSize: '11px', fontWeight: 600 },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: true, stroke: { color: '#CBD5E1', width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        max: Math.ceil(max * 1.1),
        tickAmount: yTicks,
        forceNiceScale: true,
        labels: {
          show: true,
          style: { colors: AXIS_COLOR, fontSize: '11px', fontWeight: 600 },
          formatter: (v) => formatInteger(v, lang),
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
    };
  }

  private buildRows(s: DashboardSummary | null, lang: string): ComparisonRow[] {
    const g = s?.guestApp;
    const m = s?.merchantApp;
    // The comparison needs both apps; with either withheld the widget is hidden (TAS-2508).
    if (!g || !m) return [];
    const rating = (v: number | null) => (v == null ? EM_DASH : formatDecimal(v, lang));
    // Unavailable metrics stay as a dash — null is "not connected", never zero.
    const unavailable = (v: number | null) => (v == null ? EM_DASH : formatInteger(v, lang));

    const rows: ComparisonRow[] = [
      { label: 'd3.chart.rowTotal', guests: formatInteger(g.registeredGuests, lang), hosts: formatInteger(m.activeMerchants, lang) },
      { label: 'd3.chart.rowDownloads', guests: unavailable(g.downloads.value), hosts: EM_DASH },
      { label: 'd3.chart.rowRating', guests: rating(g.averageAppRating), hosts: rating(m.averageAppRating.value) },
      { label: 'd3.chart.rowOpenComplaints', guests: formatInteger(g.openComplaints, lang), hosts: formatInteger(m.openComplaints, lang), attention: true },
    ];
    // A row with no value on either side (source not connected yet) says nothing — drop it;
    // it comes back on its own once the store data is wired.
    return rows.filter((r) => r.guests !== EM_DASH || r.hosts !== EM_DASH);
  }
}
