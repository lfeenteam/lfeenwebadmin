export interface MetricCard {
  titleKey: string;
  value: string | number;
  icon: string;
  tone: 'green' | 'gray' | 'black' | 'orange';
}

export interface TabOption {
  id: string;
  labelKey: string;
}

export type ViewMode = 'grid' | 'list';

export interface BuildFilterOption {
  id: string;
  labelKey: string;
  items: { value: string; labelKey: string }[];
}
