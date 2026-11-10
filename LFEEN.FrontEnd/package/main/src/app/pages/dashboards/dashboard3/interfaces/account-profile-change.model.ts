// Admin review of account settings changes (Admin Account Profile Changes guide, section 10).

export type ProfileSection = 'Branding' | 'CommercialRegister';
export type ProfileSectionRoute = 'branding' | 'commercial-register';
export type SectionStatus = 'None' | 'PendingReview' | 'Approved' | 'Rejected';
export type ProfileDecision = 'Approved' | 'Rejected';
export type CertificateVersion = 'current' | 'requested';

export const PROFILE_REJECTION_REASON_MAX = 1000;

export const toProfileSectionRoute = (section: ProfileSection): ProfileSectionRoute =>
  section === 'Branding' ? 'branding' : 'commercial-register';

export interface AccountProfileChangeListItem {
  changeId: string;
  accountId: string;
  referenceCode: string | null;
  accountName: string | null;
  businessType: string;
  section: ProfileSection;
  submittedAt: string;
}

export interface AccountProfileChangesPage {
  items: AccountProfileChangeListItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface AccountProfileChangesQuery {
  section?: ProfileSectionRoute;
  pageNumber?: number;
  pageSize?: number;
}

export interface ProfileSectionView<T> {
  status: SectionStatus;
  current: T;
  requested: T | null;
  changeId: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface BrandingValues {
  tradeNameAr: string | null;
  tradeNameEn: string | null;
  logoUrl: string | null;
}

export interface CommercialRegisterValues {
  hasCertificate: boolean;
  expiryDate: string | null;
}

export interface AccountProfile {
  accountId: string;
  businessType: string;
  canEdit: boolean;
  locked: { legalName: string | null; companyNumber: string | null; vatNumber: string | null };
  branding: ProfileSectionView<BrandingValues>;
  // null for sole proprietorships
  commercialRegister: ProfileSectionView<CommercialRegisterValues> | null;
  contact: { email: string | null; countryCode: string | null; phoneNumber: string | null };
  address: Record<string, string | null>;
}

export interface ReviewAccountProfileChangeRequest {
  changeId: string;
  decision: ProfileDecision;
  rejectionReason?: string;
}

export interface AccountProfileReviewResult {
  accountId: string;
  section: ProfileSection;
  decision: ProfileDecision;
}
