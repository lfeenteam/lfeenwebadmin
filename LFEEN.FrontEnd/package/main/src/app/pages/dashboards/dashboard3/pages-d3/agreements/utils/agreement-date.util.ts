import { parseApiUtc } from 'src/app/utils/date-format.util';
import { appLocale } from 'src/app/utils/locale-format.util';

/** Riyadh is UTC+3 all year (no DST). */
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
export const RIYADH_TZ = 'Asia/Riyadh';

/** A calendar day as the admin sees it in Riyadh. Months are 0-based (like Date). */
export interface RiyadhDay {
  year: number;
  month: number;
  day: number;
}

/** Formats an API timestamp (UTC, often without `Z`) as a Riyadh date, or null. */
export function formatRiyadhDate(iso: string | null | undefined, lang: string, withTime = false): string | null {
  const d = parseApiUtc(iso);
  if (!d) return null;
  return d.toLocaleString(appLocale(lang), {
    timeZone: RIYADH_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

/** The Riyadh calendar day of an API timestamp. */
export function riyadhDayOf(iso: string | null | undefined): RiyadhDay | null {
  const d = parseApiUtc(iso);
  if (!d) return null;
  const shifted = new Date(d.getTime() + RIYADH_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

export function todayInRiyadh(): RiyadhDay {
  return riyadhDayOf(new Date().toISOString())!;
}

/** Tomorrow in Riyadh: the earliest expiry date allowed. */
export function tomorrowInRiyadh(): RiyadhDay {
  const t = todayInRiyadh();
  const next = new Date(Date.UTC(t.year, t.month, t.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth(), day: next.getUTCDate() };
}

/**
 * The picked Riyadh day is valid through its last second, so it is sent as the
 * end of that day in UTC: 30 Jun 2027 (Riyadh) → "2027-06-30T20:59:59Z".
 * Publish and the expiry PATCH both use this rule.
 */
export function riyadhEndOfDayUtc(day: RiyadhDay): string {
  const ms = Date.UTC(day.year, day.month, day.day, 23, 59, 59) - RIYADH_OFFSET_MS;
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

/** Local-midnight Date for the native mat-calendar adapter (it works in local time). */
export function dayToPickerDate(day: RiyadhDay | null): Date | null {
  return day ? new Date(day.year, day.month, day.day) : null;
}

export function pickerDateToDay(date: Date | null): RiyadhDay | null {
  return date ? { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() } : null;
}

/** "31 / 12 / 2026" style label for a picked day. */
export function formatPickedDay(day: RiyadhDay | null, lang: string): string {
  if (!day) return '';
  return new Date(Date.UTC(day.year, day.month, day.day)).toLocaleDateString(appLocale(lang), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function compareDays(a: RiyadhDay, b: RiyadhDay): number {
  return Date.UTC(a.year, a.month, a.day) - Date.UTC(b.year, b.month, b.day);
}
