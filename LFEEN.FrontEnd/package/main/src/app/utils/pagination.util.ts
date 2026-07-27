/**
 * Builds a compact page-number list for a pager, e.g. [1, 2, 3, '...', 8, 9, 10].
 * `edgeCount` controls how many pages are shown around the current page / far edge
 * once truncation kicks in (dashboard3 uses 3 for most list pages, 2 for bookings).
 */
export function getVisiblePages(
  currentPage: number,
  totalPages: number,
  edgeCount: 2 | 3 = 3
): (number | '...')[] {
  const n = totalPages;
  const c = currentPage;

  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);

  const leftEdge = Array.from({ length: edgeCount }, (_, i) => i + 1);
  const rightEdge = Array.from({ length: edgeCount }, (_, i) => n - edgeCount + 1 + i);

  if (c <= 4) return [1, 2, 3, 4, '...', ...rightEdge];
  if (c >= n - 3) return [...leftEdge, '...', n - 3, n - 2, n - 1, n];

  return [...leftEdge, '...', c, '...', ...rightEdge];
}

/** Locale-agnostic thousands grouping, e.g. 12345 -> "12,345". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

/** Thousands grouping using the active UI language's locale (ar-SA vs en-US). */
export function formatLocalizedNumber(value: number, lang: string): string {
  return value.toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA');
}
