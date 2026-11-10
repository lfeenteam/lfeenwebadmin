import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

export interface ControlCenterError {
  status: number;
  /** Main-API code (e.g. APP_THEME_KEY_ALREADY_EXISTS) — branch on this, never on the text. */
  errorCode: string | null;
  /** Our backend's per-field rejections, keyed by camelCase form field ("EndDate" → "endDate"). */
  fieldErrors: Record<string, string>;
  /** Shown beside the form / in a toast when no field claims it. */
  message: string;
}

/**
 * Two error shapes come back:
 *  a) our backend: `{ success: false, message, errors: [{ field, message }] }`
 *  b) the main API: `{ success: false, message, errorCode }` — VALIDATION_ERROR's message
 *     is a specific English sentence that can be shown as is.
 * 401 is handled by AuthInterceptor (back to login).
 */
export function parseControlCenterError(err: unknown, translate: TranslateService): ControlCenterError {
  const e = err as HttpErrorResponse;
  const body = (e?.error ?? {}) as { message?: unknown; errorCode?: unknown; errors?: unknown };
  const t = (key: string) => translate.instant(`d3.controlCenter.errors.${key}`);
  const status = e?.status ?? 0;
  const apiMessage = typeof body.message === 'string' ? body.message.trim() : '';

  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(body.errors)) {
    for (const item of body.errors as { field?: string; message?: string }[]) {
      if (!item?.field || !item.message) continue;
      const key = item.field.charAt(0).toLowerCase() + item.field.slice(1);
      fieldErrors[key] ??= item.message;
    }
  }

  const errorCode = typeof body.errorCode === 'string' ? body.errorCode : null;

  let message: string;
  if (!status || status >= 500) message = t('network');
  else if (status === 403) message = t('forbidden');
  // A bare 404 (no errorCode, e.g. APP_THEME_NOT_FOUND) means the endpoint itself is missing:
  // the environment's backend doesn't ship /api/app-runtime yet.
  else if (status === 404 && !errorCode) message = t('unavailable');
  else message = apiMessage || t('generic');

  return {
    status,
    errorCode,
    fieldErrors,
    message,
  };
}
