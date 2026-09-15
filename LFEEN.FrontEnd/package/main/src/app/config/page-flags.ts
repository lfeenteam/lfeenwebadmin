// Single source of truth for pages that aren't wired to the backend yet.
// Flip a key to true once its page is ready — that alone re-enables the
// route (page-flag.guard.ts) and the sidebar link (sidebar.service.ts).
export const PAGE_FLAGS: Record<string, boolean> = {
  permissions: true,
  'permission-groups': false,
  dashboard: true,                  // ceo-page: static cards/charts, nothing fetched from a service
  notifications: true,              // hardcoded fake notifications list
  settings: true,                   // platform-settings: all fields are static literals
  settlements: true,                // MOCK_SETTLEMENTS const, no settlements API yet
  'subscriptions-management': true, // hardcoded accounts/stats + setTimeout fake loader
};

export type PageFlagKey = keyof typeof PAGE_FLAGS;
