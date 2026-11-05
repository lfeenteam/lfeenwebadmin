import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  NgApexchartsModule,
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
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import { createDashboardPanel } from '../../../pages/dashboards/dashboard3/services/dashboard-panel';
import { DashboardGrowth, DashboardSummary } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';
import {
  EM_DASH,
  dashboardLocale,
  formatDecimal,
  formatInteger,
  formatRate,
} from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/dashboard-format';

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
  hostsColor?: string;
  guestsColor?: string;
}

type GrowthSeriesKey = 'newGuests' | 'newMerchants' | 'bookings';

const SERIES_KEYS: GrowthSeriesKey[] = ['newGuests', 'newMerchants', 'bookings'];

const AXIS_COLOR = '#94A3B8';
const GRID_COLOR = '#F1F5F9';
/** Most date labels under the chart; the rest are skipped so they never overlap. */
const MAX_X_LABELS = 6;

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

@Component({
  selector: 'app-dashboard3-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, TranslateModule],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss'
})
export class ChartComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboard = inject(DashboardService);
  private readonly translate = inject(TranslateService);

  readonly growth = createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getGrowth(f));
  readonly summary = createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getSummary(f));
  readonly lang = signal(this.translate.currentLang || 'ar');

  tabs: string[] = ['d3.chart.tabNewGuests', 'd3.chart.tabNewHosts', 'd3.chart.tabBookings'];
  readonly activeTab = signal(0);

  /** Every value of the active tab is zero — a flat line would read as a broken chart. */
  readonly isEmpty = computed(() => {
    const key = SERIES_KEYS[this.activeTab()];
    return this.growthPoints().every((p) => !p[key]);
  });

  // Tabs switch locally — no extra request; all three series come from the same response.
  readonly chartOptions = computed<ChartOptions>(() => {
    const growth = this.growth.data();
    const points = growth?.points ?? [];
    const key = SERIES_KEYS[this.activeTab()];
    const values = points.map((p) => p[key]);
    const max = Math.max(1, ...values);
    // Read so the axis dates and series name follow a language switch.
    const lang = this.lang();
    const axisDates = growth ? points.map((p) => bucketDate(p, growth, lang, false)) : [];
    const tooltipDates = growth ? points.map((p) => bucketDate(p, growth, lang, true)) : [];
    // Whole numbers only: never more ticks than the top value (no "0.5 bookings").
    const yTicks = Math.min(4, Math.ceil(max));

    return {
      series: [{ name: this.translate.instant(this.tabs[this.activeTab()]), data: values }],
      chart: {
        type: 'area',
        height: 260,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'Cairo, sans-serif',
        animations: { enabled: false },
      },
      colors: ['#0F172B'],
      stroke: { curve: 'smooth', width: 2.5, lineCap: 'round' },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          opacityFrom: 0.1,
          opacityTo: 0,
          stops: [0, 100],
          colorStops: [
            { offset: 0, color: '#000000', opacity: 0.1 },
            { offset: 100, color: '#000000', opacity: 0 },
          ],
        },
      },
      // Light horizontal lines only, so the values can be read without cluttering the card.
      grid: {
        show: true,
        borderColor: GRID_COLOR,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { left: 8, right: 16, top: 0, bottom: 0 },
      },
      dataLabels: { enabled: false },
      // A dot only on the hovered day — fixed decorative dots looked like data points.
      markers: {
        size: 0,
        colors: ['#FFFFFF'],
        strokeColors: '#0F172B',
        strokeWidth: 2,
        hover: { size: 6 },
      },
      tooltip: {
        enabled: true,
        x: { formatter: (_v, opts) => tooltipDates[opts?.dataPointIndex] ?? '' },
        y: { formatter: (v) => formatInteger(v, lang) },
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
  });

  readonly growthPoints = computed(() => this.growth.data()?.points ?? []);
  readonly activeKey = computed(() => SERIES_KEYS[this.activeTab()]);

  readonly comparisonRows = computed<ComparisonRow[]>(() => this.buildRows(this.summary.data(), this.lang()));

  readonly distributionSegments = computed(() => {
    const g = this.summary.data()?.guestApp;
    if (!g) return [];
    return [
      { label: 'd3.chart.segMale', value: g.malePercentage, color: '#0F172B' },
      { label: 'd3.chart.segFemale', value: g.femalePercentage, color: '#3B82F6' },
    ];
  });

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.lang.set(event.lang));
  }

  setTab(idx: number) {
    this.activeTab.set(idx);
  }

  formatPercent(value: number): string {
    return formatRate(value, this.lang());
  }

  formatCount(value: number): string {
    return formatInteger(value, this.lang());
  }

  private buildRows(s: DashboardSummary | null, lang: string): ComparisonRow[] {
    if (!s) return [];
    const g = s.guestApp;
    const m = s.merchantApp;
    const amber = '#F59E0B';
    const rating = (v: number | null) => (v == null ? EM_DASH : formatDecimal(v, lang));
    // Unavailable metrics stay as a dash — null is "not connected", never zero.
    const unavailable = (v: number | null) => (v == null ? EM_DASH : formatInteger(v, lang));

    return [
      { label: 'd3.chart.rowTotal', guests: formatInteger(g.registeredGuests, lang), hosts: formatInteger(m.activeMerchants, lang) },
      { label: 'd3.chart.rowDownloads', guests: unavailable(g.downloads.value), hosts: EM_DASH },
      { label: 'd3.chart.rowRating', guests: rating(g.averageAppRating), hosts: rating(m.averageAppRating.value) },
      { label: 'd3.chart.rowOpenComplaints', guests: formatInteger(g.openComplaints, lang), hosts: formatInteger(m.openComplaints, lang), guestsColor: amber, hostsColor: amber },
    ];
  }
}
