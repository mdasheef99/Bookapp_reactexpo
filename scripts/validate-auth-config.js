const {
  evaluateAuthBypass,
  AuthConfigurationError,
} = require('../src/features/auth/config/authBypassPolicy');

function validateAuthConfig(env = process.env) {
  const appEnvironment = env.EXPO_PUBLIC_APP_ENV ?? '';
  const bypassRequested = env.EXPO_PUBLIC_DEV_SKIP_AUTH === 'true';

  evaluateAuthBypass({
    isDevelopmentRuntime: appEnvironment === 'development',
    appEnvironment,
    bypassRequested,
  });

  if (
    appEnvironment === 'production'
    && (!env.EXPO_PUBLIC_SUPABASE_URL?.trim() || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim())
  ) {
    throw new AuthConfigurationError(
      'Production requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
}

if (require.main === module) {
  try {
    validateAuthConfig();
    console.log('Auth configuration validation passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Auth configuration validation failed.');
    process.exitCode = 1;
  }
}

module.exports = { validateAuthConfig };
