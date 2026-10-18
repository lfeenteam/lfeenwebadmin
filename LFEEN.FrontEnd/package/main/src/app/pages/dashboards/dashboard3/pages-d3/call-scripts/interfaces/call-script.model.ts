import { TranslateService } from '@ngx-translate/core';

// Mirrors the /api/call-scripts payloads. Platform-wide (not merchant-scoped):
// only two scenarios exist today, and multiple scripts can exist per scenario
// (version history) but at most one is isActive at a time.

export type CallScriptScenarioType =
  | 'ExtensionOfferAvailable'
  | 'ExtensionNotAvailable'
  | (string & {});

export interface CallScriptOption {
  digit: string;
  description: string;
  responseMessageFileUrl?: string | null;
}

export interface CallScript {
  id: number;
  scenarioType: CallScriptScenarioType;
  scenarioLabel: string;
  audioFileUrl: string;
  options: CallScriptOption[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCallScriptRequest {
  scenarioType: CallScriptScenarioType;
  audioFileUrl: string;
  options: CallScriptOption[];
  isActive: boolean;
}

// scenarioType is fixed at creation and can't be changed through this request.
export interface UpdateCallScriptRequest {
  audioFileUrl: string;
  options: CallScriptOption[];
  isActive: boolean;
}

// Fixed set per the API contract — there is no endpoint to discover scenarios
// dynamically. Used to populate the scenario picker when creating a script;
// the raw value is what's sent to the API.
export const CALL_SCRIPT_SCENARIOS: CallScriptScenarioType[] = [
  'ExtensionOfferAvailable',
  'ExtensionNotAvailable',
];

/**
 * Display name for a scenario: the localized label when we have one, else the
 * API's scenarioLabel (English only), else the raw enum value so an unknown
 * scenario added by the backend still renders something.
 */
export function scenarioDisplayName(
  translate: TranslateService,
  scenarioType: CallScriptScenarioType,
  apiLabel?: string | null
): string {
  const key = `d3.callScripts.scenarios.${scenarioType}.label`;
  const translated = translate.instant(key);
  if (translated && translated !== key) return translated;
  return apiLabel || scenarioType;
}

/** Short explanation shown under a scenario in the picker; empty when unknown. */
export function scenarioHint(translate: TranslateService, scenarioType: CallScriptScenarioType): string {
  const key = `d3.callScripts.scenarios.${scenarioType}.hint`;
  const translated = translate.instant(key);
  return translated && translated !== key ? translated : '';
}
