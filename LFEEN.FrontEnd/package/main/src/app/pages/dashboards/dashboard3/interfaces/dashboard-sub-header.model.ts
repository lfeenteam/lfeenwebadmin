export interface MetricCard {
  titleKey: string;
  value: string | number;
  icon: string;
  tone: 'green' | 'gray' | 'black' | 'orange';
}

export interface TabOption {
  id: string;
  labelKey: string;
  /** Optional badge next to the label; hidden when null/undefined or 0. */
  count?: number | null;
}

export type ViewMode = 'grid' | 'list';

export interface BuildFilterOption {
  id: string;
  labelKey: string;
  items: { value: string; labelKey: string }[];
}
