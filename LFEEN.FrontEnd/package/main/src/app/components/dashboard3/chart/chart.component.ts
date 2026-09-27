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
import { DashboardSummary } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';
import {
  EM_DASH,
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

// Relative positions (matching the design's rhythm) at which the curve gets a visible dot,
// scaled to however many points the current period actually returns.
const MARKER_FRACTIONS = [0.2, 0.4, 0.8, 1];

function buildDiscreteMarkers(pointCount: number) {
  if (pointCount < 2) return [];
  const indices = new Set(MARKER_FRACTIONS.map((f) => Math.round(f * (pointCount - 1))));
  return Array.from(indices).map((dataPointIndex) => ({
    seriesIndex: 0,
    dataPointIndex,
    fillColor: '#FFFFFF',
    strokeColor: '#0F172B',
    size: 5,
  }));
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

  // Tabs switch locally — no extra request; all three series come from the same response.
  readonly chartOptions = computed<ChartOptions>(() => {
    const points = this.growth.data()?.points ?? [];
    const key = SERIES_KEYS[this.activeTab()];
    const values = points.map((p) => p[key]);
    const max = Math.max(1, ...values);

    return {
      series: [{ name: this.translate.instant('d3.chart.growthSeries'), data: values }],
      chart: {
        type: 'area',
        height: 230,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'Cairo, sans-serif',
        sparkline: { enabled: true },
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
      grid: { show: false, padding: { left: -10, right: 10, top: 8, bottom: -10 } },
      dataLabels: { enabled: false },
      markers: {
        size: 0,
        colors: ['#FFFFFF'],
        strokeColors: '#0F172B',
        strokeWidth: 2,
        hover: { size: 6 },
        discrete: buildDiscreteMarkers(points.length),
      },
      tooltip: {
        enabled: true,
        x: { formatter: (_v, opts) => points[opts?.dataPointIndex]?.label ?? '' },
        y: { formatter: (v) => formatInteger(v, this.lang()) },
      },
      xaxis: {
        categories: points.map((p) => p.label),
        labels: { show: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        max: Math.ceil(max * 1.1),
        labels: { show: false },
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
