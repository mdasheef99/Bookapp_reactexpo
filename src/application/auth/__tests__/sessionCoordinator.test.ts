jest.mock('@/features/marketplace/commerce/services/commerceSession', () => ({
  clearCommerceSession: jest.fn(() => Promise.resolve()),
}));

import { clearCommerceSession } from '@/features/marketplace/commerce/services/commerceSession';
import { resetAuthStoreForTests, setAuthState, useAuthStore } from '@/features/auth/store/authStore';
import {
  applySessionTransition,
  resetSessionCoordinatorForTests,
  retryBlockedSessionTransition,
} from '../sessionCoordinator';

const makeSession = (userId: string, token = `${userId}-token`) => ({
  access_token: token,
  user: { id: userId },
}) as never;

describe('application session coordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStoreForTests();
    resetSessionCoordinatorForTests();
  });

  it('does not clean up a fresh unauthenticated INITIAL_SESSION', async () => {
    await applySessionTransition('INITIAL_SESSION', null);
    expect(clearCommerceSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it.each(['TOKEN_REFRESHED', 'USER_UPDATED']) (
    'does not clear user state for same-user %s',
    async (event) => {
      setAuthState({ session: makeSession('user-1'), status: 'authenticated', initializationError: null });
      resetSessionCoordinatorForTests('user-1');

      await applySessionTransition(event, makeSession('user-1', 'new-token'));

      expect(clearCommerceSession).not.toHaveBeenCalled();
      expect(useAuthStore.getState().session?.access_token).toBe('new-token');
    },
  );

  it('clears state when an authenticated user becomes unauthenticated', async () => {
    setAuthState({ session: makeSession('user-1'), status: 'authenticated', initializationError: null });
    resetSessionCoordinatorForTests('user-1');

    await applySessionTransition('SIGNED_OUT', null);

    expect(clearCommerceSession).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('blocks User B until User A cleanup finishes', async () => {
    let finishCleanup: (() => void) | undefined;
    (clearCommerceSession as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishCleanup = resolve;
    }));
    setAuthState({ session: makeSession('user-a'), status: 'authenticated', initializationError: null });
    resetSessionCoordinatorForTests('user-a');

    const transition = applySessionTransition('SIGNED_IN', makeSession('user-b'));
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('initializing');

    await Promise.resolve();
    await Promise.resolve();
    finishCleanup?.();
    await transition;
    expect(useAuthStore.getState().session?.user.id).toBe('user-b');
  });

  it('keeps a later sign-in behind an in-flight sign-out cleanup barrier', async () => {
    let finishCleanup: (() => void) | undefined;
    (clearCommerceSession as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishCleanup = resolve;
    }));
    setAuthState({ session: makeSession('user-a'), status: 'authenticated', initializationError: null });
    resetSessionCoordinatorForTests('user-a');

    const signedOut = applySessionTransition('SIGNED_OUT', null);
    const signedIn = applySessionTransition('SIGNED_IN', makeSession('user-b'));
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('initializing');

    await Promise.resolve();
    await Promise.resolve();
    finishCleanup?.();
    await Promise.all([signedOut, signedIn]);
    expect(useAuthStore.getState().session?.user.id).toBe('user-b');
  });

  it('continues privacy cleanup when an individual cleanup operation fails', async () => {
    (clearCommerceSession as jest.Mock).mockRejectedValueOnce(new Error('cleanup failed'));
    setAuthState({ session: makeSession('user-1'), status: 'authenticated', initializationError: null });
    resetSessionCoordinatorForTests('user-1');

    await expect(applySessionTransition('SIGNED_OUT', null)).resolves.toBeUndefined();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('keeps User B hidden after cleanup failure and exposes B only after a successful retry', async () => {
    (clearCommerceSession as jest.Mock)
      .mockRejectedValueOnce(new Error('cleanup failed'))
      .mockResolvedValueOnce(undefined);
    setAuthState({ session: makeSession('user-a'), status: 'authenticated', initializationError: null });
    resetSessionCoordinatorForTests('user-a');

    await expect(applySessionTransition('SIGNED_IN', makeSession('user-b')))
      .rejects.toThrow('cleanup failed');

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('session-cleanup-error');

    await expect(retryBlockedSessionTransition())
      .resolves.toBeUndefined();
    expect(clearCommerceSession).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().session?.user.id).toBe('user-b');
  });
});
