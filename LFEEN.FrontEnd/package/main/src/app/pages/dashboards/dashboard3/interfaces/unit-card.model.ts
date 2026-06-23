export type UnitStatus = 'active' | 'stopped' | 'underReview';
export type UnitTab    = 'published' | 'new' | 'underReview' | 'rejected';
export type CancelPolicyType = 'non_refundable' | 'flexible' | 'partial_refund';
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
  hasLock: boolean;
  reviewStatus: string;
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

export interface PaginatedUnitResponse {
  data: UnitApiItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
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
  depositSection: UnitApiSection;
  servicesSection: UnitApiSection;
  licenseSection: UnitApiSection;
  completedSections: number;
  totalSections: number;
  progressPercentage: number;
  canFinalApprove: boolean;
}

// ── Access endpoint (/units/{id}/access) ─────────────────────────────────────

export interface UnitAccessPhotoItem {
  category: string;
  imageUrl: string;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export interface UnitAccessResponse {
  unitId: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  accessDescription: string | null;
  buildingExteriorImageUrl: string | null;
  buildingEntranceImageUrl: string | null;
  hallwayImageUrl: string | null;
  unitDoorImageUrl: string | null;
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
  classificationCategory: string;
  classificationConfidence: number;
  displayOrder: number;
  decision: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export interface UnitPhotoGroupItem {
  groupKey: string;
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
  displayNameAr: string | null;
  displayNameEn: string | null;
  uiType: string;
  isFree: boolean;
  cost: number | null;
  costType: string;
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
  channels: unknown[];
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
