export type D3HeaderType = 'ceo' | 'page';

export interface D3RouteHeaderData {
  header?: D3HeaderType;
  titleKey?: string;
  breadcrumbKey?: string;
  showLive?: boolean;
  showDate?: boolean;
}
