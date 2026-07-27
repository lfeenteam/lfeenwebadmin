export const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
export const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthsFor(lang: string): string[] {
  return lang === 'en' ? MONTHS_EN : MONTHS_AR;
}

/** Formats a UTC ISO string into localized "D Month YYYY" / "HH:mm" parts, or null if invalid. */
export function formatLocalizedDateTime(
  iso: string | null | undefined,
  lang: string
): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const months = monthsFor(lang);
  return {
    date: `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    time: `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`,
  };
}

/** Formats a UTC ISO string into a localized "D Month" label, or '-' if invalid. */
export function formatLocalizedDayMonth(iso: string | null | undefined, lang: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';

  return `${d.getUTCDate()} ${monthsFor(lang)[d.getUTCMonth()]}`;
}
