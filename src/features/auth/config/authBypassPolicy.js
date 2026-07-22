class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

function evaluateAuthBypass(input) {
  if (!input.bypassRequested) {
    return { enabled: false, reason: 'not-requested' };
  }

  if (!input.isDevelopmentRuntime) {
    throw new AuthConfigurationError(
      'Auth bypass requires a development runtime.',
    );
  }

  if (input.appEnvironment !== 'development') {
    throw new AuthConfigurationError(
      'Auth bypass is permitted only in the development application environment.',
    );
  }

  return { enabled: true, reason: 'development-opt-in' };
}

function resolveAuthRuntimeConfiguration(input) {
  const bypass = evaluateAuthBypass(input);
  const supabaseUrl = input.supabaseUrl?.trim();
  const supabaseAnonKey = input.supabaseAnonKey?.trim();

  if ((!supabaseUrl || !supabaseAnonKey) && !bypass.enabled) {
    throw new AuthConfigurationError(
      'Missing required Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  return {
    bypass,
    supabaseUrl: supabaseUrl || null,
    supabaseAnonKey: supabaseAnonKey || null,
  };
}

module.exports = {
  AuthConfigurationError,
  evaluateAuthBypass,
  resolveAuthRuntimeConfiguration,
};
