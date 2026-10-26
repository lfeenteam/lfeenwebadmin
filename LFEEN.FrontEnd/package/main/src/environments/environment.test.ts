export const environment = {
  production: false,
  apiBaseUrl: 'https://test-api-admin.lfeen.com',
  // Catalog icons manifest (public, no auth) — served by the main API, not the admin API.
  catalogIconsUrl: 'https://test-api.lfeen.com/api/catalog-icons',
  googleMapsApiKey: '__GOOGLE_MAPS_API_KEY__',
  // Flow "report an issue" button (internal team only); null turns it off.
  // key = the App report key (flw_rep_…), project = the row code in that key
  // (its channel must be set to "All channels" in Flow).
  flowReport: { key: 'flw_rep_7Kh94HiQYOEM8plgkxJCkTDeWMSieZEeAQno8pFl', project: 'admin' } as { key: string; project: string } | null
};
