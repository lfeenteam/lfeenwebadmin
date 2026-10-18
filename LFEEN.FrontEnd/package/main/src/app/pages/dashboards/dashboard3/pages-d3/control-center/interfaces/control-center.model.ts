export type ControlCenterApp = 'client' | 'merchant';
export type ControlCenterPlatform = 'ios' | 'android';
/** Which platforms a maintenance window applies to. */
export type MaintenanceTarget = 'all' | ControlCenterPlatform;
export type AppRunStatus = 'running' | 'maintenance';

export interface AppPlatformStatus {
  app: ControlCenterApp;
  platform: ControlCenterPlatform;
  status: AppRunStatus;
}

export interface ControlCenterSummary {
  platformsCount: number;
  maintenanceCount: number;
  activeThemes: number;
  scheduledThemes: number;
  apps: AppPlatformStatus[];
}

export interface MaintenanceSettings {
  app: ControlCenterApp;
  target: MaintenanceTarget;
  enabled: boolean;
  scheduled: boolean;
  /** Local date-time strings ("yyyy-MM-ddTHH:mm"), only meaningful when `scheduled`. */
  startsAt: string | null;
  endsAt: string | null;
  title: string;
  message: string;
  /** The bypass key itself is write-only — the API only says whether one is set. */
  hasBypassKey: boolean;
}

export interface SaveMaintenanceRequest extends Omit<MaintenanceSettings, 'hasBypassKey'> {
  /** Omitted = keep the current key. */
  bypassKey?: string;
}

export type ControlCenterTab = 'maintenance' | 'updates' | 'themes';

/**
 * - `forced`   — versions below `minSupportedVersion` are blocked until updated (API answers 426)
 * - `optional` — users are prompted but can skip
 * - `none`     — no prompt at all
 */
export type UpdatePolicy = 'forced' | 'optional' | 'none';

export interface SeasonalTheme {
  id: number;
  name: string;
  /** Unique slug the apps load the theme by, e.g. "ramadan-2026". */
  key: string;
  app: ControlCenterApp;
  /** "yyyy-MM-dd", both inclusive. */
  startDate: string;
  endDate: string;
  /** "#RRGGBB" */
  primaryColor: string;
  secondaryColor: string;
  bannerUrl: string | null;
  enabled: boolean;
}

export type SaveThemeRequest = Omit<SeasonalTheme, 'id'>;

export type ThemeStatus = 'active' | 'scheduled' | 'expired' | 'disabled';

/** Derived, never stored: an enabled theme is active inside its window, scheduled before it. */
export function themeStatus(theme: SeasonalTheme, todayIso: string): ThemeStatus {
  if (!theme.enabled) return 'disabled';
  if (theme.endDate < todayIso) return 'expired';
  return theme.startDate > todayIso ? 'scheduled' : 'active';
}

export function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** One record per app + platform: versions are released per store. */
export interface AppVersionSettings {
  app: ControlCenterApp;
  platform: ControlCenterPlatform;
  /** "major.minor.patch" */
  latestVersion: string;
  minSupportedVersion: string;
  policy: UpdatePolicy;
  storeUrl: string;
  message: string;
}
