const { validateAuthConfig } = require('../validate-auth-config');

describe('auth build configuration validation', () => {
  it.each(['preview', 'production'])('rejects bypass in %s', (appEnvironment) => {
    expect(() => validateAuthConfig({
      EXPO_PUBLIC_APP_ENV: appEnvironment,
      EXPO_PUBLIC_DEV_SKIP_AUTH: 'true',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
    })).toThrow('Auth bypass');
  });

  it('rejects missing production Supabase configuration', () => {
    expect(() => validateAuthConfig({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_DEV_SKIP_AUTH: 'false',
    })).toThrow('Production requires');
  });

  it('accepts a configured production build without bypass', () => {
    expect(() => validateAuthConfig({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_DEV_SKIP_AUTH: 'false',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
    })).not.toThrow();
  });
});
