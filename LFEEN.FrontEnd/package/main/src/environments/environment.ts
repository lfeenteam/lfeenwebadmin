export const environment = {
  production: false,
  apiBaseUrl: '',
  // Catalog icons manifest (public, no auth) — served by the main API, not the admin API.
  catalogIconsUrl: '',
  googleMapsApiKey: '__GOOGLE_MAPS_API_KEY__',
  // Client web demo sign-up page (= Demo:SelfSignup:PageUrl on the server). Used only when a
  // link comes back with url = null; null = show the code alone.
  demoSignupPageUrl: null as string | null,
  // Flow "report an issue" button (internal team only); null turns it off.
  // key = the App report key (flw_rep_…), project = the row code in that key
  // (its channel must be set to "All channels" in Flow).
  flowReport: { key: 'flw_rep_REPLACE_ME', project: 'admin-all' } as { key: string; project: string } | null
};
