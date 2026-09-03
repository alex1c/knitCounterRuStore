/**
 * Expo config plugin: strip SYSTEM_ALERT_WINDOW from the Android manifest merger.
 * Keeps RuStore permission surface clean when a dependency merges this permission.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Removes uses-permission entries for SYSTEM_ALERT_WINDOW.
 */
function removePermission(androidManifest, name) {
  const manifest = androidManifest.manifest;
  if (!manifest['uses-permission']) return androidManifest;
  manifest['uses-permission'] = manifest['uses-permission'].filter((item) => {
    const attr = item.$?.['android:name'];
    return attr !== name;
  });
  return androidManifest;
}

const withRemoveSystemAlertWindow = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults = removePermission(
      config.modResults,
      'android.permission.SYSTEM_ALERT_WINDOW'
    );

    // Ensure an explicit remove node wins over dependency merges
    const manifest = config.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const already = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.SYSTEM_ALERT_WINDOW'
    );
    if (!already) {
      manifest['uses-permission'].push({
        $: {
          'android:name': 'android.permission.SYSTEM_ALERT_WINDOW',
          'tools:node': 'remove',
        },
      });
    }

    // Ensure tools namespace exists for tools:node
    if (!manifest.$) manifest.$ = {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
};

module.exports = withRemoveSystemAlertWindow;
