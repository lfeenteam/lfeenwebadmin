import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * BUG-1848: the API now tells a busy server apart from a dropped client connection.
 * - 503 SERVICE_BUSY (+ Retry-After: 5): SQL / Redis / storage / gateway / timeout on our side.
 * - 408 NETWORK_UNSTABLE: the client's own connection dropped.
 * A 503 from nginx or the gateway (no SERVICE_BUSY body) is treated as SERVICE_BUSY too.
 */
export const SERVICE_BUSY = 'SERVICE_BUSY';
export const NETWORK_UNSTABLE = 'NETWORK_UNSTABLE';
export const TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS';

/** NetworkExceptionHelper.ServiceBusyRetryAfterSeconds on the backend. */
export const DEFAULT_RETRY_AFTER_SECONDS = 5;
const MAX_RETRY_AFTER_SECONDS = 30;

export const TRANSPORT_MESSAGE_KEYS = {
  serviceBusy: 'common.httpErrors.serviceBusy',
  networkUnstable: 'common.httpErrors.networkUnstable',
  tooManyRequests: 'common.httpErrors.tooManyRequests',
} as const;

function statusOf(err: unknown): number {
  const status = (err as HttpErrorResponse)?.status;
  return typeof status === 'number' ? status : 0;
}

export function isServiceBusyError(err: unknown): boolean {
  return statusOf(err) === 503;
}

export function isNetworkUnstableError(err: unknown): boolean {
  return statusOf(err) === 408;
}

export function isTooManyRequestsError(err: unknown): boolean {
  return statusOf(err) === 429;
}

/**
 * 403: the admin lacks the permission. The API sends it with an empty body, so pages
 * must check the status — an inline load error then reads "no permission"
 * (d3.state.forbidden / forbiddenDesc), not "couldn't reach the server" (BUG-2496).
 */
export function isForbiddenError(err: unknown): boolean {
  return statusOf(err) === 403;
}

/**
 * Delay before the one automatic retry of a read, from Retry-After (seconds or an HTTP date).
 * The header is only readable when the API exposes it over CORS; otherwise the default applies.
 */
export function retryAfterMs(err: unknown, now = Date.now()): number {
  const raw = (err as HttpErrorResponse)?.headers?.get?.('Retry-After')?.trim();
  let seconds = DEFAULT_RETRY_AFTER_SECONDS;
  if (raw) {
    if (/^\d+$/.test(raw)) {
      seconds = Number(raw);
    } else {
      const at = Date.parse(raw);
      if (!Number.isNaN(at)) seconds = Math.ceil((at - now) / 1000);
    }
  }
  seconds = Math.min(Math.max(seconds, 1), MAX_RETRY_AFTER_SECONDS);
  return seconds * 1000;
}

function serverMessage(err: unknown): string {
  const message = (err as HttpErrorResponse)?.error?.message;
  return typeof message === 'string' ? message.trim() : '';
}

function serverErrorCode(err: unknown): string {
  const body = (err as HttpErrorResponse)?.error;
  const code = body && typeof body === 'object' ? body.errorCode ?? body.code : null;
  return typeof code === 'string' ? code : '';
}

/**
 * The text for a busy server (503), a dropped connection (408) or a rate limit (429):
 * the server's own localized message when it sent one, else ours. Null for anything else,
 * so the caller goes on with its own handling (403 stays a permission message, etc.).
 * A 503 only keeps the server text when it is SERVICE_BUSY: an older 503 NETWORK_UNSTABLE
 * ("your connection is unstable") or a gateway page must not blame the admin's connection.
 */
export function transportErrorMessage(err: unknown, translate: TranslateService): string | null {
  if (isServiceBusyError(err)) {
    const own = serverErrorCode(err) === SERVICE_BUSY ? serverMessage(err) : '';
    return own || translate.instant(TRANSPORT_MESSAGE_KEYS.serviceBusy);
  }
  if (isNetworkUnstableError(err)) {
    return serverMessage(err) || translate.instant(TRANSPORT_MESSAGE_KEYS.networkUnstable);
  }
  if (isTooManyRequestsError(err)) {
    return serverMessage(err) || translate.instant(TRANSPORT_MESSAGE_KEYS.tooManyRequests);
  }
  return null;
}
