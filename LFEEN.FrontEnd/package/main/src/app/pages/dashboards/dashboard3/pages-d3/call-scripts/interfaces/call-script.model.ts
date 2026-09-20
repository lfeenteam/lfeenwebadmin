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
// dynamically. Used only to populate the scenario picker when creating a
// script; the UI never labels or renders a scenario that isn't backed by an
// actual record returned from the API — the raw value here is what's sent to
// the API, and the raw value is what's shown, never a locally invented label.
export const CALL_SCRIPT_SCENARIOS: CallScriptScenarioType[] = [
  'ExtensionOfferAvailable',
  'ExtensionNotAvailable',
];
