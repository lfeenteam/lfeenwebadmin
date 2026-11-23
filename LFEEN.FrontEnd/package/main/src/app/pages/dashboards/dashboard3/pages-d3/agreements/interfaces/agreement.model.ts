import { LoginService } from '../../../services/login/login.service';

export type AgreementType = 'Host' | 'ServiceLevel';
export type AgreementStatus = 'Draft' | 'Published' | 'Ended';

export const AGREEMENT_TYPES: AgreementType[] = ['Host', 'ServiceLevel'];

/** A clause as the API returns it. Its `id` changes on every draft save: never key on it. */
export interface AgreementClause {
  id: number;
  order: number;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
}

/** A clause as the API takes it: no id/order, the array position is the order. */
export interface AgreementClauseInput {
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
}

export interface AgreementVersion {
  id: number;
  externalId?: string | null;
  type: AgreementType;
  status: AgreementStatus;
  statusName?: string | null;
  /** 0 for a draft. */
  version: number;
  isCurrent: boolean;
  keepsSignaturesValid: boolean;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAtUtc?: string | null;
  publishedBy?: string | null;
  expiresAtUtc?: string | null;
  endedAtUtc?: string | null;
  endedBy?: string | null;
  clauseCount: number;
  signedCount: number;
  /** null in the list, filled everywhere else. */
  clauses?: AgreementClause[] | null;
}

export interface CreateDraftRequest {
  type: AgreementType;
  copyFromAgreementId?: number;
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  clauses?: AgreementClauseInput[];
}

export interface SaveDraftRequest {
  titleAr: string;
  titleEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  clauses: AgreementClauseInput[];
}

export interface PublishRequest {
  expiresAtUtc?: string | null;
  endPreviousVersions?: boolean;
}

/** Editor row: the API fields plus a local key that survives saves (the server id doesn't). */
export interface ClauseFormRow extends AgreementClauseInput {
  key: string;
  open: boolean;
}

export const AGREEMENT_PERMISSIONS = {
  view: 'agreements.view',
  edit: 'agreements.edit',
  publish: 'agreements.publish',
} as const;

export function hasAgreementPermission(login: LoginService, permission: string): boolean {
  return login.permissions().some((p) => p.toLowerCase() === permission);
}

/** "Expired" = still Published but its expiry date passed, so signatures no longer count. */
export function isExpiredPublished(v: AgreementVersion): boolean {
  return v.status === 'Published' && !v.keepsSignaturesValid;
}

/** Drafts first (latest edit first), then Published newest → oldest, then Ended. */
export function sortAgreementVersions(list: AgreementVersion[]): AgreementVersion[] {
  const rank: Record<AgreementStatus, number> = { Draft: 0, Published: 1, Ended: 2 };
  const time = (v: AgreementVersion) =>
    new Date(v.updatedAt || v.createdAt || 0).getTime() || 0;
  return [...list].sort((a, b) => {
    const r = (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
    if (r) return r;
    if (a.status === 'Draft') return time(b) - time(a) || b.id - a.id;
    return b.version - a.version || b.id - a.id;
  });
}

export function newClauseKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
