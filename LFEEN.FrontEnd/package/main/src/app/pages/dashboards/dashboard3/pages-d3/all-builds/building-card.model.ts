export type BuildingTab = 'published' | 'underReview';
export type BuildingViewMode = 'grid' | 'list';
export type BuildingStatus = 'active' | 'stopped';

export interface BuildingCardItem {
  id: string;
  title: string;
  host?: string;
  location: string;
  status: BuildingStatus;
  typeLabel: string;
  units: number;
  occupancy: number;
  bookings: number;
  lastUpdate?: string;
  tab: BuildingTab;
}
