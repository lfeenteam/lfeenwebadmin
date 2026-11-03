import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

export type FaqFormField = 'titleAr' | 'titleEn' | 'contentAr' | 'contentEn' | 'order';

export interface FaqSaveError {
  /** Server messages (already localized) keyed by the dialog's form control. */
  fieldErrors: Partial<Record<FaqFormField, string>>;
  /** Shown above the dialog's buttons when no field claims the error. */
  message: string | null;
}

// The API names the answer "Body" and the order "DisplayOrder"; the form uses content/order.
const SERVER_FIELD_TO_FORM: Record<string, FaqFormField> = {
  titlear: 'titleAr',
  titleen: 'titleEn',
  bodyar: 'contentAr',
  bodyen: 'contentEn',
  displayorder: 'order'
};

/**
 * POST/PUT /api/client-faq reject with
 * `{ success: false, message, errors: [{ field, message }] }`; each message is localized
 * by the server (Accept-Language). Network/5xx failures fall back to the generic text.
 */
export function parseFaqSaveError(err: unknown, translate: TranslateService): FaqSaveError {
  const e = err as HttpErrorResponse;
  const body = (e?.error ?? {}) as { message?: unknown; errors?: unknown };
  const generic = translate.instant('d3.toast.errorOp');

  if (!e?.status || e.status >= 500) return { fieldErrors: {}, message: generic };

  const fieldErrors: FaqSaveError['fieldErrors'] = {};
  const unclaimed: string[] = [];
  if (Array.isArray(body.errors)) {
    for (const item of body.errors as { field?: string; message?: string }[]) {
      if (!item?.message) continue;
      const field = SERVER_FIELD_TO_FORM[(item.field ?? '').toLowerCase()];
      if (field) fieldErrors[field] ??= item.message;
      else unclaimed.push(item.message);
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const apiMessage = typeof body.message === 'string' ? body.message.trim() : '';
  // With field errors, the envelope's message ("validation failed") adds nothing.
  const message = unclaimed.length ? unclaimed.join(' - ') : hasFieldErrors ? null : apiMessage || generic;

  return { fieldErrors, message };
}
