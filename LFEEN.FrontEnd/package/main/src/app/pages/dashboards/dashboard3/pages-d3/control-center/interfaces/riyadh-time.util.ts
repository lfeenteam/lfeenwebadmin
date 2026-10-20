// The API works in Saudi time (UTC+3, no DST). These helpers keep the admin's own
// browser time zone out of it: what the admin picks is always read as Riyadh time.

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Today in Riyadh, "yyyy-MM-dd". */
export function riyadhToday(): string {
  return utcToRiyadhLocal(new Date().toISOString()).slice(0, 10);
}

/** Now in Riyadh as "yyyy-MM-ddTHH:mm" — comparable with picker values. */
export function riyadhNowLocal(): string {
  return utcToRiyadhLocal(new Date().toISOString());
}

/** "2026-10-21T23:00:00Z" → "2026-10-22T02:00" (Riyadh wall-clock, for the pickers). */
export function utcToRiyadhLocal(utc: string): string {
  const d = new Date(new Date(utc).getTime() + RIYADH_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Picker value "2026-10-20T02:00" → "2026-10-20T02:00:00+03:00" for the API. */
export function riyadhLocalToOffset(local: string): string {
  return `${local.slice(0, 16)}:00+03:00`;
}

/** Shows a UTC instant in Riyadh time, e.g. "20 أكتوبر 2026، 2:00 ص". */
export function formatRiyadh(utc: string, lang: string, withDate = true): string {
  const locale = lang === 'en' ? 'en-US' : 'ar-SA';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Riyadh',
    calendar: 'gregory',
    hour: 'numeric',
    minute: '2-digit',
    ...(withDate ? { day: 'numeric', month: 'short', year: 'numeric' } : {}),
  }).format(new Date(utc));
}
