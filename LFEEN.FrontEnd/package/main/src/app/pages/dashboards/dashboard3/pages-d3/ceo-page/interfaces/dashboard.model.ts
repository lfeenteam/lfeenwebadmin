export interface MetricComparison {
  value: number;
  previousValue: number;
  changePercentage: number | null;
}

export interface RateComparison {
  value: number;
  previousValue: number;
  changePercentagePoints: number;
}

export interface UnavailableMetric {
  value: number | null;
  availability: 'notConfigured' | string;
  requiredSource: string;
}

export interface DashboardSummary {
  asOfUtc: string;
  currency: 'SAR' | string;
  period: {
    fromUtc: string;
    toUtc: string;
    comparisonFromUtc: string;
    comparisonToUtc: string;
    timeZone: string;
  };
  platform: {
    revenue: MetricComparison;
    completedBookings: MetricComparison;
    averageBookingValue: MetricComparison;
    cancellationRate: RateComparison;
  };
  guestApp: {
    registeredGuests: number;
    returningGuestRate: number;
    averageAppRating: number | null;
    openComplaints: number;
    malePercentage: number;
    femalePercentage: number;
    downloads: UnavailableMetric;
  };
  merchantApp: {
    activeMerchants: number;
    listedUnits: number;
    occupancyRate: number;
    merchantRetentionRate: number;
    openComplaints: number;
    averageAppRating: UnavailableMetric;
  };
  revenueSources: Array<{
    key: 'bookingCommissions' | 'subscriptions' | 'usageServices' | string;
    amount: number;
    percentage: number;
  }>;
  dataQuality: Array<{ code: string; message: string }>;
}

export interface DashboardGrowth {
  asOfUtc: string;
  period: { fromUtc: string; toUtc: string; timeZone: string };
  granularity: 'daily' | 'weekly' | 'monthly';
  totals: { newGuests: number; newMerchants: number; bookings: number };
  points: Array<{
    startUtc: string;
    endUtc: string;
    label: string;
    newGuests: number;
    newMerchants: number;
    bookings: number;
  }>;
}

export interface DashboardTopCities {
  asOfUtc: string;
  period: { fromUtc: string; toUtc: string; timeZone: string };
  totalBookings: number;
  mappedBookings: number;
  unmappedBookings: number;
  cities: Array<{
    rank: number;
    city: string;
    cityAr: string;
    cityEn: string;
    bookings: number;
    units: number;
    percentage: number;
  }>;
}

export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

export interface DashboardInsight {
  key: string;
  category: 'finance' | 'operations' | 'bookings' | 'support' | 'growth' | string;
  severity: InsightSeverity;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  value: number;
  unit: 'count' | 'percentage' | string;
  actionPath: string | null;
}

export interface DashboardInsights {
  generatedAtUtc: string;
  insights: DashboardInsight[];
}

export interface DashboardFilters {
  from?: string;
  to?: string;
  timeZone?: string;
}
