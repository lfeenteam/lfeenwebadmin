import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { LoginService } from './login/login.service';
import { PAGE_ACCESS, canAccessPage, hasPermission } from 'src/app/guards/page-access';
import { SidebarItem } from '../interfaces/login.model';
import { DashboardSummary } from '../pages-d3/ceo-page/interfaces/dashboard.model';

/**
 * Permission-aware widget registry for the executive dashboard (ceo-page).
 *
 * Every KPI, tile, chart and insight panel is declared here once, with the permission
 * that grants it, the endpoint that feeds it, its section and its display priority.
 * The page, the KPI cards and the panels all ask `DashboardAccessService` which widgets
 * are visible, so no template repeats permission conditions. A widget that isn't
 * visible is never rendered, so its component is never created and its data is never
 * requested.
 *
 * SECURITY: this is UX only. The admin API must refuse every dataset the caller may not
 * see. Today the backend authorizes /api/dashboard/* as a whole (summary bundles revenue,
 * bookings, host and guest stats in one response), so finer gating here cannot keep that
 * data out of the browser — see the audit report for the backend change it needs.
 */

/** The /api/dashboard endpoint a widget's data comes from. */
export type DashboardSource = 'summary' | 'growth' | 'insights' | 'topCities';

export type DashboardSectionId = 'overview' | 'analytics' | 'hosts' | 'guests' | 'details';

export type DashboardWidgetId =
  // Executive overview (summary.platform)
  | 'revenue' | 'completedBookings' | 'averageBookingValue' | 'cancellationRate'
  // Performance analytics + executive insights
  | 'growthChart' | 'executiveInsights'
  // Host app (summary.merchantApp)
  | 'activeHosts' | 'listedUnits' | 'occupancyRate' | 'hostRetention'
  // Guest app (summary.guestApp)
  | 'registeredGuests' | 'returningGuests' | 'appDownloads' | 'guestAppRating'
  // Detailed analytics
  | 'revenueSources' | 'hostGuestComparison' | 'topCities';

export interface DashboardWidget {
  id: DashboardWidgetId;
  section: DashboardSectionId;
  source: DashboardSource;
  /** Lower = shown first inside its section. */
  priority: number;
  /**
   * Exact backend permission names, any one of which grants this widget.
   * `null` = the backend has no permission finer than dashboard access for this data
   * yet, so dashboard access alone grants it (that is what /api/dashboard enforces).
   * Fill these in only with names that exist on the server (GET /api/permissions);
   * never invent them here.
   */
  anyOf: string[] | null;
}

export const DASHBOARD_WIDGETS: readonly DashboardWidget[] = [
  { id: 'revenue',             section: 'overview',  source: 'summary',   priority: 10, anyOf: null },
  { id: 'completedBookings',   section: 'overview',  source: 'summary',   priority: 20, anyOf: null },
  { id: 'averageBookingValue', section: 'overview',  source: 'summary',   priority: 30, anyOf: null },
  { id: 'cancellationRate',    section: 'overview',  source: 'summary',   priority: 40, anyOf: null },

  { id: 'growthChart',         section: 'analytics', source: 'growth',    priority: 10, anyOf: null },
  { id: 'executiveInsights',   section: 'analytics', source: 'insights',  priority: 20, anyOf: null },

  { id: 'activeHosts',         section: 'hosts',     source: 'summary',   priority: 10, anyOf: null },
  { id: 'listedUnits',         section: 'hosts',     source: 'summary',   priority: 20, anyOf: null },
  { id: 'occupancyRate',       section: 'hosts',     source: 'summary',   priority: 30, anyOf: null },
  { id: 'hostRetention',       section: 'hosts',     source: 'summary',   priority: 40, anyOf: null },

  { id: 'registeredGuests',    section: 'guests',    source: 'summary',   priority: 10, anyOf: null },
  { id: 'returningGuests',     section: 'guests',    source: 'summary',   priority: 20, anyOf: null },
  { id: 'appDownloads',        section: 'guests',    source: 'summary',   priority: 30, anyOf: null },
  { id: 'guestAppRating',      section: 'guests',    source: 'summary',   priority: 40, anyOf: null },

  { id: 'revenueSources',      section: 'details',   source: 'summary',   priority: 10, anyOf: null },
  { id: 'hostGuestComparison', section: 'details',   source: 'summary',   priority: 20, anyOf: null },
  { id: 'topCities',           section: 'details',   source: 'topCities', priority: 30, anyOf: null },
];

@Injectable({ providedIn: 'root' })
export class DashboardAccessService {
  private readonly login = inject(LoginService);

  /**
   * Endpoints that answered 403 in this session — the server is the authority, so a
   * permission revoked after sign-in hides its widgets instead of showing an error.
   * Cleared whenever the permissions change (sign-in, refresh, user switch).
   */
  private readonly forbidden = signal<ReadonlySet<DashboardSource>>(new Set());

  /** May the admin open the dashboard at all (same rule as the route guard). */
  readonly canOpenDashboard = computed(() =>
    canAccessPage(PAGE_ACCESS.dashboard, this.login.permissions(), this.login.sidebar())
  );

  /**
   * Widgets whose data the last summary left out (permission-scoped response, TAS-2508).
   * Replaced by every summary, so it follows the server, and cleared with the session.
   */
  private readonly withheld = signal<ReadonlySet<DashboardWidgetId>>(new Set());

  /** Visible widgets, sorted by section order then priority. */
  readonly visible = computed<DashboardWidget[]>(() => {
    if (!this.login.isLoggedIn()) return [];
    const withheld = this.withheld();
    return visibleWidgets(DASHBOARD_WIDGETS, this.login.permissions(), this.login.sidebar(), this.forbidden())
      .filter(w => !withheld.has(w.id));
  });

  private readonly visibleIds = computed(() => new Set(this.visible().map(w => w.id)));

  constructor() {
    effect(() => {
      this.login.permissions();
      this.login.currentUser();
      untracked(() => {
        this.forbidden.set(new Set());
        this.withheld.set(new Set());
      });
    });
  }

  /** Called by DashboardService with every summary it receives. */
  applySummary(summary: DashboardSummary): void {
    const next = new Set(withheldWidgets(summary));
    const cur = this.withheld();
    if (next.size === cur.size && [...next].every(id => cur.has(id))) return;
    this.withheld.set(next);
  }

  can(id: DashboardWidgetId): boolean {
    return this.visibleIds().has(id);
  }

  /** Visible widgets of one section, in display order. */
  inSection(section: DashboardSectionId): DashboardWidget[] {
    return this.visible().filter(w => w.section === section);
  }

  /** Called by DashboardService when an endpoint answers 403. */
  markForbidden(source: DashboardSource): void {
    if (this.forbidden().has(source)) return;
    this.forbidden.update(set => new Set([...set, source]));
  }
}

const SECTION_ORDER: Record<DashboardSectionId, number> = {
  overview: 0, analytics: 1, hosts: 2, guests: 3, details: 4,
};

/**
 * Summary-fed widgets whose data the server left out or sent as null (permission-scoped
 * response). A withheld value is never shown as zero: its widget is hidden. An empty
 * revenueSources array is real data, not withheld. The host-vs-guest comparison needs
 * both apps, so it is hidden when either is withheld.
 */
export function withheldWidgets(s: DashboardSummary): DashboardWidgetId[] {
  const out: DashboardWidgetId[] = [];
  const p = s.platform;
  if (p?.revenue == null) out.push('revenue');
  if (p?.completedBookings == null) out.push('completedBookings');
  if (p?.averageBookingValue == null) out.push('averageBookingValue');
  if (p?.cancellationRate == null) out.push('cancellationRate');
  if (s.merchantApp == null) out.push('activeHosts', 'listedUnits', 'occupancyRate', 'hostRetention');
  if (s.guestApp == null) out.push('registeredGuests', 'returningGuests', 'appDownloads', 'guestAppRating');
  if (s.merchantApp == null || s.guestApp == null) out.push('hostGuestComparison');
  if (s.revenueSources == null) out.push('revenueSources');
  return out;
}

/**
 * The visibility rule, kept pure so every role combination can be unit-tested:
 * dashboard access (same rule as the route guard) AND the widget's own permission
 * (when it has one) AND its endpoint hasn't answered 403.
 */
export function visibleWidgets(
  registry: readonly DashboardWidget[],
  permissions: string[] | null | undefined,
  sidebar: SidebarItem[] | null | undefined,
  forbidden: ReadonlySet<DashboardSource> = new Set(),
): DashboardWidget[] {
  if (!canAccessPage(PAGE_ACCESS.dashboard, permissions, sidebar)) return [];
  return registry
    .filter(w => !forbidden.has(w.source))
    .filter(w => w.anyOf == null || w.anyOf.some(p => hasPermission(permissions, p)))
    .slice()
    .sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.priority - b.priority);
}
