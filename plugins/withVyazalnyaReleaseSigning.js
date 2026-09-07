/**
 * Expo config plugin: wire Android RELEASE signing from environment variables.
 *
 * Secrets stay out of Git. Required at build time:
 *   VYAZALNYA_STORE_PASSWORD
 *   VYAZALNYA_KEY_PASSWORD   (optional if same as store password)
 *
 * Non-secret defaults (overridable):
 *   VYAZALNYA_STORE_FILE  -> D:\\PetProject\\secure\\knitCounter\\vyazalnya-release.jks
 *   VYAZALNYA_KEY_ALIAS   -> vyazalnya
 *
 * Release must NEVER fall back to debug.keystore.
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

const SIGNING_MARKER = '// [vyazalnya-release-signing]';

const DEFAULT_STORE_FILE =
  'D:\\\\PetProject\\\\secure\\\\knitCounter\\\\vyazalnya-release.jks';
const DEFAULT_ALIAS = 'vyazalnya';

/**
 * Injects a release signingConfig that reads passwords from the environment.
 */
function applyReleaseSigning(buildGradle) {
  if (buildGradle.includes(SIGNING_MARKER)) {
    return buildGradle;
  }

  if (!/signingConfigs\s*\{/.test(buildGradle)) {
    throw new Error(
      'withVyazalnyaReleaseSigning: signingConfigs block not found in app/build.gradle'
    );
  }

  const releaseSigningBlock = `
        ${SIGNING_MARKER}
        release {
            // Production keystore path/alias are non-secret; passwords come from env only.
            def storePath = System.getenv("VYAZALNYA_STORE_FILE")
            if (storePath == null || storePath.trim().isEmpty()) {
                storePath = "${DEFAULT_STORE_FILE}"
            }
            def aliasName = System.getenv("VYAZALNYA_KEY_ALIAS")
            if (aliasName == null || aliasName.trim().isEmpty()) {
                aliasName = "${DEFAULT_ALIAS}"
            }
            def storePass = System.getenv("VYAZALNYA_STORE_PASSWORD")
            def keyPass = System.getenv("VYAZALNYA_KEY_PASSWORD")
            if (keyPass == null || keyPass.trim().isEmpty()) {
                keyPass = storePass
            }
            if (storePass == null || storePass.trim().isEmpty()) {
                throw new GradleException(
                    "Missing VYAZALNYA_STORE_PASSWORD. Set env vars before :app:bundleRelease."
                )
            }
            def store = file(storePath)
            if (!store.exists()) {
                throw new GradleException("Release keystore not found: " + storePath)
            }
            storeFile store
            storePassword storePass
            keyAlias aliasName
            keyPassword keyPass
        }
`;

  // Insert release config inside signingConfigs { ... }
  let updated = buildGradle.replace(
    /signingConfigs\s*\{/,
    (match) => `${match}\n${releaseSigningBlock}`
  );

  // Force release buildType to use signingConfigs.release (not debug)
  if (/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+[^\n]+/.test(updated)) {
    updated = updated.replace(
      /(release\s*\{[\s\S]*?)signingConfig\s+[^\n]+/,
      `$1signingConfig signingConfigs.release`
    );
  } else if (/release\s*\{/.test(updated)) {
    updated = updated.replace(
      /release\s*\{/,
      `release {\n            signingConfig signingConfigs.release`
    );
  } else {
    throw new Error(
      'withVyazalnyaReleaseSigning: release buildType not found in app/build.gradle'
    );
  }

  return updated;
}

const withVyazalnyaReleaseSigning = (config) => {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = applyReleaseSigning(config.modResults.contents);
    return config;
  });
};

module.exports = withVyazalnyaReleaseSigning;
