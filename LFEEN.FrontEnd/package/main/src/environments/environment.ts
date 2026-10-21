export const environment = {
  production: false,
  apiBaseUrl: '',
  googleMapsApiKey: '__GOOGLE_MAPS_API_KEY__',
  // Flow "report an issue" button (internal team only); null turns it off.
  // key = the App report key (flw_rep_…), project = the row code in that key
  // (its channel must be set to "All channels" in Flow).
  flowReport: { key: 'flw_rep_REPLACE_ME', project: 'admin-all' } as { key: string; project: string } | null
};
