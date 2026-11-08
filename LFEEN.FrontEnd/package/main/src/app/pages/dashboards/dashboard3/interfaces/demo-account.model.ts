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

/** An email invitation file (§5). */
export interface DemoAttachment {
  id: string;
  fileName: string;
  contentType: string;
  // TODO(backend): confirm the size field name — read through attachmentSize().
  sizeBytes?: number;
  size?: number;
}

export function attachmentSize(a: DemoAttachment): number {
  return a.sizeBytes ?? a.size ?? 0;
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
  note: string | null;
  userId: string;
  accountId: string;
  createdAt: string;
  createdByAdminName: string | null;
  lastSentAt: string | null;
  /** Email invitation subject (may hold variables); null = the default subject. Empty in list items. */
  invitationSubject: string | null;
  /** Invitation text for every channel (may hold variables); null = the standard invitation. */
  invitationMessage: string | null;
  /** Language of the invitation text; null = Ar. */
  invitationLanguage: InvitationLanguage | null;
  /** The subject exactly as the host received it; null for WhatsApp/SMS. */
  renderedSubject: string | null;
  /** Status of the latest activation request, or null when the host never asked. */
  activationRequestStatus: ActivationRequestStatus | null;
  /** The latest activation request in full — details (GET /{id}) only. */
  activationRequest?: ActivationRequest | null;
  /** Email invitation files. Empty in list items; filled in details and action responses. */
  attachments: DemoAttachment[];
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
  /** Email only; left out = the server's default subject. */
  invitationSubject?: string;
  /** Every channel; left out = the standard invitation. Sent exactly as typed. */
  invitationMessage?: string;
  invitationLanguage?: InvitationLanguage;
  /** Email only; ids from the attachments upload. */
  attachmentIds?: string[];
}

/**
 * Resend sends only what changed: a field left out keeps the saved value.
 * invitationSubject / invitationMessage "" = back to the default;
 * attachmentIds is the full list ([] removes all).
 */
export interface ResendDemoRequest {
  channel?: DemoChannel;
  invitationSubject?: string;
  invitationMessage?: string;
  invitationLanguage?: InvitationLanguage;
  attachmentIds?: string[];
}

// ── Activation requests: demo hosts asking for a real account ──────────────

export type ActivationRequestStatus = 'New' | 'Contacted' | 'Converted' | 'Closed';
export type ActivationInterest = 'Hot' | 'Warm' | 'Cold';

export const ACTIVATION_STATUSES: ActivationRequestStatus[] = ['New', 'Contacted', 'Converted', 'Closed'];

export interface ActivationRequest {
  id: string;
  demoAccountId: string;
  accountId: string;
  status: ActivationRequestStatus;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredContactTime: string | null;
  /** The host's own note. */
  note: string | null;
  /** > 1 = the host pressed again on the same open request (high interest). */
  timesRequested: number;
  interest: ActivationInterest;
  trial: {
    daysUsed: number;
    propertiesCount: number;
    unitsCount: number;
    bookingsCount: number;
    paymentsCount: number;
    customersCount: number;
    servicesCount: number;
  };
  adminNote: string | null;
  handledByAdminName: string | null;
  createdAt: string;
  updatedAt: string | null;
  handledAt: string | null;
  demoAccountStatus: DemoAccountStatus;
  demoExpiresAt: string;
}

export interface ActivationRequestsQuery {
  status?: ActivationRequestStatus | null;
  pageNumber: number;
  /** 1–100. */
  pageSize: number;
}

export interface ActivationRequestsPage {
  items: ActivationRequest[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** An empty note keeps the saved one. The admin is taken from the session. */
export interface UpdateActivationRequestStatus {
  status: ActivationRequestStatus;
  adminNote?: string;
}

export const ACTIVATION_NOTE_MAX = 1000;

// ── Invitation editor (GET /invitation-templates, POST /invitation-preview) ──

export type InvitationLanguage = 'Ar' | 'En';
export type InvitationField = 'Subject' | 'Message';

export interface InvitationVariable {
  /** Fixed forever; {{1}} and {{name}} mean the same variable. */
  number: number;
  key: string;
  /** What a chip inserts, e.g. "{{1}}". */
  token: string;
  labelAr: string;
  labelEn: string;
  exampleAr: string;
  exampleEn: string;
  /** false for the PIN — it never goes in a subject. */
  allowedInSubject: boolean;
  /** Sign-in data; added at the end of the message when missing. */
  isCredential: boolean;
}

export interface InvitationPreset {
  id: string;
  tone: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  ar: { subject: string; message: string };
  en: { subject: string; message: string };
}

export interface InvitationTemplates {
  variables: InvitationVariable[];
  presets: InvitationPreset[];
  languages: InvitationLanguage[];
  limits: {
    subjectMaxLength: number;
    renderedSubjectMaxLength: number;
    messageMaxLength: number;
    maxAttachments: number;
    maxAttachmentsTotalMb: number;
    allowedAttachmentExtensions: string[];
  };
  defaultSubjectAr: string;
  defaultSubjectEn: string;
}

export interface InvitationPreviewRequest {
  invitationSubject?: string;
  invitationMessage?: string;
  invitationLanguage?: InvitationLanguage;
  /** Fill with this account's real values (details/resend); without it, example values. */
  demoAccountId?: string;
}

export interface InvitationIssue {
  code: string;
  field: InvitationField;
  /** Range in that field's text. */
  start: number;
  end: number;
  text: string;
  message: string;
  /** One-click fix, when there is one. */
  suggestion?: string | null;
}

export interface InvitationWarning {
  code: string;
  message: string;
  keys?: string[];
}

export interface InvitationPreview {
  isValid: boolean;
  language: InvitationLanguage;
  usesAccountValues: boolean;
  issues: InvitationIssue[];
  warnings: InvitationWarning[];
  usedVariables: number[];
  addedCredentials: string[];
  email: { subject: string; subjectLength: number; body: string; html: string } | null;
  whatsApp: { body: string; characters: number } | null;
  sms: { body: string; characters: number; segments: number; encoding: string } | null;
}

export interface InvitationTestSendRequest extends InvitationPreviewRequest {
  attachmentIds?: string[];
}

export interface InvitationTestSendResult {
  sent: boolean;
  /** Masked admin email. */
  recipient: string;
  subject: string;
  attachments: number;
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
  invitationSubject: 200,
  search: 100,
  minDays: 1,
  maxDays: 60,
  defaultDays: 14,
} as const;

/** Email invitation attachments (§5.2) — the server also checks the real file type. */
export const DEMO_ATTACHMENT_LIMITS = {
  extensions: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'],
  accept: '.pdf,.doc,.docx,.png,.jpg,.jpeg',
  maxCount: 5,
  maxTotalBytes: 10 * 1024 * 1024,
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
