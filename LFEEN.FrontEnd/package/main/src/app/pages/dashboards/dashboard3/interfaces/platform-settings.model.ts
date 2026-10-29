import { LoginService } from '../services/login/login.service';

export type NotificationChannel = 'Browser' | 'Email' | 'Sms';
export type NotificationScope = 'Platform' | 'PlatformAndUser';

/** Row of GET/PUT /api/profile/notification-preferences — only keys an admin controls personally. */
export interface UserNotificationPreference {
  key: string;
  channel: NotificationChannel;
  title: string;
  description: string;
  isEnabled: boolean;
  isPlatformEnabled: boolean;
  isEffective: boolean;
  isDeliveryActive: boolean;
}

/** Row of GET/PUT /api/settings/notifications — every catalog key with its platform switch. */
export interface PlatformNotificationSetting {
  key: string;
  // Plain string too — the backend may add channels/scopes before the frontend knows them.
  channel: NotificationChannel | string;
  scope: NotificationScope | string;
  title: string;
  description: string;
  isEnabled: boolean;
  isDeliveryActive: boolean;
  updatedAt: string | null;
}

/** Send only the keys that changed; omitted keys keep their value. */
export interface NotificationPreferenceUpdate {
  items: { key: string; isEnabled: boolean }[];
}

export interface PlatformGeneralSettings {
  platformName: string;
  platformUrl: string;
  supportEmail: string;
  /** IANA id, e.g. Asia/Riyadh. */
  timeZone: string;
  /** null = never saved, these are the built-in defaults. */
  updatedAt: string | null;
}

export type UpdatePlatformGeneralSettings = Omit<PlatformGeneralSettings, 'updatedAt'>;

export const NotificationKeys = {
  BrowserRealtime: 'browser.realtime',
  EmailDailyDigest: 'email.daily_digest',
  EmailNewServiceRequests: 'email.new_service_requests',
  SmsUrgentBooking: 'sms.urgent_booking',
  EmailMonthlyReport: 'email.monthly_report',
} as const;

/** Settings.* permissions, lower-cased like the rest of the login permission checks. */
export const SETTINGS_PERMISSIONS = {
  view: 'settings.view',
  manage: 'settings.manage',
} as const;

export function hasSettingsPermission(login: LoginService, permission: string): boolean {
  const perms = login.permissions().map(p => p.toLowerCase());
  // Settings.Manage implies Settings.View (seeded dependency on the backend).
  if (permission === SETTINGS_PERMISSIONS.view && perms.includes(SETTINGS_PERMISSIONS.manage)) return true;
  return perms.includes(permission);
}

/** Static IANA list for the time zone picker; only the id is ever sent. */
export const TIME_ZONE_OPTIONS: { id: string; offset: string; labelAr: string; labelEn: string }[] = [
  { id: 'Asia/Riyadh', offset: '+03:00', labelAr: 'الرياض، المملكة العربية السعودية', labelEn: 'Riyadh, Saudi Arabia' },
  { id: 'Asia/Kuwait', offset: '+03:00', labelAr: 'الكويت', labelEn: 'Kuwait' },
  { id: 'Asia/Qatar', offset: '+03:00', labelAr: 'الدوحة، قطر', labelEn: 'Doha, Qatar' },
  { id: 'Asia/Bahrain', offset: '+03:00', labelAr: 'المنامة، البحرين', labelEn: 'Manama, Bahrain' },
  { id: 'Asia/Baghdad', offset: '+03:00', labelAr: 'بغداد، العراق', labelEn: 'Baghdad, Iraq' },
  { id: 'Asia/Amman', offset: '+03:00', labelAr: 'عمّان، الأردن', labelEn: 'Amman, Jordan' },
  { id: 'Asia/Dubai', offset: '+04:00', labelAr: 'دبي، الإمارات العربية المتحدة', labelEn: 'Dubai, United Arab Emirates' },
  { id: 'Asia/Muscat', offset: '+04:00', labelAr: 'مسقط، عُمان', labelEn: 'Muscat, Oman' },
  { id: 'Africa/Cairo', offset: '+02:00', labelAr: 'القاهرة، مصر', labelEn: 'Cairo, Egypt' },
  { id: 'Europe/London', offset: '+00:00', labelAr: 'لندن، المملكة المتحدة', labelEn: 'London, United Kingdom' },
  { id: 'UTC', offset: '+00:00', labelAr: 'التوقيت العالمي المنسق', labelEn: 'Coordinated Universal Time' },
];
