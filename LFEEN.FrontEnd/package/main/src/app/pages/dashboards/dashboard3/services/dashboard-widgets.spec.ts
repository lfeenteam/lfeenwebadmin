import { DASHBOARD_WIDGETS, DashboardWidget, DashboardWidgetId, visibleWidgets, withheldWidgets } from './dashboard-widgets';
import { DashboardSummary } from '../pages-d3/ceo-page/interfaces/dashboard.model';
import { SidebarItem } from '../interfaces/login.model';

// Placeholder names for the granular-permission scenarios only. They are NOT backend
// permissions: the real registry uses `anyOf: null` until the server ships finer ones.
const FIN = 'test.finance';
const BOOK = 'test.bookings';
const HOST = 'test.hosts';
const GUEST = 'test.guests';

const GRANULAR: DashboardWidget[] = DASHBOARD_WIDGETS.map(w => ({
  ...w,
  anyOf: ({
    revenue: [FIN], averageBookingValue: [FIN], revenueSources: [FIN],
    completedBookings: [BOOK], cancellationRate: [BOOK], growthChart: [BOOK], topCities: [BOOK],
    activeHosts: [HOST], listedUnits: [HOST], occupancyRate: [HOST], hostRetention: [HOST],
    registeredGuests: [GUEST], returningGuests: [GUEST], appDownloads: [GUEST], guestAppRating: [GUEST],
    hostGuestComparison: [HOST, GUEST], executiveInsights: [FIN, BOOK],
  } as Record<DashboardWidgetId, string[]>)[w.id],
}));

const DASH = 'Dashboard.View';
const ids = (ws: DashboardWidget[]) => ws.map(w => w.id);
const dashboardSidebar: SidebarItem[] = [
  { id: '1', key: 'dashboard', icon: null, route: '/d3/ceo', requiredPermission: DASH, entityId: null, order: 0, children: [] },
];

describe('visibleWidgets (dashboard permission mapping)', () => {
  it('shows every widget, in section/priority order, to an admin with dashboard access (current backend model)', () => {
    const shown = ids(visibleWidgets(DASHBOARD_WIDGETS, [DASH], null));
    expect(shown.length).toBe(DASHBOARD_WIDGETS.length);
    expect(shown.slice(0, 4)).toEqual(['revenue', 'completedBookings', 'averageBookingValue', 'cancellationRate']);
    expect(shown.slice(-3)).toEqual(['revenueSources', 'hostGuestComparison', 'topCities']);
  });

  it('grants dashboard access through the server sidebar payload as well', () => {
    expect(visibleWidgets(DASHBOARD_WIDGETS, [], dashboardSidebar).length).toBe(DASHBOARD_WIDGETS.length);
  });

  it('shows nothing without dashboard access, whatever else the admin holds', () => {
    expect(visibleWidgets(DASHBOARD_WIDGETS, ['Bookings.View', 'Settlements.View'], [])).toEqual([]);
    expect(visibleWidgets(GRANULAR, [FIN, BOOK, HOST, GUEST], [])).toEqual([]);
    expect(visibleWidgets(DASHBOARD_WIDGETS, null, null)).toEqual([]);
  });

  it('super admin (all granular permissions) sees everything', () => {
    expect(visibleWidgets(GRANULAR, [DASH, FIN, BOOK, HOST, GUEST], null).length).toBe(DASHBOARD_WIDGETS.length);
  });

  it('financial only: revenue widgets, nothing about bookings, hosts or guests', () => {
    expect(ids(visibleWidgets(GRANULAR, [DASH, FIN], null)))
      .toEqual(['revenue', 'averageBookingValue', 'executiveInsights', 'revenueSources']);
  });

  it('bookings only: no financial figure leaks in', () => {
    const shown = ids(visibleWidgets(GRANULAR, [DASH, BOOK], null));
    expect(shown).toEqual(['completedBookings', 'cancellationRate', 'growthChart', 'executiveInsights', 'topCities']);
    expect(shown).not.toContain('revenue');
    expect(shown).not.toContain('revenueSources');
  });

  it('hosts only / guests only keep their own section', () => {
    expect(ids(visibleWidgets(GRANULAR, [DASH, HOST], null)))
      .toEqual(['activeHosts', 'listedUnits', 'occupancyRate', 'hostRetention', 'hostGuestComparison']);
    expect(ids(visibleWidgets(GRANULAR, [DASH, GUEST], null)))
      .toEqual(['registeredGuests', 'returningGuests', 'appDownloads', 'guestAppRating', 'hostGuestComparison']);
  });

  it('mixed permissions union the widgets', () => {
    const shown = ids(visibleWidgets(GRANULAR, [DASH, BOOK, GUEST], null));
    expect(shown).toContain('completedBookings');
    expect(shown).toContain('registeredGuests');
    expect(shown).not.toContain('activeHosts');
    expect(shown).not.toContain('revenue');
  });

  it('dashboard access without any statistic permission: empty (page shows the no-statistics state)', () => {
    expect(visibleWidgets(GRANULAR, [DASH], null)).toEqual([]);
  });

  it('a revoked permission drops its widgets on the next evaluation', () => {
    expect(ids(visibleWidgets(GRANULAR, [DASH, FIN, BOOK], null))).toContain('revenue');
    expect(ids(visibleWidgets(GRANULAR, [DASH, BOOK], null))).not.toContain('revenue');
  });

  it('an endpoint that answered 403 hides every widget it feeds', () => {
    const shown = ids(visibleWidgets(DASHBOARD_WIDGETS, [DASH], null, new Set(['summary'])));
    expect(shown).toEqual(['growthChart', 'executiveInsights', 'topCities']);
  });

  it('matches permission names case-insensitively, like the rest of the app', () => {
    expect(ids(visibleWidgets(GRANULAR, ['dashboard.view', FIN.toUpperCase()], null))).toContain('revenue');
  });
});

describe('withheldWidgets (permission-scoped /summary, TAS-2508)', () => {
  const m = { value: 1, previousValue: 1, changePercentage: 0 };
  const full = {
    platform: { revenue: m, completedBookings: m, averageBookingValue: m,
      cancellationRate: { value: 1, previousValue: 1, changePercentagePoints: 0 } },
    guestApp: {}, merchantApp: {}, revenueSources: [],
  } as unknown as DashboardSummary;

  it('withholds nothing from a complete summary (today\'s response); an empty revenueSources is data', () => {
    expect(withheldWidgets(full)).toEqual([]);
  });

  it('financial fields null → revenue widgets hidden, bookings kept', () => {
    const s = { ...full, platform: { ...full.platform, revenue: null, averageBookingValue: null }, revenueSources: null };
    expect(withheldWidgets(s as DashboardSummary)).toEqual(['revenue', 'averageBookingValue', 'revenueSources']);
  });

  it('a group left out of the response counts as withheld, the same as null', () => {
    const { merchantApp, ...noHosts } = full;
    expect(withheldWidgets(noHosts as DashboardSummary))
      .toEqual(['activeHosts', 'listedUnits', 'occupancyRate', 'hostRetention', 'hostGuestComparison']);
  });

  it('guests withheld also hides the host-vs-guest comparison', () => {
    expect(withheldWidgets({ ...full, guestApp: null } as DashboardSummary))
      .toEqual(['registeredGuests', 'returningGuests', 'appDownloads', 'guestAppRating', 'hostGuestComparison']);
  });

  it('platform null hides all four KPIs', () => {
    expect(withheldWidgets({ ...full, platform: null } as DashboardSummary))
      .toEqual(['revenue', 'completedBookings', 'averageBookingValue', 'cancellationRate']);
  });
});
