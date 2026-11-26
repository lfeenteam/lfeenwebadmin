import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { DashboardService } from './dashboard.service';
import { DashboardAccessService } from './dashboard-widgets';
import { LoginService } from './login/login.service';

describe('DashboardService (per-admin cache, 403 handling)', () => {
  let service: DashboardService;
  let http: HttpTestingController;
  let loggingOut: Subject<void>;
  let user: ReturnType<typeof signal<{ userId: string } | null>>;
  let access: jasmine.SpyObj<DashboardAccessService>;

  beforeEach(() => {
    loggingOut = new Subject<void>();
    user = signal<{ userId: string } | null>({ userId: 'admin-a' });
    access = jasmine.createSpyObj<DashboardAccessService>('DashboardAccessService', ['markForbidden', 'applySummary']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LoginService, useValue: { loggingOut$: loggingOut.asObservable(), currentUser: user } },
        { provide: DashboardAccessService, useValue: access },
      ],
    });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const summaryReq = () => http.expectOne((r) => r.url.endsWith('/api/dashboard/summary'));

  it('shares one summary request per admin and period', () => {
    const got: unknown[] = [];
    service.getSummary({}).subscribe((s) => got.push(s));
    service.getSummary({}).subscribe((s) => got.push(s));
    summaryReq().flush({ who: 'a' }); // expectOne: a second request would fail here
    expect(got).toEqual([{ who: 'a' }, { who: 'a' }]);
  });

  it('never serves one admin\'s cached summary to the next admin', () => {
    service.getSummary({}).subscribe();
    summaryReq().flush({ who: 'a' });

    user.set({ userId: 'admin-b' });
    let got: unknown;
    service.getSummary({}).subscribe((s) => (got = s));
    summaryReq().flush({ who: 'b' });
    expect(got).toEqual({ who: 'b' });
  });

  it('drops the cache and the selected period on logout', () => {
    service.filters.set({ from: '2026-01-01', to: '2026-01-31' });
    service.getSummary({}).subscribe();
    summaryReq().flush({});

    loggingOut.next();
    expect(service.filters()).toEqual({});
    service.getSummary({}).subscribe();
    summaryReq().flush({});
  });

  it('hands every summary to the access service, so withheld groups hide their widgets', () => {
    service.getSummary({}).subscribe();
    summaryReq().flush({ platform: null });
    expect(access.applySummary).toHaveBeenCalledWith(jasmine.objectContaining({ platform: null }));
  });

  it('reports a 403 so the widgets fed by that endpoint are hidden', () => {
    service.getGrowth({}).subscribe({ error: () => undefined });
    http.expectOne((r) => r.url.endsWith('/api/dashboard/growth')).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(access.markForbidden).toHaveBeenCalledWith('growth');
  });

  it('does not treat a network/server error as missing permission', () => {
    service.getInsights({}).subscribe({ error: () => undefined });
    http.expectOne((r) => r.url.endsWith('/api/dashboard/insights')).flush(null, { status: 500, statusText: 'Server Error' });
    service.getTopCities({}).subscribe({ error: () => undefined });
    http.expectOne((r) => r.url.endsWith('/api/dashboard/top-cities')).error(new ProgressEvent('error'));
    expect(access.markForbidden).not.toHaveBeenCalled();
  });
});
