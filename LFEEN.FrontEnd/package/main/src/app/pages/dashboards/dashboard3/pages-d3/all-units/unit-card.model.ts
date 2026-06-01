export type UnitStatus = 'active' | 'stopped';

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
}

export interface BuildingWithUnits {
  id: string;
  name: string;
  location: string;
  publishedUnits: number;
  image: string;
  units: UnitCardItem[];
}
