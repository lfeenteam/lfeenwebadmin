import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import { createDashboardPanel } from '../../../pages/dashboards/dashboard3/services/dashboard-panel';
import { formatInteger, formatRate } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/dashboard-format';

// Severity is never shown by color alone: each level also has an icon and a text label.
const SEVERITY_META: Record<string, { icon: string; type: string; labelKey: string }> = {
  critical: { icon: 'alert-octagon', type: 'urgent', labelKey: 'd3.insights.severityCritical' },
  warning: { icon: 'alert-triangle', type: 'warning', labelKey: 'd3.insights.severityWarning' },
  opportunity: { icon: 'rocket', type: 'success', labelKey: 'd3.insights.severityOpportunity' },
  info: { icon: 'info-circle', type: 'neutral', labelKey: 'd3.insights.severityInfo' },
};

const REVENUE_META: Record<string, { label: string; color: string }> = {
  bookingCommissions: { label: 'd3.insights.revenueBookingCommission', color: '#0F172B' },
  subscriptions: { label: 'd3.insights.revenueMonthlySubscriptions', color: '#2B7FFF' },
  usageServices: { label: 'd3.insights.revenueAdditionalServices', color: '#00BC7D' },
};
const REVENUE_FALLBACK_COLORS = ['#CBD5E1', '#F59E0B', '#8B5CF6'];

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
};

@Component({
  selector: 'app-dashboard3-insights',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './insights.component.html',
  styleUrl: './insights.component.scss'
})
export class InsightsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboard = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  // The top-cities limit matches the design (6); never request all 20.
  readonly cities = createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getTopCities(f, 6));
  readonly summary = createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getSummary(f));
  readonly insights = createDashboardPanel(this.dashboard.filters, (f) => this.dashboard.getInsights(f));
  readonly lang = signal(this.translate.currentLang || 'ar');
  readonly skeletons = [0, 1, 2, 3];

  readonly cityRows = computed(() =>
    (this.cities.data()?.cities ?? []).map((c) => ({
      rank: c.rank,
      // Names come from the API; fall back to `city`, never a hardcoded translation map.
      name: (this.lang() === 'en' ? c.cityEn : c.cityAr) || c.city,
      bookings: formatInteger(c.bookings, this.lang()),
      units: formatInteger(c.units, this.lang()),
    }))
  );

  readonly revenueSources = computed(() =>
    (this.summary.data()?.revenueSources ?? []).map((s, i) => {
      const meta = REVENUE_META[s.key];
      return {
        key: s.key,
        label: meta?.label ?? '',
        fallbackLabel: s.key,
        percent: s.percentage,
        text: formatRate(s.percentage, this.lang()),
        color: meta?.color ?? REVENUE_FALLBACK_COLORS[i % REVENUE_FALLBACK_COLORS.length],
      };
    })
  );

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
  );

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.lang.set(event.lang));
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
