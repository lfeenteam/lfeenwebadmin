/**
 * The demo accounts list's last filters (?search=&status=&page=&size=), so the details
 * page's back button returns to the same view. Kept in memory only — the search can hold
 * a person's name or phone, which must not go to localStorage.
 */
export const demoListState: { query: Record<string, string> } = { query: {} };

/** Allowed page sizes for the list (never above 100). */
export const DEMO_PAGE_SIZES = [20, 50, 100] as const;
export const DEMO_DEFAULT_PAGE_SIZE = 20;
