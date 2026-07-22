import {
  AuthConfigurationError,
  evaluateAuthBypass,
  resolveAuthRuntimeConfiguration,
} from '../authBypassPolicy';

describe('auth bypass policy', () => {
  it('enables an explicitly requested development-runtime bypass', () => {
    expect(evaluateAuthBypass({
      isDevelopmentRuntime: true,
      appEnvironment: 'development',
      bypassRequested: true,
    })).toEqual({ enabled: true, reason: 'development-opt-in' });
  });

  it('keeps development runtime protected without opt-in', () => {
    expect(evaluateAuthBypass({
      isDevelopmentRuntime: true,
      appEnvironment: 'development',
      bypassRequested: false,
    })).toEqual({ enabled: false, reason: 'not-requested' });
  });

  it.each([
    { isDevelopmentRuntime: false, appEnvironment: 'development' },
    { isDevelopmentRuntime: false, appEnvironment: 'production' },
    { isDevelopmentRuntime: true, appEnvironment: 'preview' },
    { isDevelopmentRuntime: true, appEnvironment: 'production' },
    { isDevelopmentRuntime: true, appEnvironment: 'unexpected' },
    { isDevelopmentRuntime: true, appEnvironment: '' },
  ])('rejects bypass opt-in for $appEnvironment / development=$isDevelopmentRuntime', (input) => {
    expect(() => evaluateAuthBypass({ ...input, bypassRequested: true }))
      .toThrow(AuthConfigurationError);
  });

  it.each(['preview', 'production', 'unexpected', '']) (
    'fails closed without opt-in in %s',
    (appEnvironment) => {
      expect(evaluateAuthBypass({
        isDevelopmentRuntime: true,
        appEnvironment,
        bypassRequested: false,
      })).toEqual({ enabled: false, reason: 'not-requested' });
    },
  );

  it('rejects missing Supabase configuration in normal runtime', () => {
    expect(() => resolveAuthRuntimeConfiguration({
      isDevelopmentRuntime: true,
      appEnvironment: 'development',
      bypassRequested: false,
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
    })).toThrow('Missing required Supabase configuration');
  });

  it('permits missing Supabase configuration only for an allowed bypass', () => {
    expect(resolveAuthRuntimeConfiguration({
      isDevelopmentRuntime: true,
      appEnvironment: 'development',
      bypassRequested: true,
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
    }).bypass.enabled).toBe(true);
  });
});
