export type BuildingTab = 'draft' | 'published' | 'new' | 'underReview' | 'rejected' | 'pendingChanges';
export type BuildingViewMode = 'grid' | 'list';
export type BuildingStatus = 'active' | 'stopped';
export type PropertyAdminReviewStatus = 'Draft' | 'Pending' | 'UnderReview' | 'Approved' | 'Rejected' | 'HasPendingChanges' | 'PendingAfterRejection';
export type AdminReviewStatus = 'Pending' | 'Approved' | 'Rejected';
// A section can also come back as one of these when the host edits it after it
// was already decided (mirrors the property-level HasPendingChanges/PendingAfterRejection status).
export type SectionDecisionStatus = AdminReviewStatus | 'PendingUpdate' | 'HasPendingChanges' | 'PendingAfterRejection';
export type PendingChangesReason = 'hasPendingChanges' | 'pendingAfterRejection';

export enum PropertyAdminReviewStatusValue {
  Draft = 0,
  Pending = 1,
  UnderReview = 2,
  Approved = 3,
  Rejected = 4,
  HasPendingChanges = 5,
  PendingAfterRejection = 6
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
  pendingChangesReason?: PendingChangesReason;
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
  // null when the property's type/business setup doesn't require a license section at all
  // (e.g. private hospitality facilities), as opposed to Pending which means it's required but undecided.
  licenseSectionDecision: AdminReviewStatus | null;
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
  classificationLabel: string;
  decision: AdminReviewStatus;
  rejectionReason: string | null;
}

export interface PhotoGroup {
  groupKey: string;
  groupLabel: string;
  totalCount: number;
  photos: PhotoItem[];
}

export interface PropertyPhotosResponse {
  propertyId: number;
  decision: SectionDecisionStatus;
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
  decision: SectionDecisionStatus;
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
  decision: SectionDecisionStatus;
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

export interface LocalSectionDecisionResult {
  decision: 'Approved' | 'Rejected';
}

export interface PropertyBasicDataFloor {
  id: number;
  name: string;
  unitCount: number;
  floorIndex: number;
}

export interface PropertyBasicDataViewType {
  id: number;
  key: string;
  name: string;
}

export interface PropertyBasicDataService {
  serviceId: number;
  serviceTypeId: number;
  serviceTypeNameKey: string;
  displayName: string;
  isFree: boolean;
  cost: number | null;
  costType: string;
}

export interface PropertyBasicDataFacility {
  facilityId: number;
  facilityTypeName: string;
}

export interface PropertyBasicDataResponse {
  propertyId: number;
  decision: SectionDecisionStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  propertyTypeId: number;
  propertyTypeName: string;
  name: string;
  usage: string;
  hasLock: boolean;
  hasUnitServices: boolean;
  availableViewTypes: PropertyBasicDataViewType[];
  numberOfFloors: number;
  numberOfUnits: number;
  floors: PropertyBasicDataFloor[];
  services: PropertyBasicDataService[];
  facilities: PropertyBasicDataFacility[];
}

export interface BasicDataReviewPayload {
  decision: '1' | '2';
  rejectionReason: string | null;
}

export interface BasicDataReviewResponse {
  propertyId: number;
  section: 'BasicData';
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  overallStatus: PropertyAdminReviewStatus;
}

export interface PropertyLocationResponse {
  propertyId: number;
  decision: SectionDecisionStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  streetName: string | null;
  buildingNumber: string | null;
  customBuildingNumber: string | null;
  additionalNumber: string | null;
  postalCode: string | null;
  unitNumber: string | null;
  splCode: string | null;
  latitude: number;
  longitude: number;
  googleMapsUrl: string | null;
  formattedAddress: string | null;
  accessDescription: string | null;
  nearbyPlaces: string[];
}

export interface LocationReviewPayload {
  decision: '1' | '2';
  rejectionReason: string | null;
}

export interface LocationReviewResponse {
  propertyId: number;
  section: 'Location';
  decision: Exclude<AdminReviewStatus, 'Pending'>;
  overallStatus: PropertyAdminReviewStatus;
}

export type SectionReviewResponse =
  | PhotoReviewResponse
  | TermsReviewResponse
  | LicenseReviewResponse
  | BasicDataReviewResponse
  | LocationReviewResponse
  | LocalSectionDecisionResult;

export interface BuildingReviewInfo {
  id: string;
  name: string;
  location: string;
  organization: string;
  organizationLogoUrl: string | null;
  totalUnits: string;
  imageUrl: string;
  propertyTypeName: string;
  businessType: string;
  region: string;
  city: string;
  district: string;
  streetName: string;
  buildingNumber: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PropertyFinalDecisionPayload {
  finalNotes: string | null;
}

export interface PropertyFinalDecisionResult {
  propertyId: number;
  status: number;
}

export interface SectionReview {
  decision: SectionDecisionStatus;
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
  // null when this property doesn't require a license section (see licenseSectionDecision above).
  licenseSection: SectionReview | null;
  basicDataSection: SectionReview;
  locationSection: SectionReview;
  photosApprovedCount: number;
  photosMinRequired: number;
  completedSections: number;
  progressPercentage: number;
  canFinalApprove: boolean;
}
