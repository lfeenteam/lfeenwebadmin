export type BuildingTab = 'published' | 'new' | 'underReview' | 'rejected' | 'pendingChanges';
export type BuildingViewMode = 'grid' | 'list';
export type BuildingStatus = 'active' | 'stopped';
export type PropertyAdminReviewStatus = 'Pending' | 'UnderReview' | 'Approved' | 'Rejected' | 'HasPendingChanges';
export type AdminReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export enum PropertyAdminReviewStatusValue {
  Pending = 0,
  UnderReview = 1,
  Approved = 2,
  Rejected = 3,
  HasPendingChanges = 4
}

export interface BuildingCardItem {
  id: string;
  title: string;
  host: string;
  location: string;
  status: BuildingStatus;
  typeLabel: string;
  units: number;
  occupancy: number;
  bookings: number;
  lastUpdate: string;
  tab: BuildingTab;
  mainPhotoUrl: string | null;
}

export interface PropertyApiItem {
  propertyId: number;
  externalId: string;
  name: string;
  accountId: string;
  accountName: string | null;
  businessType: string;
  propertyTypeName: string;
  unitCount: number;
  reviewStatus: PropertyAdminReviewStatus | PropertyAdminReviewStatusValue;
  photosSectionDecision: AdminReviewStatus;
  termsSectionDecision: AdminReviewStatus;
  licenseSectionDecision: AdminReviewStatus;
  completedSections: number;
  createdAt: string;
  updatedAt: string;
  mainPhotoUrl: string | null;
  city: string | null;
  district: string | null;
  occupancyCount: number;
  activeBookingsCount: number;
  isActive: boolean;
}

export interface PropertyApiStats {
  total: number;
  activeOrPublished: number;
  pendingOrRejected: number;
  underReview: number;
}

export interface PaginatedPropertyResponse {
  data: PropertyApiItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
  stats: PropertyApiStats;
}

export interface PropertyStatistics {
  totalProperties: number;
  activeProperties: number;
  inactiveProperties: number;
  underReviewProperties: number;
}

export interface PhotoItem {
  mediaId: number;
  url: string;
  fileName: string;
  isMainPhoto: boolean;
  isPendingDeletion: boolean;
  pendingIsMain: boolean | null;
  classification: string;
  decision: AdminReviewStatus;
  rejectionReason: string | null;
}

export interface PhotoGroup {
  groupKey: string;
  totalCount: number;
  photos: PhotoItem[];
}

export interface PropertyPhotosResponse {
  propertyId: number;
  decision: AdminReviewStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  approvedCount: number;
  minRequired: number;
  groups: PhotoGroup[];
}

export interface PhotoReviewPayload {
  photos: {
    mediaId: number;
    decision: Exclude<AdminReviewStatus, 'Pending'>;
    rejectionReason: string | null;
  }[];
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  rejectionReason: string | null;
}

export interface PhotoReviewResponse {
  propertyId: number;
  section: 'Photos';
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  overallStatus: PropertyAdminReviewStatus;
}

export interface PropertyTermCondition {
  id: number;
  name: string;
  conditionKey: string;
  isSelected: boolean;
  defaultValue: boolean | string | number | null;
  type: string;
}

export interface PropertyCustomRule {
  description: string;
}

export interface PropertyTermsResponse {
  decision: AdminReviewStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  isEarlyCheckInAllowed: boolean;
  earlyCheckInFrom: string | null;
  conditions: PropertyTermCondition[];
  customRules: PropertyCustomRule[];
}

export interface TermsReviewPayload {
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  rejectionReason: string | null;
}

export interface TermsReviewResponse {
  propertyId: number;
  section: 'Terms';
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  overallStatus: PropertyAdminReviewStatus;
}

export interface PropertyLicenseResponse {
  propertyId: number;
  decision: AdminReviewStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  licenseId: number | null;
  licenseNumber: string | null;
  licenseType: string | null;
  licenseAttachmentUrl: string | null;
  facilityName: string | null;
  classification: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenseStatusName: string | null;
  documentStatus: string | null;
}

export interface LicenseReviewPayload {
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  rejectionReason: string | null;
}

export interface LicenseReviewResponse {
  propertyId: number;
  section: 'License';
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  overallStatus: PropertyAdminReviewStatus;
}

export type SectionReviewResponse =
  | PhotoReviewResponse
  | TermsReviewResponse
  | LicenseReviewResponse;

export interface PropertyFinalDecisionPayload {
  finalNotes: string | null;
}

export interface PropertyFinalDecisionResult {
  propertyId: number;
  status: number;
}

export interface SectionReview {
  decision: AdminReviewStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export interface PropertyDetailResponse {
  propertyId: number;
  externalId: string;
  name: string;
  accountId: string;
  accountName: string | null;
  accountLogoUrl: string | null;
  businessType: string;
  propertyTypeName: string;
  mainPhotoUrl: string | null;
  totalUnits: number;
  region: string | null;
  city: string | null;
  district: string | null;
  streetName: string | null;
  buildingNumber: string | null;
  postalCode: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  overallStatus: PropertyAdminReviewStatus;
  finalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  photosSection: SectionReview;
  termsSection: SectionReview;
  licenseSection: SectionReview;
  photosApprovedCount: number;
  photosMinRequired: number;
  completedSections: number;
  progressPercentage: number;
  canFinalApprove: boolean;
}
