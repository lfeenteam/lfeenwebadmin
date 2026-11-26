import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgApexchartsModule, ApexChart, ApexNonAxisChartSeries, ApexPlotOptions, ApexDataLabels, ApexLegend, ApexStroke, ApexTooltip, ApexStates } from 'ng-apexcharts';
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import { createDashboardPanel, dashboardPart, inertPanel } from '../../../pages/dashboards/dashboard3/services/dashboard-panel';
import {
  DashboardInsights,
  DashboardSummary,
  DashboardTopCities,
} from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';
import { AppPluralPipe } from '../../../pipes/app-plural.pipe';
import { formatInteger, formatMoney, formatRate } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/dashboard-format';
import { D3IconComponent, D3IconName } from '../d3-icon/d3-icon.component';

// Severity is never shown by color alone: each level also has an icon and a text label.
/** Insights shown before "show all" in the decisions card. */
const DECISIONS_PREVIEW = 3;
const SEVERITY_ORDER: Record<string, number> = { urgent: 0, warning: 1, success: 2, neutral: 3 };

const SEVERITY_META: Record<string, { icon: D3IconName; type: string; labelKey: string }> = {
  critical: { icon: 'alert-octagon', type: 'urgent', labelKey: 'd3.insights.severityCritical' },
  warning: { icon: 'alert-triangle', type: 'warning', labelKey: 'd3.insights.severityWarning' },
  opportunity: { icon: 'opportunity', type: 'success', labelKey: 'd3.insights.severityOpportunity' },
  info: { icon: 'info', type: 'neutral', labelKey: 'd3.insights.severityInfo' },
};

const REVENUE_META: Record<string, { label: string; color: string }> = {
  bookingCommissions: { label: 'd3.insights.revenueBookingCommission', color: '#0F172B' },
  subscriptions: { label: 'd3.insights.revenueMonthlySubscriptions', color: '#64748B' },
  usageServices: { label: 'd3.insights.revenueAdditionalServices', color: '#CBD5E1' },
};
const REVENUE_FALLBACK_COLORS = ['#94A3B8', '#334155', '#E2E8F0'];

const SUPPORTED_LANGS = ['ar', 'en'];

// The backend's actionPath is a bare admin-app slug (e.g. "/bookings"), not the
// Angular route (which lives under "/:lang/d3/..." and sometimes has a different
// segment name). This maps the slugs the insights API is known to send today to
// the real d3 child route; anything unmapped falls through unchanged.
// NOTE: confirm this list with the backend team as new insight keys are added.
const ACTION_PATH_SEGMENT_MAP: Record<string, string> = {
  accounts: 'account-management',
  merchants: 'account-management',
  payouts: 'settlements',
  finance: 'settlements',
  team: 'team-management',
  properties: 'units',
  listings: 'units',
  tickets: 'complaints',
  dashboard: 'ceo',
};

type InsightsPart = 'decisions' | 'revenue' | 'cities';

interface PanelHead {
  title: string;
  icon: D3IconName;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

@Component({
  selector: 'app-dashboard3-insights',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, AppPluralPipe, NgApexchartsModule, D3IconComponent],
  templateUrl: './insights.component.html',
  styleUrl: './insights.component.scss'
})
export class InsightsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboard = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  /** Which card(s) this instance renders; 'all' keeps the original three-card row. */
  readonly part = dashboardPart<InsightsPart>();
  private shows(p: InsightsPart): boolean {
    return this.part === 'all' || this.part === p;
  }
  readonly showCities = this.shows('cities');
  readonly showRevenue = this.shows('revenue');
  readonly showDecisions = this.shows('decisions');

  readonly heads: Record<InsightsPart, PanelHead> = {
    cities: { title: 'd3.insights.topCities', icon: 'map-pin' },
    revenue: { title: 'd3.insights.revenueSources', icon: 'pie' },
    decisions: { title: 'd3.insights.needsCeoDecision', icon: 'sparkles' },
  };

  // The top-cities limit matches the design (6); never request all 20.
  readonly cities = this.showCities
    ? createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getTopCities(f, 6))
    : inertPanel<DashboardTopCities>();
  readonly summary = this.showRevenue
    ? createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getSummary(f))
    : inertPanel<DashboardSummary>();
  readonly insights = this.showDecisions
    ? createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getInsights(f))
    : inertPanel<DashboardInsights>();
  readonly lang = signal(this.translate.currentLang || 'ar');
  readonly skeletons = [0, 1, 2, 3];

  /** Footer of the cities card: the period's totals the API sends with the ranking. */
  readonly citiesSummary = computed(() => {
    const d = this.cities.data();
    if (!d || !d.cities?.length) return null;
    return { total: formatInteger(d.totalBookings, this.lang()), unmapped: formatInteger(d.unmappedBookings, this.lang()) };
  });

  readonly cityRows = computed(() =>
    (this.cities.data()?.cities ?? []).map((c) => ({
      rank: c.rank,
      // Names come from the API; fall back to `city`, never a hardcoded translation map.
      name: (this.lang() === 'en' ? c.cityEn : c.cityAr) || c.city,
      // Raw counts: appPlural picks the noun form by the number and formats it itself.
      bookings: c.bookings,
      units: c.units,
      // The API's own share of mapped bookings — drives the bar and its label.
      share: Math.max(0, Math.min(100, c.percentage ?? 0)),
      shareText: formatRate(c.percentage ?? 0, this.lang()),
    }))
  );

  readonly revenueSources = computed(() =>
    (this.summary.data()?.revenueSources ?? []).map((s, i) => {
      const meta = REVENUE_META[s.key];
      return {
        key: s.key,
        label: meta?.label ?? '',
        fallbackLabel: s.key,
        amount: s.amount,
        amountText: formatMoney(s.amount, this.lang()),
        percent: s.percentage,
        text: formatRate(s.percentage, this.lang()),
        color: meta?.color ?? REVENUE_FALLBACK_COLORS[i % REVENUE_FALLBACK_COLORS.length],
      };
    })
  );

  /** Sum of the sources' own amounts (the donut's center); null when nothing was earned. */
  readonly revenueTotal = computed(() => {
    const total = this.revenueSources().reduce((sum, s) => sum + Math.max(0, s.amount), 0);
    return total > 0 ? total : null;
  });

  readonly revenueTotalText = computed(() => {
    const total = this.revenueTotal();
    return total == null ? '' : formatMoney(total, this.lang());
  });

  readonly donut = computed(() => {
    const sources = this.revenueSources();
    const labels = sources.map((s) => (s.label ? this.translate.instant(s.label) : s.fallbackLabel));
    const animate = !reducedMotion();
    return {
      series: sources.map((s) => Math.max(0, s.amount)) as ApexNonAxisChartSeries,
      labels,
      colors: sources.map((s) => s.color),
      chart: {
        type: 'donut',
        height: 190,
        fontFamily: 'Cairo, sans-serif',
        animations: { enabled: animate, speed: 600, animateGradually: { enabled: animate, delay: 80 } },
      } as ApexChart,
      plotOptions: { pie: { expandOnClick: false, donut: { size: '80%' } } } as ApexPlotOptions,
      dataLabels: { enabled: false } as ApexDataLabels,
      legend: { show: false } as ApexLegend,
      stroke: { width: 3, colors: ['#FFFFFF'] } as ApexStroke,
      states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } } as ApexStates,
      tooltip: {
        enabled: true,
        custom: ({ seriesIndex }: { seriesIndex: number }) => {
          const s = sources[seriesIndex];
          if (!s) return '';
          return `<div class="d3-apx-tip">
            <div class="d3-apx-tip-date">${escapeHtml(labels[seriesIndex])}</div>
            <div class="d3-apx-tip-row">
              <span class="d3-apx-tip-dot" style="background:${s.color}"></span>
              <span class="d3-apx-tip-name" dir="ltr">${escapeHtml(s.text)}</span>
              <span class="d3-apx-tip-value" dir="ltr">${escapeHtml(s.amountText)}</span>
            </div>
          </div>`;
        },
      } as ApexTooltip,
    };
  });

  // Backend owns thresholds and ordering; render as received.
  readonly decisions = computed(() =>
    (this.insights.data()?.insights ?? []).map((item) => {
      const meta = SEVERITY_META[item.severity] ?? SEVERITY_META['info'];
      const en = this.lang() === 'en';
      return {
        key: item.key,
        title: en ? item.titleEn : item.titleAr,
        description: en ? item.descriptionEn : item.descriptionAr,
        icon: meta.icon,
        type: meta.type,
        severityLabel: meta.labelKey,
        actionPath: item.actionPath,
      };
    })
    // Most pressing first, so the collapsed list always shows what matters.
    .sort((a, b) => (SEVERITY_ORDER[a.type] ?? 9) - (SEVERITY_ORDER[b.type] ?? 9))
  );

  /**
   * The card shows the first DECISIONS_PREVIEW insights and expands in place for the
   * rest — no scrolling box inside the card.
   */
  readonly decisionsExpanded = signal(false);
  readonly shownDecisions = computed(() =>
    this.decisionsExpanded() ? this.decisions() : this.decisions().slice(0, DECISIONS_PREVIEW)
  );
  readonly hiddenDecisions = computed(() => Math.max(0, this.decisions().length - DECISIONS_PREVIEW));

  /** How many insights of each tone, for the summary chips in the card header. */
  readonly decisionCounts = computed(() => {
    const counts = { urgent: 0, warning: 0, success: 0 };
    for (const d of this.decisions()) {
      if (d.type in counts) counts[d.type as keyof typeof counts]++;
    }
    return counts;
  });

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.lang.set(event.lang));
  }

  get isRtl(): boolean {
    return this.lang() !== 'en';
  }

  get currencyIconSrc(): string {
    return this.lang() === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconAlt(): string {
    return this.lang() === 'en' ? 'SAR' : 'ريال سعودي';
  }

  // actionPath is an internal admin route, never an external URL.
  open(actionPath: string | null) {
    const target = this.resolveActionPath(actionPath);
    if (!target) return;
    this.router.navigateByUrl(target);
  }

  // Every real route lives under "/:lang/d3/...", so the bare slug the API sends
  // has to be rebased onto the current language before it will resolve to anything.
  private resolveActionPath(actionPath: string | null): string | null {
    if (!actionPath || !actionPath.startsWith('/') || actionPath.startsWith('//')) return null;

    const segments = actionPath.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const [first, ...rest] = segments;
    const mappedFirst = ACTION_PATH_SEGMENT_MAP[first] ?? first;
    const langSegment = this.currentLangSegment();

    return ['', langSegment, 'd3', mappedFirst, ...rest].join('/');
  }

  private currentLangSegment(): string {
    const fromUrl = this.router.url.split('/').filter(Boolean)[0];
    if (fromUrl && SUPPORTED_LANGS.includes(fromUrl)) return fromUrl;
    return this.lang() === 'en' ? 'en' : 'ar';
  }
}
