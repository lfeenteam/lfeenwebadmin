import { HttpErrorResponse } from '@angular/common/http';

export type AgreementErrorKind = 'network' | 'validation' | 'forbidden' | 'notFound' | 'other';

export interface AgreementApiError {
  kind: AgreementErrorKind;
  status: number;
  errorCode: string | null;
  /** The server's own localized message (Accept-Language), if any. */
  message: string | null;
  /** Field errors keyed by normalized field name, e.g. "titleen", "clauses[2].contentar". */
  fields: Record<string, string>;
}

/** "$.Clauses[2].ContentAr" / "clauses[2].contentAr" → "clauses[2].contentar". */
export function normalizeAgreementField(field: unknown): string {
  return String(field ?? '')
    .trim()
    .replace(/^\$\.?/, '')
    .toLowerCase();
}

/** Field key the templates look up, matching normalizeAgreementField. */
export function fieldKey(name: string, clauseIndex?: number): string {
  return (clauseIndex === undefined ? name : `clauses[${clauseIndex}].${name}`).toLowerCase();
}

/**
 * Reads any error from /api/admin/agreements. The body is
 * `{ success:false, message, errorCode, errors:[{field,message}] }`, passed through
 * unchanged from the main backend; ASP.NET model-binding errors come as an object map.
 */
export function parseAgreementError(err: unknown): AgreementApiError {
  const http = err instanceof HttpErrorResponse ? err : null;
  const status = http?.status ?? 0;
  const body: any = http?.error && typeof http.error === 'object' ? http.error : null;

  const fields: Record<string, string> = {};
  const errors = body?.errors;
  if (Array.isArray(errors)) {
    for (const e of errors) {
      const key = normalizeAgreementField(e?.field);
      if (key && e?.message && !fields[key]) fields[key] = String(e.message);
    }
  } else if (errors && typeof errors === 'object') {
    for (const [field, messages] of Object.entries(errors)) {
      const key = normalizeAgreementField(field);
      const first = Array.isArray(messages) ? messages[0] : messages;
      if (key && key !== 'request' && first && !fields[key]) fields[key] = String(first);
    }
  }

  const kind: AgreementErrorKind =
    status === 0 ? 'network'
    : status === 400 ? 'validation'
    : status === 403 ? 'forbidden'
    : status === 404 ? 'notFound'
    : 'other';

  const message = typeof body?.message === 'string' && body.message.trim() ? body.message.trim() : null;
  return { kind, status, errorCode: body?.errorCode ?? null, message, fields };
}

/**
 * The PDF endpoint is requested as a blob, so its JSON error body arrives as a Blob
 * too: read it back into a normal error before parsing.
 */
export async function parseBlobError(err: unknown): Promise<AgreementApiError> {
  if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
    try {
      const body = JSON.parse(await err.error.text());
      return parseAgreementError(
        new HttpErrorResponse({ error: body, status: err.status, statusText: err.statusText, url: err.url ?? undefined }),
      );
    } catch {
      /* not JSON: fall through */
    }
  }
  return parseAgreementError(err);
}
