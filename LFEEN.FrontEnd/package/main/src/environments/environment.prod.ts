export const environment = {
  production: true,
  apiBaseUrl: 'https://operation-admin.lfeen.com',
  // Catalog icons manifest (public, no auth) — served by the main API, not the admin API.
  catalogIconsUrl: 'https://api.lfeen.com/api/catalog-icons',
  googleMapsApiKey: '__GOOGLE_MAPS_API_KEY__',
  // Flow "report an issue" button; null turns it off. To enable it for customers set
  // { key: '<Production flw_rep_ key>', project: '<row code>' } (the row's channel must
  // be set to "All channels" in Flow).
  flowReport: null as { key: string; project: string } | null
};
