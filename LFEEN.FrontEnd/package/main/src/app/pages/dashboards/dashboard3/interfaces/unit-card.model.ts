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
  propertyId: number;
  propertyName: string;
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
