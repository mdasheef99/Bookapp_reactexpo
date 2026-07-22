export interface AuthBypassInput {
  isDevelopmentRuntime: boolean;
  appEnvironment: 'development' | 'preview' | 'production' | string;
  bypassRequested: boolean;
}

export interface AuthRuntimeConfigurationInput extends AuthBypassInput {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
}

export type AuthBypassResult =
  | { enabled: true; reason: 'development-opt-in' }
  | { enabled: false; reason: 'not-requested' };

export class AuthConfigurationError extends Error {}

export function evaluateAuthBypass(input: AuthBypassInput): AuthBypassResult;

export function resolveAuthRuntimeConfiguration(
  input: AuthRuntimeConfigurationInput,
): {
  bypass: AuthBypassResult;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
};
