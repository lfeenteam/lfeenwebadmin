import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { extractApiFieldErrors } from '../../../utils/api-error.util';
import { transportErrorMessage } from '../../../utils/transport-error.util';
import { SERVICE_FAQ_ERROR_CODES } from './service-faq.model';

export type ServiceFaqFormField =
  | 'key' | 'category' | 'questionAr' | 'questionEn' | 'answerAr' | 'answerEn' | 'displayOrder';

export interface ServiceFaqError {
  /** Server messages (already localized) keyed by the dialog's form control. */
  fieldErrors: Partial<Record<ServiceFaqFormField, string>>;
  /** Shown above the dialog buttons / as a toast when no field claims the error. */
  message: string | null;
  errorCode: string | null;
  notFound: boolean;
}

const SERVER_FIELD_TO_FORM: Record<string, ServiceFaqFormField> = {
  key: 'key',
  category: 'category',
  questionar: 'questionAr',
  questionen: 'questionEn',
  answerar: 'answerAr',
  answeren: 'answerEn',
  displayorder: 'displayOrder',
};

/**
 * Errors from /api/service/faqs come as `{ success: false, message, errorCode }`, the message
 * already in the UI language — shown as is.
 * - 400 VALIDATION_ERROR (may also carry `errors: [{ field, message }]`)
 * - 409 STAFF_FAQ_KEY_EXISTS → put on the key field
 * - 404 STAFF_FAQ_NOT_FOUND → the row is gone; the caller reloads the list
 */
export function parseServiceFaqError(err: unknown, translate: TranslateService): ServiceFaqError {
  const e = err as HttpErrorResponse;
  const body = (e?.error ?? {}) as { message?: unknown; errorCode?: unknown; code?: unknown };
  const generic = translate.instant('d3.toast.errorOp');
  const errorCode = typeof body.errorCode === 'string' ? body.errorCode
    : typeof body.code === 'string' ? body.code : null;
  const apiMessage = typeof body.message === 'string' ? body.message.trim() : '';
  const notFound = e?.status === 404 || errorCode === SERVICE_FAQ_ERROR_CODES.notFound;

  const transport = transportErrorMessage(err, translate);
  if (transport) return { fieldErrors: {}, message: transport, errorCode, notFound: false };
  if (!e?.status || e.status >= 500) return { fieldErrors: {}, message: generic, errorCode, notFound: false };

  if (e.status === 409 || errorCode === SERVICE_FAQ_ERROR_CODES.keyExists) {
    const text = apiMessage || translate.instant('d3.serviceFaq.dialog.validation.keyExists');
    return { fieldErrors: { key: text }, message: null, errorCode, notFound };
  }

  // Model-binding errors (bad enum, int overflow) carry English framework text → local text.
  const invalid = translate.instant('d3.serviceFaq.dialog.validation.invalidValue');
  const fieldErrors: ServiceFaqError['fieldErrors'] = {};
  const unclaimed: string[] = [];
  for (const item of extractApiFieldErrors(err)) {
    const field = SERVER_FIELD_TO_FORM[item.field.replace(/^request\./, '')];
    if (field) fieldErrors[field] ??= item.message ?? invalid;
    else if (item.message) unclaimed.push(item.message);
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const message = unclaimed.length
    ? unclaimed.join(' - ')
    : hasFieldErrors ? null : apiMessage || generic;

  return { fieldErrors, message, errorCode, notFound };
}
