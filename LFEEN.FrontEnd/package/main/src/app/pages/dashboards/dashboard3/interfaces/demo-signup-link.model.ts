import type { DemoAccountKind, DemoAccountStatus, InvitationLanguage } from './demo-account.model';

// Demo sign-up links (MUL-0004): the admin makes a batch of one-use links, each person
// opens one on the client web and gets a demo account. Admin API: /api/admin/demo-signup-links.

export type DemoSignupLinkState = 'Open' | 'InProgress' | 'Used' | 'Cancelled' | 'Expired';
/** How the person chose to get their sign-in data. */
export type DemoSignupChannel = 'Sms' | 'Email';

export const DEMO_SIGNUP_STATES: DemoSignupLinkState[] = ['Open', 'InProgress', 'Used', 'Cancelled', 'Expired'];
export const DEMO_SIGNUP_CHANNELS: DemoSignupChannel[] = ['Sms', 'Email'];

export const DEMO_SIGNUP_LIMITS = {
  minCount: 1,
  maxCount: 50,
  defaultCount: 1,
  minLinkDays: 1,
  maxLinkDays: 90,
  defaultLinkDays: 7,
} as const;

// ── Channels (GET channels / POST channels/test) ──────────────────────

export type DemoChannelReason = 'SMS_DISABLED' | 'SMS_NOT_CONFIGURED' | 'SENDING_SIMULATED' | 'EMAIL_NOT_CONFIGURED' | string;

export interface DemoChannelState {
  ready: boolean;
  reason?: DemoChannelReason | null;
  messageAr?: string | null;
  messageEn?: string | null;
}

export interface DemoSignupChannels {
  sms: DemoChannelState;
  email: DemoChannelState;
  anyReady: boolean;
}

export interface DemoChannelTestRequest {
  channel: DemoSignupChannel;
  recipient: string;
}

export interface DemoChannelTestResult {
  sent: boolean;
  channel?: DemoSignupChannel;
  recipient?: string;
  errorCode?: string | null;
  error?: string | null;
}

// ── Links and batches ─────────────────────────────────────────────────

/** Every field is optional on the server; the form always sends the four main ones. */
export interface CreateDemoSignupLinksRequest {
  count: number;
  kind: DemoAccountKind;
  durationDays: number;
  linkValidDays?: number;
  invitationMessage?: string;
  invitationLanguage?: InvitationLanguage;
  invitationSubject?: string;
  attachmentIds?: string[];
  note?: string;
}

export interface DemoSignupLink {
  id: string;
  batchId: string;
  code: string;
  /** null when Demo:SelfSignup:PageUrl is not set on the server — build it from the code. */
  url: string | null;
  state: DemoSignupLinkState;
  stateLabelAr?: string | null;
  stateLabelEn?: string | null;
  canCancel: boolean;
  kind: DemoAccountKind;
  durationDays: number;
  expiresAt: string | null;
  createdAt: string | null;
  fullName: string | null;
  channel: DemoSignupChannel | null;
  contact: string | null;
  usedAt: string | null;
  demoAccountId: string | null;
  demoAccountStatus: DemoAccountStatus | null;
  loginPhone: string | null;
  demoAccountExpiresAt: string | null;
  /** null = nothing sent yet (the link is not used). */
  invitationSent: boolean | null;
  deliveryErrorCode: string | null;
  deliveryError: string | null;
  cancelledAt: string | null;
  cancelledByAdminName: string | null;
}

export interface DemoSignupBatch {
  id: string;
  kind: DemoAccountKind;
  durationDays: number;
  invitationSubject: string | null;
  invitationMessage: string | null;
  invitationLanguage: InvitationLanguage | null;
  note: string | null;
  linksExpireAt: string | null;
  createdByAdminName: string | null;
  createdAt: string | null;
  totalLinks: number;
  openLinks: number;
  usedLinks: number;
  cancelledLinks: number;
  expiredLinks: number;
  attachments?: { id: string; fileName: string; sizeBytes: number }[];
  /** Only on create and GET batches/{id}; the batches list has none. */
  links?: DemoSignupLink[];
}

export interface DemoSignupPage<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export interface DemoSignupLinksQuery {
  batchId?: string | null;
  state?: DemoSignupLinkState | null;
  search?: string | null;
  pageNumber: number;
  pageSize: number;
}

export interface DemoSignupCancelResult {
  cancelled: number;
  skipped: number;
  cancelledIds: string[];
}
