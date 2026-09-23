const { withGradleProperties } = require('expo/config-plugins');

const ANDROID_SIZE_PROPERTIES = {
  // Physical Android devices only. Keeping both ARM ABIs preserves support for
  // older 32-bit phones while excluding x86/x86_64 emulator binaries from the
  // installable APK.
  reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',

  // Compress native .so libraries inside the universal APK.
  'expo.useLegacyPackaging': 'true',

  // Compress the JavaScript bundle in release builds.
  'android.enableBundleCompression': 'true',

  // R8 removes unreachable Java/Kotlin bytecode and shrinkResources removes
  // Android resources that are provably unused. These do not change the COT
  // feature surface or business rules.
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

function upsertProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item && item.type === 'property' && item.key === key,
  );

  if (existing) {
    existing.value = value;
    return;
  }

  properties.push({ type: 'property', key, value });
}

module.exports = function withAndroidSizeOptimizations(config) {
  return withGradleProperties(config, (gradleConfig) => {
    for (const [key, value] of Object.entries(ANDROID_SIZE_PROPERTIES)) {
      upsertProperty(gradleConfig.modResults, key, value);
    }
    return gradleConfig;
  });
};
