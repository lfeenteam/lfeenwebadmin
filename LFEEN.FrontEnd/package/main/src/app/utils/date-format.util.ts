export const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
export const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthsFor(lang: string): string[] {
  return lang === 'en' ? MONTHS_EN : MONTHS_AR;
}

/**
 * Parses an API timestamp that is meant to be UTC. The backend often omits the
 * `Z` designator (e.g. "2026-08-30T09:00:27.116"), which `new Date()` would
 * otherwise read as local time and shift by the viewer's offset. Appending `Z`
 * when no timezone is present keeps these instants anchored to UTC.
 */
export function parseApiUtc(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // Only a time-bearing string with no explicit zone needs the `Z` fix.
  const needsZ = iso.includes('T') && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(needsZ ? `${iso}Z` : iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Formats a UTC ISO string into localized "D Month YYYY" / "HH:mm" parts, or null if invalid. */
export function formatLocalizedDateTime(
  iso: string | null | undefined,
  lang: string
): { date: string; time: string } | null {
  const d = parseApiUtc(iso);
  if (!d) return null;

  const months = monthsFor(lang);
  return {
    date: `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    time: `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`,
  };
}

/** Formats a UTC ISO string into a localized "D Month" label, or '-' if invalid. */
export function formatLocalizedDayMonth(iso: string | null | undefined, lang: string): string {
  const d = parseApiUtc(iso);
  if (!d) return '-';

  return `${d.getUTCDate()} ${monthsFor(lang)[d.getUTCMonth()]}`;
}

/**
 * Formats a naive "wall clock" ISO string (no timezone, e.g. a property-local
 * check-in time) into a localized "D Month" label without any offset shifting.
 */
export function formatNaiveDayMonth(iso: string | Date | null | undefined, lang: string): string {
  if (!iso) return '-';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return '-';

  return `${d.getDate()} ${monthsFor(lang)[d.getMonth()]}`;
}
