export type UnitStatus = 'active' | 'stopped' | 'pending' | 'underReview' | 'pendingChanges' | 'pendingAfterRejection' | 'draft';
export type UnitTab    = 'draft' | 'published' | 'new' | 'underReview' | 'rejected' | 'pendingChanges';
export type CancelPolicyType = 'NonRefundable' | 'Flexible' | 'PartialRefundOnly';
export type UnitServicesPricingType = 'paid' | 'free';

export interface UnitCardItem {
  id: string;
  unitNumber: string;
  title: string;
  floor: string;
  capacity: string;
  status: UnitStatus;
  type: string;
  description: string;
  district: string | null;
  rooms: number;
  hasPool: boolean;
  area?: string;
  cancelPolicyType?: CancelPolicyType;
  servicesPricingType?: UnitServicesPricingType;
}

export interface UnitAmenityItem {
  icon: string;
  label: string;
}

export interface UnitSubArea {
  label: string;
  amenities: UnitAmenityItem[];
  services: UnitAmenityItem[];
}

export interface UnitRoomSection {
  icon: string;
  title: string;
  desc: string;
  badge?: string;
  amenities: UnitAmenityItem[];
  services: UnitAmenityItem[];
  subAreas?: UnitSubArea[];
  isOpen: boolean;
}

export interface UnitFacilityStat {
  label: string;
  value: string;
}

export interface BuildingWithUnits {
  id: string;
  name: string;
  location: string;
  publishedUnits: number;
  image: string;
  units: UnitCardItem[];
  needsPropertyReview?: boolean;
}

// 0=Draft, 1=Pending, 2=UnderReview, 3=Approved, 4=Rejected, 5=HasPendingChanges, 6=PendingAfterRejection, null/empty=not reviewed
export type UnitReviewStatusCode =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 'Draft'
  | 'Pending'
  | 'UnderReview'
  | 'Approved'
  | 'Rejected'
  | 'HasPendingChanges'
  | 'PendingAfterRejection'
  | ''
  | null;

export interface UnitApiItem {
  unitId: number;
  externalId: string;
  name: string | null;
  description: string | null;
  propertyId: number;
  propertyName: string;
  propertyAdminReviewStatus: string | null;
  accountId: string;
  accountName: string | null;
  accountLogoUrl: string | null;
  unitTypeName: string;
  floorNumber: number;
  apartmentNumberInFloor: number;
  mainPhotoUrl: string | null;
  maxGuests: number | null;
  district: string | null;
  hasLock: boolean;
  reviewStatus: UnitReviewStatusCode;
  basicDataDecision: string;
  photosDecision: string;
  termsDecision: string;
  pricingDecision: string;
  accessDecision: string;
  cancellationPolicyDecision: string;
  depositDecision: string;
  servicesDecision: string;
  licenseDecision: string;
  completedSections: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnitApiStats {
  total: number;
  activeOrPublished: number;
  pendingOrRejected: number;
  underReview: number;
}

export interface PaginatedUnitResponse {
  data: UnitApiItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
  stats: UnitApiStats;
}

export interface UnitApiSection {
  decision: string;
  description: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export interface UnitApiDetailItem {
  unitId: number;
  externalId: string;
  name: string | null;
  propertyId: number;
  propertyExternalId: string;
  district: string | null;
  propertyName: string;
  accountId: string;
  accountName: string | null;
  accountLogoUrl: string | null;
  unitTypeName: string;
  floorNumber: number;
  apartmentNumberInFloor: number;
  maxGuests: number;
  sizeM: number;
  mainPhotoUrl: string | null;
  hasLock: boolean;
  isSmartLockActive: boolean;
  overallStatus: string;
  // Whether the unit is actually live/published for booking. Distinct from
  // overallStatus === 'Approved', which only reflects that every review section
  // has been approved — the unit doesn't go live until the final approval action
  // is submitted, so isDisplayed is the reliable "final approval already done" signal.
  isDisplayed: boolean;
  finalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  basicDataSection: UnitApiSection;
  photosSection: UnitApiSection;
  termsSection: UnitApiSection;
  pricingSection: UnitApiSection;
  accessSection: UnitApiSection;
  accessPhotosSection: UnitApiSection;
  cancellationPolicySection: UnitApiSection;
  // null when the unit's type/business setup doesn't require a deposit section at all
  // (as opposed to hasSecurityDeposit=false, which means a deposit isn't required for
  // this unit but the section is still shown as an informational badge).
  depositSection: UnitApiSection | null;
  hasSecurityDeposit: boolean;
  servicesSection: UnitApiSection;
  // null when the unit's type/business setup doesn't require a license section at all
  // (as opposed to Pending, which means it's required but undecided).
  licenseSection: UnitApiSection | null;
  licenseApplicable: boolean;
  completedSections: number;
  totalSections: number;
  progressPercentage: number;
  canFinalApprove: boolean;
}

// ── Access endpoint (/units/{id}/access) ─────────────────────────────────────

export interface UnitAccessPhotoItem {
  category: string;
  categoryName: string | null;
  imageUrl: string;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export interface UnitAccessResponse {
  unitId: number;
  unitNumber: number | null;
  floorNumber: number | null;
  mainPhotoUrl: string | null;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  accessDescription: string | null;
  allowSelfCheckIn: boolean | null;
  pendingData: unknown;
  photosDecision: string;
  photosRejectionReason: string | null;
  photosReviewedAt: string | null;
  photos: UnitAccessPhotoItem[];
}

// ── Terms endpoint (/units/{id}/terms) ───────────────────────────────────────

export interface UnitTermsCondition {
  id: number;
  name: string;
  conditionKey: string;
  isSelected: boolean;
}

export interface UnitTermsCustomRule {
  description: string;
}

export interface UnitTermsResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  checkInTime: string;
  checkOutTime: string;
  isEarlyCheckInAllowed: boolean;
  earlyCheckInFrom: string;
  conditions: UnitTermsCondition[];
  customRules: UnitTermsCustomRule[];
  pendingData: unknown;
}

// ── Photos endpoint (/units/{id}/photos) ─────────────────────────────────────

export interface UnitPhotoItem {
  mediaId: number;
  url: string;
  isMainPhoto: boolean;
  isPendingDeletion: boolean;
  pendingIsMain: boolean | null;
  classification: string;
  classificationLabel: string;
  classificationCategory: string;
  classificationConfidence: number;
  displayOrder: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export interface UnitPhotoGroupItem {
  groupKey: string;
  groupLabel: string;
  totalCount: number;
  photos: UnitPhotoItem[];
}

export interface UnitPhotosResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  approvedCount: number;
  minRequired: number;
  groups: UnitPhotoGroupItem[];
}

// ── Basic-data endpoint (/units/{id}/basic-data) ──────────────────────────────

export interface UnitBasicDataBed {
  bedTypeName: string;
  quantity: number;
}

export interface UnitBasicDataFacility {
  facilityId: number;
  facilityTypeName: string;
}

export interface UnitBasicDataService {
  serviceId: number;
  serviceExternalId: string;
  serviceTypeId: number;
  serviceTypeNameKey: string;
  displayName: string | null;
  uiType: string;
  isFree: boolean;
  cost: number | null;
  costType: string | null;
  wifiSsid: string | null;
  wifiPassword: string | null;
  isWifiConfigured: boolean;
  hasPersonAvailable: boolean | null;
  hasWifiCredentials: boolean;
  hasPersonOption: boolean;
  allowedCostTypes: string[];
}

export interface UnitBasicDataSubRoom {
  subRoomId: number;
  subRoomTypeName: string;
  sizeM: number;
  services: UnitBasicDataService[];
  facilities: UnitBasicDataFacility[];
}

export interface UnitBasicDataRoom {
  roomId: number;
  roomTypeName: string;
  beds: UnitBasicDataBed[];
  services: UnitBasicDataService[];
  facilities: UnitBasicDataFacility[];
  subRooms: UnitBasicDataSubRoom[];
}

export interface UnitBasicDataResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  isActive: boolean;
  unitUniqueCode: string | null;
  title: string | null;
  description: string | null;
  unitTypeName: string;
  propertyName: string;
  district: string | null;
  floorNumber: number;
  apartmentNumberInFloor: number;
  maxGuests: number;
  sizeM: number;
  hasLock: boolean;
  rooms: UnitBasicDataRoom[];
  services: UnitBasicDataService[];
  facilities: UnitBasicDataFacility[];
  pendingData: unknown;
}

// ── Pricing endpoint (/units/{id}/pricing) ───────────────────────────────────

export interface UnitPricingDayPartition {
  partitionKey: string;
  discountPercent: number;
  isActive: boolean;
}

export interface UnitPricingLongStayRule {
  minimumNights: number;
  discountPercent: number;
  isActive: boolean;
}

export interface UnitPricingDayRule {
  dayOfWeek: string;
  isEnabled: boolean;
  changeMode: string;
  changePercent: number;
  basePrice: number;
  finalPrice: number;
}

export interface UnitPricingChannel {
  channelCode: string;
  isActive: boolean;
  changeMode: string;
  changePercent: number;
  finalPrice: number;
}

export interface UnitPricingCustomPeriod {
  name: string;
  startDate: string;
  repeatMode: string;
  endDate: string | null;
  repeatCount: number | null;
  repeatInterval: string;
  dayRules: UnitPricingDayRule[];
}

export interface UnitPricingResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  basePricePerNight: number;
  minimumPricePerNight: number;
  currencyCode: string;
  enableDayPartitioning: boolean;
  dayPartitions: UnitPricingDayPartition[];
  enableLongStayDiscount: boolean;
  longStayRules: UnitPricingLongStayRule[];
  enableChannelPricing: boolean;
  channels: UnitPricingChannel[];
  customPeriods: UnitPricingCustomPeriod[];
  pendingData: unknown;
}

// ── Pricing Calendar endpoint (/units/{id}/pricing/calendar) ─────────────────

export interface UnitPricingCalendarDay {
  date: string;
  dayNumber: number;
  price: number;
  periodName: string | null;
  isEnabled: boolean;
}

export interface UnitPricingCalendarResponse {
  viewYear: number;
  viewMonth: number;
  monthLabel: string;
  currencyCode: string;
  days: UnitPricingCalendarDay[];
}

// ── Deposit endpoint (/units/{id}/deposit) ────────────────────────────────────

export interface UnitDepositResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  hasDeposit: boolean;
  amount: number;
  pendingData: unknown;
}

// ── Services endpoint (/units/{id}/services) ─────────────────────────────────

export interface UnitServicesServiceItem {
  serviceId: number;
  serviceExternalId: string;
  serviceTypeId: number;
  serviceTypeNameKey: string;
  displayNameAr: string | null;
  displayNameEn: string | null;
  uiType: string;
  isFree: boolean;
  cost: number | null;
  costType: string | null;
  wifiSsid: string | null;
  wifiPassword: string | null;
  isWifiConfigured: boolean;
  hasPersonAvailable: boolean | null;
  hasWifiCredentials: boolean;
  hasPersonOption: boolean;
  allowedCostTypes: string[];
}

export interface UnitServicesGroup {
  groupKey: string;
  groupNameAr: string;
  groupNameEn: string;
  services: UnitServicesServiceItem[];
}

export interface UnitServicesResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  groups: UnitServicesGroup[];
  facilities: UnitBasicDataFacility[];
  pendingData: unknown;
}

// ── License endpoint (/units/{id}/license) ───────────────────────────────────

export interface UnitLicenseResponse {
  unitId: number;
  accountName: string | null;
  accountLogoUrl: string | null;
  companyNumber: string | null;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  licenseId: number;
  licenseNumber: string | null;
  licenseType: string | null;
  licenseTypeName: string | null;
  licenseAttachmentUrl: string | null;
  licenseAttachmentFileName: string | null;
  facilityName: string | null;
  commercialName: string | null;
  classification: string | null;
  facilityLocation: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenseStatusName: string | null;
  documentStatus: string | null;
  documentStatusName: string | null;
  uploadedAt: string | null;
}

// ── Cancellation Policy endpoint (/units/{id}/cancellation-policy) ────────────

export interface UnitCancellationPolicyResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  policyType: CancelPolicyType;
  noRefundBeforeHours: number | null;
  partialRefundPercentage: number | null;
  partialRefundBeforeHours: number | null;
  fullRefundBeforeHours: number | null;
  policySummary: string[];
  pendingData: unknown;
}
