import { appLocale } from './locale-format.util';

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

// Saudi time is UTC+3 all year (no DST), so a fixed offset is exact.
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Shifts a UTC instant so its getUTC* fields read as Riyadh wall-clock time,
 * independent of the viewer's browser time zone.
 */
function toRiyadhFields(d: Date): Date {
  return new Date(d.getTime() + RIYADH_OFFSET_MS);
}

/**
 * Formats a UTC API timestamp in the viewer's local time zone (unlike formatLocalizedDateTime,
 * which always uses Riyadh time). Returns null if invalid.
 */
export function formatApiDateLocal(iso: string | null | undefined, lang: string, withTime = false): string | null {
  const d = parseApiUtc(iso);
  if (!d) return null;
  return d.toLocaleString(appLocale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

/**
 * Formats a UTC ISO string in Riyadh time into localized "D Month YYYY" / "hh:mm AM" parts
 * (e.g. "15 نوفمبر 2026" / "03:00 م"), matching what the host app shows. Null if invalid.
 */
export function formatLocalizedDateTime(
  iso: string | null | undefined,
  lang: string
): { date: string; time: string } | null {
  const parsed = parseApiUtc(iso);
  if (!parsed) return null;
  const d = toRiyadhFields(parsed);

  const months = monthsFor(lang);
  const hours = d.getUTCHours();
  const hours12 = hours % 12 || 12;
  const isPm = hours >= 12;
  const period = lang === 'en' ? (isPm ? 'PM' : 'AM') : (isPm ? 'م' : 'ص');
  return {
    date: `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    time: `${pad2(hours12)}:${pad2(d.getUTCMinutes())} ${period}`,
  };
}

/**
 * Formats a backend TimeSpan wall-clock time ("15:00:00" / "15:00") as a localized
 * 12-hour label ("3:00 م" / "3:00 PM"), matching the host app. Returns null when the
 * value is missing or not a valid time, so callers can pick their own placeholder.
 */
export function formatTimeOfDay(time: string | null | undefined, lang: string): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time?.trim() ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const isPm = hours >= 12;
  const period = lang === 'en' ? (isPm ? 'PM' : 'AM') : (isPm ? 'م' : 'ص');
  return `${hours % 12 || 12}:${pad2(minutes)} ${period}`;
}

/** Formats a UTC ISO string into a localized "D Month" label in Riyadh time, or '-' if invalid. */
export function formatLocalizedDayMonth(iso: string | null | undefined, lang: string): string {
  const parsed = parseApiUtc(iso);
  if (!parsed) return '-';
  const d = toRiyadhFields(parsed);

  return `${d.getUTCDate()} ${monthsFor(lang)[d.getUTCMonth()]}`;
}
