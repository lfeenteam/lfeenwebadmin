import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { transportErrorMessage } from '../../../utils/transport-error.util';

/**
 * The API tells cases apart by errorCode, not by HTTP status: the same code can
 * arrive as 400, 404 or 409 (or inside a 200 with success=false, see the service),
 * so the code is matched first, whatever the status.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  IVR_SCRIPT_SCENARIO_CONFLICT: 'scenarioConflict',
  IVR_SCRIPT_DELETE_ACTIVE_NOT_ALLOWED: 'deleteActiveNotAllowed',
  IVR_SCRIPT_AUDIO_URL_REQUIRED: 'audioUrlRequired',
  IVR_SCRIPT_AUDIO_URL_INVALID: 'audioUrlInvalid',
  IVR_SCRIPT_RESPONSE_URL_INVALID: 'responseUrlInvalid',
  IVR_SCRIPT_OPTION_DIGIT_INVALID: 'digitInvalid',
  IVR_SCRIPT_DUPLICATE_DIGIT: 'digitDuplicate',
  IVR_SCRIPT_OPTION_DESCRIPTION_INVALID: 'descriptionInvalid',
  IVR_SCRIPT_TOO_MANY_OPTIONS: 'tooManyOptions',
  IVR_SCRIPT_OPTIONS_REQUIRED: 'optionsRequired',
  IVR_SCRIPT_NOT_FOUND: 'notFound',
};

export function resolveCallScriptError(err: unknown, translate: TranslateService): string {
  const e = err as HttpErrorResponse;
  const t = (key: string) => translate.instant(`d3.callScripts.errors.${key}`);
  const body = e?.error;
  const signal: string = [body?.errorCode, body?.code, body?.message]
    .filter((v): v is string => typeof v === 'string')
    .join(' ');

  const transport = transportErrorMessage(err, translate);
  if (transport) return transport;

  const code = Object.keys(ERROR_CODE_KEYS).find(c => signal.includes(c));
  if (code) return t(ERROR_CODE_KEYS[code]);

  if (!e?.status || e.status >= 500) return t('network');
  if (e.status === 403) return t('forbidden');
  if (e.status === 405) return t('deleteUnavailable');
  if (typeof body?.message === 'string' && body.message) return body.message;

  return t('generic');
}
