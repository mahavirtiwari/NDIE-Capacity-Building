export const environment = {
  production: true,
  useMockApi: false,
  /* Relative on purpose: the built app is served from the same origin as
     the API, so this is correct on every host it is deployed to. Use an
     absolute URL only when the two are genuinely split, and add that
     origin to Cors:AllowedOrigins on the API. */
  apiBaseUrl: '/api',
  appName: 'Capacity Building Management System',
  appShortName: 'CBMS',
  organisation: 'Ministry of MSME',
  supportEmail: 'support@training.local',
  sessionIdleMinutes: 30,
};
