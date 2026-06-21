export type D3HeaderType = 'ceo' | 'page';

export interface D3RouteHeaderData {
  header?: D3HeaderType;
  titleKey?: string;
  breadcrumbKey?: string;
  breadcrumbRoute?: string;
  showLive?: boolean;
  showDate?: boolean;
  showBack?: boolean;
  statusBadge?: { text: string; color: string };
}
