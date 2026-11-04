// Demo (trial) host accounts — /api/admin/demo-accounts. Plain JSON responses
// (no success/data envelope). View needs DemoAccounts.View, every action DemoAccounts.Manage.

export type DemoAccountStatus = 'Ready' | 'Sent' | 'SendFailed' | 'Expired' | 'Disabled';
export type DemoChannel = 'Email' | 'WhatsApp' | 'Sms';

export const DEMO_STATUSES: DemoAccountStatus[] = ['Ready', 'Sent', 'SendFailed', 'Expired', 'Disabled'];
export const DEMO_CHANNELS: DemoChannel[] = ['Email', 'WhatsApp', 'Sms'];

export const DEMO_PERMISSIONS = {
  view: 'demoaccounts.view',
  manage: 'demoaccounts.manage',
} as const;

// Translation keys live under d3.demoAccounts.status.* / d3.demoAccounts.channels.*.
export const DEMO_CHANNEL_ICONS: Record<DemoChannel, string> = {
  Email: 'mail',
  WhatsApp: 'brand-whatsapp',
  Sms: 'message',
};

export interface DemoDelivery {
  channel: DemoChannel;
  /** Already masked by the server — shown as is. */
  recipient: string | null;
  succeeded: boolean;
  error: string | null;
  attemptedAt: string;
  adminName: string | null;
}

export interface DemoAccount {
  id: string;
  fullName: string;
  email: string | null;
  contactPhone: string | null;
  channel: DemoChannel;
  loginPhone: string;
  loginSid: string;
  status: DemoAccountStatus;
  expiresAt: string;
  daysLeft: number;
  mustChangePin: boolean;
  note: string | null;
  userId: string;
  accountId: string;
  createdAt: string;
  createdByAdminName: string | null;
  lastSentAt: string | null;
  pinChangedAt: string | null;
  /** Newest first, max 20. Empty in list items and in credentials responses. */
  deliveries: DemoDelivery[];
}

/** Returned by create and new PIN only — the only time the PIN reaches the browser. */
export interface DemoAccountCredentials {
  account: DemoAccount;
  pin: string;
  invitationSent: boolean;
  reopened: boolean;
}

export interface DemoAccountsPage {
  items: DemoAccount[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface DemoAccountsQuery {
  status?: DemoAccountStatus | null;
  search?: string | null;
  pageNumber: number;
  pageSize: number;
}

export interface CreateDemoAccountRequest {
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  channel: DemoChannel;
  durationDays: number;
  pin: string | null;
  note: string | null;
}

export interface ResetDemoPinRequest {
  pin: string | null;
  sendInvitation: boolean;
}

// ── Client-side rules (§7) — the server checks them again ───────────────

export const DEMO_LIMITS = {
  fullName: 200,
  email: 256,
  note: 500,
  search: 100,
  minDays: 1,
  maxDays: 60,
  defaultDays: 14,
} as const;

export const SAUDI_MOBILE_PATTERN = /^(05[013-9]\d{7}|\+9665[013-9]\d{7})$/;
export const DEMO_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Spaces and dashes are allowed while typing; they are stripped before validating/sending. */
export function normalizePhoneInput(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s-]/g, '');
}

/** Exactly 6 digits, not all the same (111111) and not a straight run (123456 / 654321). */
export function isStrongDemoPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false;
  const digits = pin.split('').map(Number);
  if (digits.every(d => d === digits[0])) return false;
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  return !ascending && !descending;
}

/** The API always returns +9665XXXXXXXX; the UI shows (and copies) 05XXXXXXXX. */
export function toLocalPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.startsWith('+966') ? `0${phone.slice(4)}` : phone;
}
