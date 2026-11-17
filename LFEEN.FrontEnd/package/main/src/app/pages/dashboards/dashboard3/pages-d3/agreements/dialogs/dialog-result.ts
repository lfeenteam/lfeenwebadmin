import { TranslateService } from '@ngx-translate/core';
import { AgreementVersion } from '../interfaces/agreement.model';
import { AgreementApiError } from '../utils/agreement-errors.util';

/**
 * How a dialog that sends a write request ended:
 * - done: the request succeeded.
 * - unknown: the network failed mid-request, so it may or may not have gone through.
 *   The caller refreshes and lets the admin decide; publish/end are never resent on their own.
 * - notFound: the version is gone (404); the caller goes back to the list.
 */
export type AgreementDialogResult =
  | { kind: 'done'; version: AgreementVersion }
  | { kind: 'unknown' }
  | { kind: 'notFound'; message: string | null };

/** Inline text for an error the dialog keeps open for (validation without a matching field, 403, 5xx…). */
export function dialogErrorText(error: AgreementApiError, translate: TranslateService): string {
  if (error.kind === 'forbidden') return translate.instant('d3.agreements.errors.forbidden');
  return error.message || translate.instant('d3.agreements.errors.action');
}
