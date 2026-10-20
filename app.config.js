const DEVELOPMENT_PACKAGE = 'com.bookconnect.library.dev';

// EAS profile wins over public runtime environment flags.
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_APP_ENV || 'development';
  let packageName = DEVELOPMENT_PACKAGE;
  if (profile !== 'development') {
    if (!['preview', 'production'].includes(profile)) {
      throw new Error(`Unsupported build profile: ${profile}`);
    }
    packageName = process.env.BOOKCONNECT_ANDROID_RELEASE_PACKAGE;
    if (!packageName || !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName) || packageName === DEVELOPMENT_PACKAGE) {
      throw new Error('Preview/production require an approved BOOKCONNECT_ANDROID_RELEASE_PACKAGE distinct from the development ID.');
    }
  }
  return { ...config, android: { ...config.android, package: packageName } };
};
