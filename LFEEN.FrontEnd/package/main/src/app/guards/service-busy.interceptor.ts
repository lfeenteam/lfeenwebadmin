import { Injectable, Injector } from '@angular/core';
import {
  HttpContextToken,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import {
  SERVICE_BUSY,
  isNetworkUnstableError,
  isServiceBusyError,
  isTooManyRequestsError,
  retryAfterMs,
  transportErrorMessage,
} from '../pages/dashboards/dashboard3/utils/transport-error.util';

/** Set to true on a read that must not be retried automatically (e.g. polling). */
export const SKIP_BUSY_RETRY = new HttpContextToken<boolean>(() => false);

/** Only reads are retried: a write (payment, booking, hold, wallet change…) could run twice. */
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);

/** Up to this much is added to Retry-After so the retries of many open tabs don't land together. */
const RETRY_JITTER_MS = 500;

/**
 * BUG-1848 — 503 SERVICE_BUSY / 408 NETWORK_UNSTABLE / 429.
 * 1. A read that gets a 503 is retried once, after Retry-After (default 5s). Never more, and
 *    never a write — those leave it to the admin's own "retry" (the form stays open).
 * 2. The error that reaches the page always carries a message for these statuses, so every
 *    screen that shows `error.message` says "the service is busy" — also for a bodiless 503
 *    from nginx / the gateway, or an older 503 that still said "your connection is unstable".
 *
 * Registered before AuthInterceptor, so the retry goes through it again with the current token.
 */
@Injectable()
export class ServiceBusyInterceptor implements HttpInterceptor {
  // TranslateService loads its files over HttpClient, so it is resolved lazily
  // (injecting it here directly would make a DI cycle with HTTP_INTERCEPTORS).
  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const canRetry = RETRYABLE_METHODS.has(req.method.toUpperCase()) && !req.context.get(SKIP_BUSY_RETRY);

    let handled = next.handle(req);
    if (canRetry) {
      handled = handled.pipe(
        retry({
          count: 1,
          delay: (error) =>
            isServiceBusyError(error)
              ? timer(retryAfterMs(error) + Math.floor(Math.random() * RETRY_JITTER_MS))
              : throwError(() => error),
        })
      );
    }

    return handled.pipe(catchError((error) => throwError(() => this.withMessage(error))));
  }

  private withMessage(error: unknown): unknown {
    if (!(error instanceof HttpErrorResponse)) return error;
    if (!isServiceBusyError(error) && !isNetworkUnstableError(error) && !isTooManyRequestsError(error)) {
      return error;
    }

    const translate = this.translator();
    if (!translate) return error;
    const message = transportErrorMessage(error, translate);
    // The translations themselves may be what failed to load: then keep the error as it came.
    if (!message || message.startsWith('common.httpErrors.')) return error;

    const original = error.error && typeof error.error === 'object' && !(error.error instanceof Blob)
      ? error.error
      : {};
    const body = {
      ...original,
      success: false,
      message,
      ...(isServiceBusyError(error) ? { errorCode: SERVICE_BUSY } : {}),
    };

    return new HttpErrorResponse({
      error: body,
      headers: error.headers,
      status: error.status,
      statusText: error.statusText,
      url: error.url ?? undefined,
    });
  }

  private translator(): TranslateService | null {
    try {
      return this.injector.get(TranslateService);
    } catch {
      return null;
    }
  }
}
