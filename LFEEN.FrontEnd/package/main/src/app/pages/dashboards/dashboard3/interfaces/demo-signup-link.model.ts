import type { DemoAccountKind, DemoAccountStatus, InvitationLanguage } from './demo-account.model';

// Demo links (MUL-0004, "open the link and get the account"): the admin makes one-use-per-account
// links; the first time a link is opened the demo account is created and its sign-in data is
// shown on the page. Nothing is sent by SMS or email. Admin API: /api/admin/demo-signup-links.

export type DemoSignupLinkState = 'Open' | 'InProgress' | 'Used' | 'Cancelled' | 'Expired';

export const DEMO_SIGNUP_STATES: DemoSignupLinkState[] = ['Open', 'Used', 'InProgress', 'Cancelled', 'Expired'];

export const DEMO_SIGNUP_LIMITS = {
  minCount: 1,
  maxCount: 50,
  defaultCount: 1,
  minLinkDays: 1,
  maxLinkDays: 90,
  defaultLinkDays: 7,
  /** The organisation name becomes the account name. */
  label: 150,
} as const;

/** `<` and `>` are refused in the organisation name (DEMO_SIGNUP_LABEL_INVALID). */
export const DEMO_SIGNUP_LABEL_FORBIDDEN = /[<>]/;

/** Every field is optional on the server; the form always sends the main ones. */
export interface CreateDemoSignupLinksRequest {
  count: number;
  kind: DemoAccountKind;
  durationDays: number;
  linkValidDays?: number;
  label?: string;
  invitationMessage?: string;
  invitationLanguage?: InvitationLanguage;
  note?: string;
}

export interface DemoSignupLink {
  id: string;
  batchId: string;
  code: string;
  /** null when Demo:SelfSignup:PageUrl is not set on the server. */
  url: string | null;
  state: DemoSignupLinkState;
  stateLabelAr?: string | null;
  stateLabelEn?: string | null;
  canCancel: boolean;
  kind: DemoAccountKind;
  label: string | null;
  durationDays: number;
  /** The window for the FIRST open only (matters while the link is still unopened). */
  expiresAt: string | null;
  createdAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  demoAccountId: string | null;
  /** e.g. "فندق الريم 2" — the label numbered when a batch has several links. */
  demoAccountName: string | null;
  demoAccountStatus: DemoAccountStatus | null;
  loginPhone: string | null;
  demoAccountExpiresAt: string | null;
  cancelledAt: string | null;
  cancelledByAdminName: string | null;
}

export interface DemoSignupBatch {
  id: string;
  kind: DemoAccountKind;
  durationDays: number;
  label: string | null;
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
  /** Opened links whose demo account was stopped with them. */
  accountsStopped: number;
  /** Already cancelled / expired, or still being set up (InProgress). */
  skipped: number;
  cancelledIds: string[];
}
