// Shapes of LFEENAdmin.API /api/app-runtime/*. URLs and queries use lowercase
// ("client", "host", "ios", "android"); JSON bodies use PascalCase enums.

/** URL form of the two apps this screen manages. */
export type ControlCenterApp = 'client' | 'host';
/** URL form of the two platforms this screen manages (Web is never touched here). */
export type ControlCenterPlatform = 'android' | 'ios';

export type ApiApp = 'Client' | 'Host' | 'ServiceApp';
export type ApiPlatform = 'Android' | 'Ios' | 'Web';

export const API_APP: Record<ControlCenterApp, ApiApp> = { client: 'Client', host: 'Host' };
export const API_PLATFORM: Record<ControlCenterPlatform, ApiPlatform> = { android: 'Android', ios: 'Ios' };

export type ControlCenterTab = 'maintenance' | 'updates' | 'themes';

// ── Summary ───────────────────────────────────────────────────

export type PlatformRunStatus = 'Running' | 'UnderMaintenance' | 'MaintenanceScheduled';

export interface SummaryPlatform {
  app: ApiApp;
  platform: ApiPlatform;
  status: PlatformRunStatus;
  maintenanceStartsAtUtc: string | null;
  maintenanceEndsAtUtc: string | null;
  latestVersion: string | null;
  minSupportedVersion: string | null;
}

export interface ControlCenterSummary {
  platformsCount: number;
  underMaintenanceCount: number;
  liveThemesCount: number;
  scheduledThemesCount: number;
  pendingReviewThemesCount: number;
  lastUpdatedAtUtc: string | null;
  platforms: SummaryPlatform[];
}

// ── Themes ────────────────────────────────────────────────────

export type ThemeStatus = 'Live' | 'Scheduled' | 'PendingReview' | 'Inactive' | 'Expired';
export type ThemeReviewStatus = 'Approved' | 'PendingReview';
/** Request-side target; "All" comes back as `app: null`. */
export type ThemeTargetApp = 'Client' | 'Host' | 'All';

export interface ThemeColors {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  background: string | null;
  text: string | null;
}

export interface SeasonalTheme {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string | null;
  /** null = every app. */
  app: ApiApp | null;
  colors: ThemeColors;
  bannerUrl: string | null;
  /** Inclusive Saudi days, "yyyy-MM-dd" — display these, never startsAtUtc/endsAtUtc. */
  startDate: string;
  endDate: string;
  startDateHijri: string | null;
  endDateHijri: string | null;
  isActive: boolean;
  status: ThemeStatus;
  reviewStatus: ThemeReviewStatus;
  templateId: string | null;
  updatedAtUtc: string | null;
}

/**
 * Create and partial update share this body: on PUT a missing/null field keeps its
 * value and "" clears an optional text field.
 */
export interface SaveThemeRequest {
  nameAr?: string;
  key?: string;
  app?: ThemeTargetApp;
  startDate?: string;
  endDate?: string;
  primaryColor?: string;
  secondaryColor?: string;
  bannerUrl?: string;
  isActive?: boolean;
}

// ── Releases & maintenance (one record per app + platform) ────

export type UpdatePolicy = 'Forced' | 'Optional';

export interface VersionImpactRow {
  version: string;
  installs: number;
  percent: number;
}

export interface VersionImpact {
  app: ApiApp;
  platform: ApiPlatform;
  minVersion: string;
  /** false = no install data yet — not "zero impact". */
  hasData: boolean;
  basedOnDay: string | null;
  totalInstalls: number;
  affectedInstalls: number;
  affectedPercent: number;
  affectedVersions: VersionImpactRow[];
}

export interface ReleaseConfig {
  /** null = this platform was never configured; the form starts empty. */
  id: string | null;
  app: ApiApp;
  platform: ApiPlatform;
  minSupportedVersion: string | null;
  latestVersion: string | null;
  storeUrl: string | null;
  updateMessageAr: string | null;
  updateMessageEn: string | null;
  /** true = "Forced" policy. */
  enforceMinVersionOnServer: boolean;
  isMaintenanceEnabled: boolean;
  /** Users are locked out right now (enabled and inside the window). */
  isMaintenanceActiveNow: boolean;
  maintenanceMessageAr: string | null;
  maintenanceMessageEn: string | null;
  maintenanceStartsAtUtc: string | null;
  maintenanceEndsAtUtc: string | null;
  updatedAtUtc: string | null;
  minVersionImpact: VersionImpact | null;
}

export interface SaveReleaseRequest {
  latestVersion?: string;
  minSupportedVersion?: string;
  updatePolicy?: UpdatePolicy;
  storeUrl?: string;
  updateMessageAr?: string;
}

/** "All" = Android + iOS only; the web is never affected. */
export type MaintenanceTarget = 'All' | 'Android' | 'Ios';

export interface SaveMaintenanceRequest {
  target: MaintenanceTarget;
  /** Required on purpose, so a partial body can never switch maintenance off by accident. */
  isEnabled: boolean;
  messageAr?: string;
  /** ISO date-time with the +03:00 offset; null = start now. */
  startsAt?: string | null;
  /** ISO date-time with the +03:00 offset; null = until switched off. */
  endsAt?: string | null;
}

/** "dotted numeric" as the API puts it: 4.8.0, 2.4, 10.0.1.3 */
export const VERSION_PATTERN = /^\d+(\.\d+)*$/;

/** Negative when a < b. Missing parts count as 0, so 4.8 == 4.8.0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}
