import { supabase } from '@/lib/supabase';
import { captureAppException } from '@/lib/sentry';
import { useAuthStore } from '@/features/auth/store/authStore';
import { setAuthState } from '@/features/auth/store/authStore';
import {
  clearPendingLogoutIntent,
  clearPersistedSupabaseSession,
  markPendingLogoutIntent,
} from '@/features/auth/services/authStorage';
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
  try {
    await markPendingLogoutIntent();
  } catch (error) {
    reportLogoutFailure(error, 'current_device_logout_intent_failed');
    throw new Error('Unable to begin current-device session removal.');
  }

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
      await clearPendingLogoutIntent();
    } catch (storageError) {
      reportLogoutFailure(storageError, 'current_device_session_removal_failed');
      persistenceRemovalFailed = true;
    }
  } else {
    try {
      await clearPendingLogoutIntent();
    } catch (storageError) {
      reportLogoutFailure(storageError, 'current_device_logout_marker_removal_failed');
      persistenceRemovalFailed = true;
    }
  }

  await cleanup;
  if (persistenceRemovalFailed) {
    setAuthState({
      session: null,
      status: 'logout-error',
      initializationError: {
        message: 'Sign out is incomplete. Please try again.',
      },
    });
    throw new Error('Unable to complete current-device session removal.');
  }
}

async function retryPersistedSessionRemoval(): Promise<void> {
  try {
    await clearPersistedSupabaseSession();
    await clearPendingLogoutIntent();
    await applySessionTransition('SIGNED_OUT', null);
  } catch (error) {
    reportLogoutFailure(error, 'current_device_session_removal_retry_failed');
    setAuthState({
      session: null,
      status: 'logout-error',
      initializationError: {
        message: 'Sign out is incomplete. Please try again.',
      },
    });
    throw new Error('Unable to complete current-device session removal.');
  }
}

export function logoutCurrentDevice(): Promise<void> {
  const state = useAuthStore.getState();
  if (logoutPromise) return logoutPromise;

  if (state.status === 'logout-error') {
    logoutPromise = retryPersistedSessionRemoval().finally(() => {
      logoutPromise = null;
    });
    return logoutPromise;
  }
  if (!state.session && state.status === 'unauthenticated') {
    return Promise.resolve();
  }

  logoutPromise = performLogout().finally(() => {
    logoutPromise = null;
  });
  return logoutPromise;
}

export function resetLogoutForTests() {
  logoutPromise = null;
}
