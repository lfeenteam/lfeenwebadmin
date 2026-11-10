/**
 * Single source of truth for number/date formatting across the admin.
 *
 * Arabic uses Latin digits (nu-latn) and the Gregorian calendar (ca-gregory) everywhere:
 * booking numbers, phones and codes come from the API as Latin text, so formatted amounts
 * and dates must match them. Plain 'ar-SA'/'ar-EG' would give Eastern Arabic digits, and
 * plain 'ar-SA' would also switch dates to the Hijri calendar.
 */
export const AR_LOCALE = 'ar-SA-u-nu-latn-ca-gregory';
export const EN_LOCALE = 'en-US';

export function appLocale(lang: string | null | undefined): string {
  return lang === 'en' ? EN_LOCALE : AR_LOCALE;
}

export function formatAppNumber(
  value: number | null | undefined,
  lang: string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  return (value ?? 0).toLocaleString(appLocale(lang), options);
}

/** Named presets for the appDate pipe (mirrors the Angular DatePipe names used in templates). */
export const APP_DATE_PRESETS: Record<string, Intl.DateTimeFormatOptions> = {
  mediumDate: { day: 'numeric', month: 'long', year: 'numeric' },
  medium:     { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' },
};

export function formatAppDate(
  value: string | number | Date | null | undefined,
  lang: string | null | undefined,
  options: Intl.DateTimeFormatOptions = APP_DATE_PRESETS['mediumDate']
): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(appLocale(lang), options);
}
