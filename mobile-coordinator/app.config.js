/**
 * Build-time overrides on top of app.json.
 *
 * app.json carries the development defaults and stays as the single
 * description of the app. What changes between a developer's machine and a
 * release is the API address and the version, and neither belongs in a file
 * that gets committed and then edited back again before every build — an APK
 * shipped with `localhost` in it is silent: it installs, it opens, and every
 * request fails on the device with nothing on the server to show for it.
 *
 * Expo loads app.json first and hands it here as `config`.
 */
module.exports = ({ config }) => {
  const apiBaseUrl = process.env.CBMS_API_BASE_URL ?? config.extra?.apiBaseUrl;

  return {
    ...config,
    version: process.env.CBMS_APP_VERSION ?? config.version,
    android: {
      ...config.android,
      /* Play will not accept the same versionCode twice, and neither will a
         device upgrading in place. The build script increments it. */
      versionCode: process.env.CBMS_ANDROID_VERSION_CODE
        ? Number(process.env.CBMS_ANDROID_VERSION_CODE)
        : config.android?.versionCode,
    },
    extra: {
      ...config.extra,
      apiBaseUrl,
    },
  };
};
