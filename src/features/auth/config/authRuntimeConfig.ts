import { resolveAuthRuntimeConfiguration } from './authBypassPolicy';

const isDevelopmentRuntime = typeof __DEV__ !== 'undefined' && __DEV__ === true;

export const authRuntimeConfiguration = resolveAuthRuntimeConfiguration({
  isDevelopmentRuntime,
  appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? '',
  bypassRequested: process.env.EXPO_PUBLIC_DEV_SKIP_AUTH === 'true',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

export const isAuthBypassEnabled = authRuntimeConfiguration.bypass.enabled;
