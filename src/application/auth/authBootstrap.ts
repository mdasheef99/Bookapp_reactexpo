import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { captureAppException } from '@/lib/sentry';
import { setAuthState } from '@/features/auth/store/authStore';
import { applySessionTransition } from './sessionCoordinator';

export const AUTH_INITIALIZATION_TIMEOUT_MS = 5_000;

let subscription: Subscription | null = null;
let initializationPromise: Promise<void> | null = null;
let initialized = false;
let authEventVersion = 0;
let lifecycleVersion = 0;

function ensureSubscription() {
  if (subscription) return;
  const { data } = supabase.auth.onAuthStateChange(
    (event: AuthChangeEvent, session: Session | null) => {
      authEventVersion += 1;
      initialized = true;
      void applySessionTransition(event, session);
    },
  );
  subscription = data.subscription;
}

async function restoreSession(timeoutMs: number): Promise<void> {
  ensureSubscription();
  const startingEventVersion = authEventVersion;
  const startingLifecycleVersion = lifecycleVersion;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Auth initialization timed out')),
          timeoutMs,
        );
      }),
    ]);

    if (startingLifecycleVersion !== lifecycleVersion || startingEventVersion !== authEventVersion) {
      return;
    }
    if (result.error) throw result.error;

    await applySessionTransition('INITIAL_SESSION', result.data.session);
    initialized = true;
  } catch (error) {
    if (startingLifecycleVersion !== lifecycleVersion || startingEventVersion !== authEventVersion) {
      return;
    }
    captureAppException(error, {
      area: 'auth',
      action: 'initialize_session_failed',
      tags: { feature: 'auth', hook: 'useAuth' },
      extra: { timeout_ms: timeoutMs },
    });
    setAuthState({
      session: null,
      status: 'initialization-error',
      initializationError: {
        message: 'Unable to restore your session. Please try again.',
      },
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function initializeAuth(options: { timeoutMs?: number } = {}): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initializationPromise) return initializationPromise;

  initializationPromise = restoreSession(options.timeoutMs ?? AUTH_INITIALIZATION_TIMEOUT_MS)
    .finally(() => {
      initializationPromise = null;
    });
  return initializationPromise;
}

export function startAuthBootstrap(options: { timeoutMs?: number } = {}): Promise<void> {
  return initializeAuth(options);
}

export function stopAuthBootstrap() {
  lifecycleVersion += 1;
  subscription?.unsubscribe();
  subscription = null;
  initializationPromise = null;
  initialized = false;
}

export function resetAuthBootstrapForTests() {
  stopAuthBootstrap();
  authEventVersion = 0;
  lifecycleVersion = 0;
}
