export const environment = {
  production: false,
  apiBaseUrl: 'https://test-api-admin.lfeen.com',
  googleMapsApiKey: '__GOOGLE_MAPS_API_KEY__',
  // Flow "report an issue" button (internal team only); null turns it off.
  // key = the App report key (flw_rep_…), project = the row code in that key,
  // channel = the Flow channel name (the row is "all channels").
  flowReport: { key: 'flw_rep_REPLACE_ME', project: 'admin-web', channel: 'Web' } as { key: string; project: string; channel: string } | null
};
