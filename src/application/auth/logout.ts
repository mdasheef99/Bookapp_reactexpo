import { supabase } from '@/lib/supabase';
import { captureAppException } from '@/lib/sentry';
import { useAuthStore } from '@/features/auth/store/authStore';
import { clearPersistedSupabaseSession } from '@/features/auth/services/authStorage';
import { applySessionTransition, markUserLoggedOut } from './sessionCoordinator';

let logoutPromise: Promise<void> | null = null;

function reportLogoutFailure(_error: unknown, action: string) {
  captureAppException(new Error('Current-device logout operation failed.'), {
    area: 'auth',
    action,
    tags: { feature: 'auth', scope: 'current-device' },
  });
}

async function performLogout(): Promise<void> {
  const userId = useAuthStore.getState().session?.user.id ?? null;
  markUserLoggedOut(userId);
  const cleanup = applySessionTransition('SIGNED_OUT', null);
  let remoteError: unknown = null;
  let persistenceRemovalFailed = false;

  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    remoteError = error;
  } catch (error) {
    remoteError = error;
  }

  if (remoteError) {
    reportLogoutFailure(remoteError, 'current_device_remote_sign_out_failed');
    try {
      await clearPersistedSupabaseSession();
    } catch (storageError) {
      reportLogoutFailure(storageError, 'current_device_session_removal_failed');
      persistenceRemovalFailed = true;
    }
  }

  await cleanup;
  if (persistenceRemovalFailed) {
    throw new Error('Unable to complete current-device session removal.');
  }
}

export function logoutCurrentDevice(): Promise<void> {
  const state = useAuthStore.getState();
  if (!state.session && state.status === 'unauthenticated') {
    return Promise.resolve();
  }
  if (logoutPromise) return logoutPromise;

  logoutPromise = performLogout().finally(() => {
    logoutPromise = null;
  });
  return logoutPromise;
}

export function resetLogoutForTests() {
  logoutPromise = null;
}
