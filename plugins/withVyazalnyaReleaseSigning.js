/**
 * Expo config plugin: wire Android RELEASE signing from env vars or an
 * external keystore.properties file that lives OUTSIDE the repository.
 *
 * Credential resolution order:
 *   1. VYAZALNYA_* environment variables (if present)
 *   2. D:\PetProject\secure\knitCounter\keystore.properties
 *   3. otherwise FAIL clearly
 *
 * Release must NEVER fall back to debug.keystore.
 * Do not copy keystore / properties contents into the repo or generated
 * tracked sources — only reference the external path at build time.
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

const SIGNING_MARKER = '// [vyazalnya-release-signing]';

/** Non-secret default production keystore path (Windows). */
const DEFAULT_STORE_FILE =
  'D:\\\\PetProject\\\\secure\\\\knitCounter\\\\vyazalnya-release.jks';

/** Non-secret default key alias. */
const DEFAULT_ALIAS = 'vyazalnya';

/**
 * Absolute path to the local credentials file outside the repository.
 * Only the path is embedded in generated Gradle — never the file contents.
 */
const EXTERNAL_KEYSTORE_PROPERTIES =
  'D:\\\\PetProject\\\\secure\\\\knitCounter\\\\keystore.properties';

/**
 * Injects a release signingConfig that resolves credentials from env first,
 * then from the external keystore.properties file.
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
            // Resolve production signing without debug.keystore fallback.
            // 1) VYAZALNYA_* env vars  2) external keystore.properties  3) fail
            def externalPropsFile = file("${EXTERNAL_KEYSTORE_PROPERTIES}")
            def externalProps = new Properties()
            if (externalPropsFile.exists()) {
                externalPropsFile.withInputStream { stream ->
                    externalProps.load(stream)
                }
            }

            def envOrProp = { String envName, String propName ->
                def fromEnv = System.getenv(envName)
                if (fromEnv != null && !fromEnv.trim().isEmpty()) {
                    return fromEnv.trim()
                }
                def fromProp = externalProps.getProperty(propName)
                if (fromProp != null && !fromProp.trim().isEmpty()) {
                    return fromProp.trim()
                }
                return null
            }

            def storePath = envOrProp("VYAZALNYA_STORE_FILE", "storeFile")
            if (storePath == null) {
                storePath = "${DEFAULT_STORE_FILE}"
            }

            def aliasName = envOrProp("VYAZALNYA_KEY_ALIAS", "keyAlias")
            if (aliasName == null) {
                aliasName = "${DEFAULT_ALIAS}"
            }

            def storePass = envOrProp("VYAZALNYA_STORE_PASSWORD", "storePassword")
            def keyPass = envOrProp("VYAZALNYA_KEY_PASSWORD", "keyPassword")
            if (keyPass == null) {
                keyPass = storePass
            }

            if (storePass == null) {
                throw new GradleException(
                    "Release signing credentials missing. Set VYAZALNYA_STORE_PASSWORD " +
                    "(and optional VYAZALNYA_KEY_PASSWORD) or create " +
                    "${EXTERNAL_KEYSTORE_PROPERTIES} with storePassword/keyPassword. " +
                    "Release must not use debug.keystore."
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
module.exports.applyReleaseSigning = applyReleaseSigning;
