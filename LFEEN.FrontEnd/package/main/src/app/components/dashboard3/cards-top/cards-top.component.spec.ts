import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CardsTopComponent } from './cards-top.component';
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import {
  DASHBOARD_WIDGETS,
  DashboardAccessService,
  DashboardWidgetId,
} from '../../../pages/dashboards/dashboard3/services/dashboard-widgets';
import { LoginService } from '../../../pages/dashboards/dashboard3/services/login/login.service';
import { DashboardSummary } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';

const metric = (value: number) => ({ value, previousValue: value, changePercentage: 0 });
const SUMMARY = {
  asOfUtc: '', currency: 'SAR',
  period: { fromUtc: '', toUtc: '', comparisonFromUtc: '', comparisonToUtc: '', timeZone: 'Asia/Riyadh' },
  platform: {
    revenue: metric(1000), completedBookings: metric(10), averageBookingValue: metric(100),
    cancellationRate: { value: 5, previousValue: 5, changePercentagePoints: 0 },
  },
  guestApp: {
    registeredGuests: 50, returningGuestRate: 20, averageAppRating: 4.5, openComplaints: 0,
    malePercentage: 50, femalePercentage: 50, downloads: { value: null, availability: 'notConfigured', requiredSource: 'stores' },
  },
  merchantApp: {
    activeMerchants: 5, listedUnits: 30, occupancyRate: 40, merchantRetentionRate: 60, openComplaints: 0,
    averageAppRating: { value: null, availability: 'notConfigured', requiredSource: 'stores' },
  },
  revenueSources: [], dataQuality: [],
} as DashboardSummary;

function setup(allowed: DashboardWidgetId[], part: 'platform' | 'apps', summary: DashboardSummary = SUMMARY) {
  const widgets = DASHBOARD_WIDGETS.filter((w) => allowed.includes(w.id));
  const access: Partial<DashboardAccessService> = {
    visible: computed(() => widgets),
    can: (id) => allowed.includes(id),
    inSection: (s) => widgets.filter((w) => w.section === s),
  };
  TestBed.configureTestingModule({
    imports: [CardsTopComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      { provide: DashboardAccessService, useValue: access },
      { provide: DashboardService, useValue: { filters: signal({}), getSummary: () => of(summary) } },
      { provide: LoginService, useValue: { permissions: signal([]), sidebar: signal([]) } },
    ],
  });
  // `part` is a static host attribute, read at construction.
  TestBed.overrideComponent(CardsTopComponent, { set: { host: { part } } });
  const fixture: ComponentFixture<CardsTopComponent> = TestBed.createComponent(CardsTopComponent);
  fixture.detectChanges();
  return fixture;
}

describe('CardsTopComponent (permission-aware cards)', () => {
  it('keeps only the allowed KPIs, sized for their count, without the hero when revenue is hidden', () => {
    const fixture = setup(['completedBookings', 'cancellationRate'], 'platform');
    const c = fixture.componentInstance;
    expect(c.platformCards().map((k) => k.id)).toEqual(['completedBookings', 'cancellationRate']);
    expect(c.hasHero()).toBeFalse();
    const grid = (fixture.nativeElement as HTMLElement).querySelector('[data-role=kpi-grid]')!;
    expect(grid.getAttribute('data-count')).toBe('2');
    expect(grid.querySelectorAll('.d3-kpi').length).toBe(2);
  });

  it('never renders a metric the server withheld (null), and never as zero', () => {
    const scoped = { ...SUMMARY, platform: { ...SUMMARY.platform!, revenue: null } } as DashboardSummary;
    const fixture = setup(['revenue', 'completedBookings'], 'platform', scoped);
    expect(fixture.componentInstance.platformCards().map((k) => k.id)).toEqual(['completedBookings']);
  });

  it('a withheld app group builds no tiles at all', () => {
    const fixture = setup(['activeHosts', 'registeredGuests'], 'apps', { ...SUMMARY, merchantApp: null } as DashboardSummary);
    const hosts = fixture.componentInstance.appPanels().find((p) => p.key === 'hosts')!;
    expect(hosts.cards).toEqual([]);
  });

  it('a single panel (hosts only) spans the row with its tiles side by side', () => {
    const fixture = setup(['activeHosts', 'listedUnits', 'occupancyRate'], 'apps');
    const panels = fixture.componentInstance.appPanels();
    expect(panels.map((p) => p.key)).toEqual(['hosts']);
    expect(panels[0].cols).toBe(3);
    expect(panels[0].cards.map((k) => k.id)).toEqual(['activeHosts', 'listedUnits', 'occupancyRate']);
  });

  it('beside the other panel, an odd last tile spans its row instead of leaving a gap', () => {
    const fixture = setup(['activeHosts', 'listedUnits', 'occupancyRate', 'registeredGuests', 'returningGuests'], 'apps');
    const c = fixture.componentInstance;
    const [hosts, guests] = c.appPanels();
    expect(hosts.cols).toBe(2);
    expect(c.tileSpans(hosts, 2, 3)).toBeTrue();
    expect(c.tileSpans(guests, 1, 2)).toBeFalse();
  });
});
