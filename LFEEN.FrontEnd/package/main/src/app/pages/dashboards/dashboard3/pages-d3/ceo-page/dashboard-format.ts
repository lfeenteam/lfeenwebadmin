import { MetricComparison, RateComparison } from './interfaces/dashboard.model';

export const EM_DASH = '—';

export function dashboardLocale(lang: string): string {
  return lang === 'en' ? 'en-US' : 'ar-SA';
}

export function formatInteger(value: number, lang: string): string {
  return new Intl.NumberFormat(dashboardLocale(lang), { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(value: number, lang: string): string {
  return new Intl.NumberFormat(dashboardLocale(lang), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Money without a currency symbol; the template renders the riyal icon next to it. */
export function formatMoney(value: number, lang: string): string {
  return new Intl.NumberFormat(dashboardLocale(lang), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatRate(value: number, lang: string): string {
  return `${formatDecimal(value, lang)}%`;
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface Trend {
  text: string;
  direction: TrendDirection;
}

/** null changePercentage means the previous value was zero → show an em dash, never 0% or 100%. */
export function relativeTrend(metric: MetricComparison, lang: string): Trend {
  if (metric.changePercentage == null) return { text: EM_DASH, direction: 'flat' };
  const pct = metric.changePercentage;
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${formatDecimal(pct, lang)}%`,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  };
}

/** Absolute rate difference, displayed as points ("+1.2 نقطة"), not as growth percent. */
export function pointsTrend(rate: RateComparison, lang: string): Trend {
  const pts = rate.changePercentagePoints;
  const sign = pts > 0 ? '+' : '';
  return {
    text: `${sign}${formatDecimal(pts, lang)}`,
    direction: pts > 0 ? 'up' : pts < 0 ? 'down' : 'flat',
  };
}
