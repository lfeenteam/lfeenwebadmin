import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  NotificationPreferenceUpdate,
  PlatformGeneralSettings,
  PlatformNotificationSetting,
  UpdatePlatformGeneralSettings,
  UserNotificationPreference,
} from '../interfaces/platform-settings.model';

@Injectable({
  providedIn: 'root'
})
export class PlatformSettingsService {
  private http = inject(HttpClient);
  private profileUrl = `${environment.apiBaseUrl}/api/profile/notification-preferences`;
  private settingsUrl = `${environment.apiBaseUrl}/api/settings`;

  getMyNotificationPreferences(): Observable<UserNotificationPreference[]> {
    return this.http.get<UserNotificationPreference[]>(this.profileUrl);
  }

  updateMyNotificationPreferences(body: NotificationPreferenceUpdate): Observable<UserNotificationPreference[]> {
    return this.http.put<UserNotificationPreference[]>(this.profileUrl, body);
  }

  getGeneral(): Observable<PlatformGeneralSettings> {
    return this.http.get<PlatformGeneralSettings>(`${this.settingsUrl}/general`);
  }

  updateGeneral(body: UpdatePlatformGeneralSettings): Observable<PlatformGeneralSettings> {
    return this.http.put<PlatformGeneralSettings>(`${this.settingsUrl}/general`, body);
  }

  getPlatformNotifications(): Observable<PlatformNotificationSetting[]> {
    return this.http.get<PlatformNotificationSetting[]>(`${this.settingsUrl}/notifications`);
  }

  updatePlatformNotifications(body: NotificationPreferenceUpdate): Observable<PlatformNotificationSetting[]> {
    return this.http.put<PlatformNotificationSetting[]>(`${this.settingsUrl}/notifications`, body);
  }
}
