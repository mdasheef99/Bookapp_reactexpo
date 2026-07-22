import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { clearCommerceSession } from '@/features/marketplace/commerce/services/commerceSession';
import { setAuthState } from '@/features/auth/store/authStore';
import { captureAppException } from '@/lib/sentry';

let observedUserId: string | null = null;
let transitionRevision = 0;
let transitionQueue: Promise<void> = Promise.resolve();
let blockedLoggedOutUserId: string | null = null;
let pendingTransitionCount = 0;
let blockedTransition: { event: AuthChangeEvent | string; session: Session } | null = null;

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
    throw error;
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

  const revision = ++transitionRevision;
  const requiresCleanup = observedUserId !== null && observedUserId !== nextUserId;

  if (!requiresCleanup && pendingTransitionCount === 0) {
    observedUserId = nextUserId;
    blockedTransition = null;
    setAuthState(nextAuthState(session));
    return transitionQueue;
  }

  setAuthState({
    session: null,
    status: nextUserId ? 'initializing' : 'unauthenticated',
    initializationError: null,
  });

  pendingTransitionCount += 1;
  const transition = transitionQueue
    .catch(() => undefined)
    .then(async () => {
      const previousUserId = observedUserId;
      if (previousUserId !== null && previousUserId !== nextUserId) {
        await cleanPreviousUserState();
      }
      observedUserId = nextUserId;
      if (revision === transitionRevision) {
        blockedTransition = null;
        setAuthState(nextAuthState(session));
      }
    })
    .catch((error) => {
      if (revision === transitionRevision) {
        blockedTransition = nextUserId && session ? { event, session } : null;
        setAuthState({
          session: null,
          status: nextUserId ? 'session-cleanup-error' : 'unauthenticated',
          initializationError: nextUserId
            ? { message: 'Unable to safely switch accounts. Please try again.' }
            : null,
        });
      }
      throw error;
    })
    .finally(() => {
      pendingTransitionCount -= 1;
    });
  transitionQueue = transition;

  return nextUserId === null ? transition.catch(() => undefined) : transition;
}

export function retryBlockedSessionTransition(): Promise<void> {
  if (!blockedTransition) return Promise.resolve();
  const { event, session } = blockedTransition;
  return applySessionTransition(event, session);
}

export function markUserLoggedOut(userId: string | null) {
  blockedLoggedOutUserId = userId;
}

export function resetSessionCoordinatorForTests(userId: string | null = null) {
  observedUserId = userId;
  transitionRevision = 0;
  transitionQueue = Promise.resolve();
  blockedLoggedOutUserId = null;
  pendingTransitionCount = 0;
  blockedTransition = null;
}
