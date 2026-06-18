export type UnitStatus = 'active' | 'stopped' | 'underReview';
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
