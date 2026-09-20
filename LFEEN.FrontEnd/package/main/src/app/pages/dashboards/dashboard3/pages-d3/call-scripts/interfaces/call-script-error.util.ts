import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * Create/update return a plain 400 for every validation case, including a
 * missing script (IVR_SCRIPT_NOT_FOUND) — the distinguishing signal is the
 * error code in the body, not the HTTP status, so it's matched defensively
 * across a few likely body shapes rather than assuming one exact contract.
 */
export function resolveCallScriptError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.callScripts.errors.${key}`);
  const body = e?.error;
  const signal: string = [body?.code, body?.errorCode, body?.message]
    .filter((v): v is string => typeof v === 'string')
    .join(' ');

  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return t('forbidden');

  if (e.status === 400) {
    if (signal.includes('IVR_SCRIPT_AUDIO_URL_REQUIRED')) return t('audioUrlRequired');
    if (signal.includes('IVR_SCRIPT_OPTIONS_REQUIRED')) return t('optionsRequired');
    if (signal.includes('IVR_SCRIPT_NOT_FOUND')) return t('notFound');
    if (typeof body?.message === 'string' && body.message) return body.message;
  }

  return t('generic');
}
