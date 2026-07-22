import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { clearCommerceSession } from '@/features/marketplace/commerce/services/commerceSession';
import { setAuthState } from '@/features/auth/store/authStore';
import { captureAppException } from '@/lib/sentry';

let observedUserId: string | null = null;
let transitionRevision = 0;
let transitionQueue: Promise<void> = Promise.resolve();
let blockedLoggedOutUserId: string | null = null;
let pendingCleanupCount = 0;

function nextAuthState(session: Session | null) {
  return {
    session,
    status: session ? 'authenticated' as const : 'unauthenticated' as const,
    initializationError: null,
  };
}

async function cleanPreviousUserState(): Promise<void> {
  try {
    await clearCommerceSession();
  } catch (error) {
    captureAppException(error, {
      area: 'auth',
      action: 'user_session_cleanup_failed',
      tags: { feature: 'auth', coordinator: 'application-session' },
    });
  }
}

export function applySessionTransition(
  event: AuthChangeEvent | string,
  session: Session | null,
): Promise<void> {
  const nextUserId = session?.user.id ?? null;

  if (
    blockedLoggedOutUserId !== null
    && blockedLoggedOutUserId === nextUserId
    && event !== 'SIGNED_IN'
  ) {
    return transitionQueue;
  }
  if (event === 'SIGNED_IN') {
    blockedLoggedOutUserId = null;
  }

  const previousUserId = observedUserId;
  observedUserId = nextUserId;
  const revision = ++transitionRevision;
  const requiresCleanup = previousUserId !== null && previousUserId !== nextUserId;

  if (!requiresCleanup) {
    if (pendingCleanupCount > 0 && nextUserId !== null) {
      setAuthState({ session: null, status: 'initializing', initializationError: null });
      transitionQueue = transitionQueue.then(() => {
        if (revision === transitionRevision) {
          setAuthState(nextAuthState(session));
        }
      });
      return transitionQueue;
    }
    setAuthState(nextAuthState(session));
    return transitionQueue;
  }

  setAuthState({
    session: null,
    status: nextUserId ? 'initializing' : 'unauthenticated',
    initializationError: null,
  });

  pendingCleanupCount += 1;
  transitionQueue = transitionQueue
    .then(cleanPreviousUserState)
    .then(() => {
      if (revision === transitionRevision) {
        setAuthState(nextAuthState(session));
      }
    })
    .finally(() => {
      pendingCleanupCount -= 1;
    });

  return transitionQueue;
}

export function markUserLoggedOut(userId: string | null) {
  blockedLoggedOutUserId = userId;
}

export function resetSessionCoordinatorForTests(userId: string | null = null) {
  observedUserId = userId;
  transitionRevision = 0;
  transitionQueue = Promise.resolve();
  blockedLoggedOutUserId = null;
  pendingCleanupCount = 0;
}
