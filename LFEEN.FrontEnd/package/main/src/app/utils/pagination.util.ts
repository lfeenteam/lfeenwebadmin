import { appLocale } from './locale-format.util';

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

/**
 * Phone-width pager list: at most five slots, so it fits next to the prev/next arrows
 * even at 320px, e.g. [1, 2, 3, '...', 11], [1, '...', 6, '...', 11], [1, '...', 9, 10, 11].
 */
export function getCompactVisiblePages(currentPage: number, totalPages: number): (number | '...')[] {
  const n = totalPages;
  const c = Math.min(Math.max(currentPage, 1), n);

  if (n <= 5) return Array.from({ length: n }, (_, i) => i + 1);
  if (c <= 2) return [1, 2, 3, '...', n];
  if (c >= n - 1) return [1, '...', n - 2, n - 1, n];

  return [1, '...', c, '...', n];
}

/** Thousands grouping with Latin digits, e.g. 12345 -> "12,345" (same in both languages). */
export function formatNumber(value: number): string {
  return value.toLocaleString(appLocale('en'));
}

/** Thousands grouping using the active UI language's locale (see locale-format.util). */
export function formatLocalizedNumber(value: number, lang: string): string {
  return value.toLocaleString(appLocale(lang));
}
