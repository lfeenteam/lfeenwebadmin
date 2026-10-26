// ── Additional conditions (host-written terms reviewed one by one) ──────────
// Mirrors the admin payloads of the "الشروط الإضافية" API doc, section 8.1.
// Each condition is decided on its own — independent of the Terms section
// decision of a property/unit, so it never affects section progress.

export type AdditionalConditionScope = 'account' | 'property' | 'unit';

export type AdditionalConditionStatus = 'Pending' | 'PendingUpdate' | 'Approved' | 'Rejected';

export interface AdminAdditionalCondition {
  id: number;
  scope: string;
  scopeKey: AdditionalConditionScope;
  scopeLabel: string | null;
  accountId: string | null;
  accountName: string | null;
  propertyId: number | string | null;
  propertyName: string | null;
  unitId: number | string | null;
  unitName: string | null;
  // Latest text written by the host (`title` is in the request language).
  title: string | null;
  description: string | null;
  titleAr: string | null;
  titleEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  // Text guests currently see; null before the first approval.
  approvedTitle: string | null;
  approvedDescription: string | null;
  approvedTitleAr: string | null;
  approvedTitleEn: string | null;
  approvedDescriptionAr: string | null;
  approvedDescriptionEn: string | null;
  isActive: boolean;
  isVisibleToGuests: boolean;
  displayOrder: number;
  decision: AdditionalConditionStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  // Sent back as-is on review so an edit made after loading is caught (CONDITION_CHANGED).
  updatedAt: string;
}

export interface AdditionalConditionDecisionItem {
  id: number;
  decision: Exclude<AdditionalConditionStatus, 'Pending' | 'PendingUpdate'>;
  rejectionReason?: string | null;
  updatedAt?: string;
}

export interface AdditionalConditionReviewPayload {
  conditions: AdditionalConditionDecisionItem[];
}

export interface AdditionalConditionListQuery {
  status?: 'Pending' | 'Approved' | 'Rejected';
  search?: string;
  accountId?: string;
  propertyId?: string | number;
  unitId?: string | number;
  pageNumber?: number;
  pageSize?: number;
}

export interface AdditionalConditionStats {
  awaitingReview?: number;
  approved?: number;
  rejected?: number;
}

export interface AdditionalConditionListResult {
  items: AdminAdditionalCondition[];
  stats: AdditionalConditionStats | null;
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
}

export const ADDITIONAL_CONDITION_REASON_MAX = 1000;
