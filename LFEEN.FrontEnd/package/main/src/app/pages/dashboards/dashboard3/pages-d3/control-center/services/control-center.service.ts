import { Injectable } from '@angular/core';
import { Observable, of, throwError, timer } from 'rxjs';
import { delay, mergeMap } from 'rxjs/operators';
import {
  AppPlatformStatus, AppVersionSettings, ControlCenterApp, ControlCenterPlatform, ControlCenterSummary,
  MaintenanceSettings, SaveMaintenanceRequest, SaveThemeRequest, SeasonalTheme, themeStatus, todayIsoDate,
} from '../interfaces/control-center.model';

const FAKE_LATENCY_MS = 300;

/**
 * There's no control-center endpoint yet, so this keeps design sample data in memory.
 * Swap the bodies for HttpClient calls once the backend ships — the signatures stay.
 */
@Injectable({ providedIn: 'root' })
export class ControlCenterService {
  private settings: Record<ControlCenterApp, MaintenanceSettings> = {
    client: this.defaultSettings('client'),
    merchant: this.defaultSettings('merchant'),
  };
  /** Keyed "app-platform"; filled lazily with defaults on first read. */
  private versions: Record<string, AppVersionSettings> = {};
  private themes: SeasonalTheme[] = this.sampleThemes();
  private nextThemeId = 3;

  getSummary(): Observable<ControlCenterSummary> {
    const apps = this.appStatuses();
    const today = todayIsoDate();
    const statuses = this.themes.map(t => themeStatus(t, today));
    return of({
      platformsCount: apps.length,
      maintenanceCount: apps.filter(a => a.status === 'maintenance').length,
      activeThemes: statuses.filter(s => s === 'active').length,
      scheduledThemes: statuses.filter(s => s === 'scheduled').length,
      apps,
    }).pipe(delay(FAKE_LATENCY_MS));
  }

  // ── Seasonal themes ─────────────────────────────────────────

  getThemes(): Observable<SeasonalTheme[]> {
    return of(this.themes.map(t => ({ ...t }))).pipe(delay(FAKE_LATENCY_MS));
  }

  /** Creates when `id` is null. Fails with a 409 when the key is already taken, like the API will. */
  saveTheme(id: number | null, body: SaveThemeRequest): Observable<SeasonalTheme> {
    const key = body.key.trim().toLowerCase();
    if (this.themes.some(t => t.key === key && t.id !== id)) {
      return timer(FAKE_LATENCY_MS).pipe(mergeMap(() => throwError(() => ({ status: 409 }))));
    }
    const saved: SeasonalTheme = { ...body, key, id: id ?? this.nextThemeId++ };
    this.themes = id == null ? [...this.themes, saved] : this.themes.map(t => (t.id === id ? saved : t));
    return of({ ...saved }).pipe(delay(FAKE_LATENCY_MS));
  }

  /** Dates sit around today so the sample shows both an active and a scheduled theme. */
  private sampleThemes(): SeasonalTheme[] {
    const shift = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    return [
      {
        id: 1, name: 'رمضان كريم', key: 'ramadan-2026', app: 'client',
        startDate: shift(-5), endDate: shift(25),
        primaryColor: '#153E36', secondaryColor: '#DDBE74', bannerUrl: null, enabled: true,
      },
      {
        id: 2, name: 'اليوم الوطني', key: 'saudi-national-day', app: 'client',
        startDate: shift(30), endDate: shift(35),
        primaryColor: '#0F7A3D', secondaryColor: '#DDBE74', bannerUrl: null, enabled: true,
      },
    ];
  }

  getMaintenance(app: ControlCenterApp): Observable<MaintenanceSettings> {
    return of({ ...this.settings[app] }).pipe(delay(FAKE_LATENCY_MS));
  }

  saveMaintenance(body: SaveMaintenanceRequest): Observable<MaintenanceSettings> {
    const { bypassKey, ...rest } = body;
    const saved: MaintenanceSettings = {
      ...rest,
      hasBypassKey: this.settings[body.app].hasBypassKey || !!bypassKey,
    };
    this.settings[body.app] = saved;
    return of({ ...saved }).pipe(delay(FAKE_LATENCY_MS));
  }

  getVersionSettings(app: ControlCenterApp, platform: ControlCenterPlatform): Observable<AppVersionSettings> {
    const key = `${app}-${platform}`;
    this.versions[key] ??= this.defaultVersion(app, platform);
    return of({ ...this.versions[key] }).pipe(delay(FAKE_LATENCY_MS));
  }

  saveVersionSettings(body: AppVersionSettings): Observable<AppVersionSettings> {
    this.versions[`${body.app}-${body.platform}`] = { ...body };
    return of({ ...body }).pipe(delay(FAKE_LATENCY_MS));
  }

  private defaultVersion(app: ControlCenterApp, platform: ControlCenterPlatform): AppVersionSettings {
    return {
      app,
      platform,
      latestVersion: '4.8.0',
      minSupportedVersion: '4.5.0',
      policy: 'forced',
      storeUrl: platform === 'ios'
        ? `https://apps.apple.com/app/lfeen${app === 'merchant' ? '-business' : ''}`
        : `https://play.google.com/store/apps/details?id=com.lfeen.${app === 'merchant' ? 'business' : 'app'}`,
      message: 'يتوفر إصدار جديد من تطبيق لفين، يرجى التحديث للاستمرار والاستفادة من أحدث المميزات.',
    };
  }

  private appStatuses(): AppPlatformStatus[] {
    const statuses: AppPlatformStatus[] = [];
    for (const app of ['client', 'merchant'] as const) {
      const s = this.settings[app];
      for (const platform of ['ios', 'android'] as const) {
        const affected = s.enabled && (s.target === 'all' || s.target === platform);
        statuses.push({ app, platform, status: affected ? 'maintenance' : 'running' });
      }
    }
    return statuses;
  }

  private defaultSettings(app: ControlCenterApp): MaintenanceSettings {
    return {
      app,
      target: 'all',
      enabled: false,
      scheduled: false,
      startsAt: null,
      endsAt: null,
      title: 'نقوم بتحسين تجربتك',
      message: 'تطبيق لفين يخضع حاليًا لبعض التحسينات. سنعود إليك قريبًا، شكرًا لتفهمك.',
      hasBypassKey: false,
    };
  }
}
