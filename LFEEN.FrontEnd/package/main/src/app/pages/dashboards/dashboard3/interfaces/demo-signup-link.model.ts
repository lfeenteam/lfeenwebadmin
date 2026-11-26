import type { DemoAccountKind, DemoAccountStatus, InvitationLanguage } from './demo-account.model';

// Demo links (MUL-0004, "open the link and get the account"): the admin makes links; the first
// time a link is opened its demo account ("حساب تجريبي") is created and the sign-in data shows on
// the page. Nothing is sent by SMS or email. The area and notes are for the admin only.
// Admin API: /api/admin/demo-signup-links.

export type DemoSignupLinkState = 'Open' | 'InProgress' | 'Used' | 'Cancelled' | 'Expired';

export const DEMO_SIGNUP_STATES: DemoSignupLinkState[] = ['Open', 'Used', 'InProgress', 'Cancelled', 'Expired'];

export const DEMO_SIGNUP_LIMITS = {
  minCount: 1,
  maxCount: 50,
  defaultCount: 1,
  minLinkDays: 1,
  maxLinkDays: 90,
  defaultLinkDays: 7,
  /** Who the links are for — admin only, never shown to the organisation. */
  area: 200,
  additionalNotes: 1000,
} as const;

/** `<` and `>` are refused in the area and the notes (the server answers 400 VALIDATION_ERROR). */
export const DEMO_SIGNUP_TEXT_FORBIDDEN = /[<>]/;

/** Every field is optional on the server; the form always sends the main ones. */
export interface CreateDemoSignupLinksRequest {
  count: number;
  kind: DemoAccountKind;
  durationDays: number;
  linkValidDays?: number;
  /** Who the batch is for; every link of the batch inherits it. */
  area?: string;
  additionalNotes?: string;
  invitationMessage?: string;
  invitationLanguage?: InvitationLanguage;
}

/**
 * PATCH a link or a batch. A field left out stays as it is; "" clears it — a link then falls
 * back to its batch's value.
 */
export interface UpdateDemoSignupMetaRequest {
  area?: string;
  additionalNotes?: string;
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
  durationDays: number;
  /** The link's own value, else its batch's (areaFromBatch = true). */
  area: string | null;
  areaFromBatch: boolean;
  additionalNotes: string | null;
  additionalNotesFromBatch: boolean;
  /** The window for the FIRST open only (matters while the link is still unopened). */
  expiresAt: string | null;
  createdAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  demoAccountId: string | null;
  /** Always "حساب تجريبي". */
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
  area: string | null;
  additionalNotes: string | null;
  invitationMessage: string | null;
  invitationLanguage: InvitationLanguage | null;
  linksExpireAt: string | null;
  createdByAdminName: string | null;
  createdAt: string | null;
  totalLinks: number;
  openLinks: number;
  usedLinks: number;
  cancelledLinks: number;
  expiredLinks: number;
  /** Only on create, GET batches/{id} and PATCH batches/{id}; the batches list has none. */
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

/** On a demo account made from a link (GET demo-accounts/{id}); null when the admin made it directly. */
export interface DemoAccountSignupLink {
  linkId: string;
  batchId: string;
  code: string;
  area: string | null;
  additionalNotes: string | null;
  firstOpenedAt: string | null;
  openCount: number;
  /** Only when taken from a links-table row (the account response doesn't carry them). */
  areaFromBatch?: boolean;
  additionalNotesFromBatch?: boolean;
}
