import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';
import { SKIP_BUSY_RETRY, ServiceBusyInterceptor } from './service-busy.interceptor';

const BUSY_AR = 'الخدمة مشغولة حالياً، حاول مرة أخرى بعد قليل.';
const OUR_TEXT: Record<string, string> = {
  'common.httpErrors.serviceBusy': 'OUR_BUSY',
  'common.httpErrors.networkUnstable': 'OUR_NETWORK',
  'common.httpErrors.tooManyRequests': 'OUR_429',
};

describe('ServiceBusyInterceptor (BUG-1848)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: ServiceBusyInterceptor, multi: true },
        { provide: TranslateService, useValue: { instant: (key: string) => OUR_TEXT[key] ?? key } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const busy = (retryAfter = '5') => ({
    body: { success: false, errorCode: 'SERVICE_BUSY', message: BUSY_AR },
    opts: { status: 503, statusText: 'Service Unavailable', headers: { 'Retry-After': retryAfter } },
  });

  it('retries a GET once after Retry-After seconds, then succeeds', fakeAsync(() => {
    let result: unknown;
    http.get('/api/wallet/balance').subscribe((r) => (result = r));

    const b = busy();
    backend.expectOne('/api/wallet/balance').flush(b.body, b.opts);
    tick(4999);
    backend.expectNone('/api/wallet/balance');
    tick(600); // 5s + jitter (< 500ms)
    backend.expectOne('/api/wallet/balance').flush({ balance: 10 });

    expect(result).toEqual({ balance: 10 });
  }));

  it('retries a GET only once and shows the server busy message', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/x').subscribe({ error: (e) => (error = e) });

    const b = busy();
    backend.expectOne('/api/x').flush(b.body, b.opts);
    tick(5600);
    backend.expectOne('/api/x').flush(b.body, b.opts);
    tick(60_000);
    backend.expectNone('/api/x');

    expect(error?.status).toBe(503);
    expect(error?.error.message).toBe(BUSY_AR);
    expect(error?.error.errorCode).toBe('SERVICE_BUSY');
  }));

  it('never retries a write (payment / booking / hold)', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.post('/api/bookings/hold', {}).subscribe({ error: (e) => (error = e) });

    const b = busy();
    backend.expectOne('/api/bookings/hold').flush(b.body, b.opts);
    tick(60_000);
    backend.expectNone('/api/bookings/hold');

    expect(error?.error.message).toBe(BUSY_AR);
  }));

  it('honours SKIP_BUSY_RETRY on a read', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/poll', { context: new HttpContext().set(SKIP_BUSY_RETRY, true) }).subscribe({ error: (e) => (error = e) });
    const b = busy();
    backend.expectOne('/api/poll').flush(b.body, b.opts);
    tick(60_000);
    backend.expectNone('/api/poll');
    expect(error?.status).toBe(503);
  }));

  it('a bodiless 503 (nginx / gateway) gets our busy message', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.post('/api/x', {}).subscribe({ error: (e) => (error = e) });
    backend.expectOne('/api/x').flush(null, { status: 503, statusText: 'Service Unavailable' });
    expect(error?.error.message).toBe('OUR_BUSY');
    expect(error?.error.errorCode).toBe('SERVICE_BUSY');
  }));

  it('an old 503 NETWORK_UNSTABLE does not say "your connection is unstable"', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.post('/api/x', {}).subscribe({ error: (e) => (error = e) });
    backend.expectOne('/api/x').flush(
      { success: false, errorCode: 'NETWORK_UNSTABLE', message: 'يبدو أن اتصالك بالإنترنت غير مستقر' },
      { status: 503, statusText: 'Service Unavailable' }
    );
    expect(error?.error.message).toBe('OUR_BUSY');
  }));

  it('408 keeps the connection message and is not retried', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/x').subscribe({ error: (e) => (error = e) });
    backend.expectOne('/api/x').flush(null, { status: 408, statusText: 'Request Timeout' });
    tick(60_000);
    backend.expectNone('/api/x');
    expect(error?.error.message).toBe('OUR_NETWORK');
  }));

  it('429 shows the server message and is not retried', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/x').subscribe({ error: (e) => (error = e) });
    backend.expectOne('/api/x').flush({ message: 'slow down' }, { status: 429, statusText: 'Too Many Requests' });
    tick(60_000);
    backend.expectNone('/api/x');
    expect(error?.error.message).toBe('slow down');
  }));

  it('403 passes through untouched (permission message, not network)', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/wallet/ledger').subscribe({ error: (e) => (error = e) });
    backend.expectOne('/api/wallet/ledger').flush({ errorCode: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    tick(60_000);
    backend.expectNone('/api/wallet/ledger');
    expect(error?.status).toBe(403);
    expect(error?.error).toEqual({ errorCode: 'FORBIDDEN' });
  }));
});
