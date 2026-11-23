export function extractApiErrorMessage(err: any, fallback: string): string {
  const apiErrors = err?.error?.errors;
  if (Array.isArray(apiErrors) && apiErrors.length > 0) {
    return apiErrors.map((e: any) => e?.message).filter(Boolean).join(' - ') || fallback;
  }
  return err?.error?.message || fallback;
}

export interface ApiFieldError {
  /** Lower-cased field name without the JSON "$." prefix, e.g. "displayorder". */
  field: string;
  /**
   * The server's own (localized) text, or null when it came from ASP.NET model binding
   * (English framework text such as "The value '…' is not valid for X."), which the
   * caller should replace with its own message.
   */
  message: string | null;
}

/** "$.displayOrder" / "DisplayOrder" → "displayorder". */
export function normalizeApiField(field: unknown): string {
  return String(field ?? '').trim().replace(/^\$\.?/, '').toLowerCase();
}

/**
 * Field errors from a 400 in either shape the API returns:
 * - our envelope: `{ errors: [{ field, message }] }`
 * - ASP.NET ValidationProblemDetails (model binding, e.g. int overflow):
 *   `{ errors: { "MaxStayDays": ["…"], "$.displayOrder": ["…"], "request": ["…"] } }`
 * The "request" entry only says the whole body failed to bind, so it is dropped.
 */
export function extractApiFieldErrors(err: any): ApiFieldError[] {
  const errors = err?.error?.errors;
  if (Array.isArray(errors)) {
    return errors
      .filter((e: any) => e?.message)
      .map((e: any) => ({ field: normalizeApiField(e.field), message: String(e.message) }));
  }
  if (errors && typeof errors === 'object') {
    return Object.keys(errors)
      .map(normalizeApiField)
      .filter((field) => field && field !== 'request')
      .map((field) => ({ field, message: null }));
  }
  return [];
}
