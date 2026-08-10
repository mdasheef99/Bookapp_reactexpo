jest.mock('@/lib/supabase');
jest.mock('@/features/marketplace/commerce/services/commerceSession', () => ({
  clearCommerceSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/auth/services/authStorage', () => ({
  clearPendingLogoutIntent: jest.fn(() => Promise.resolve()),
  clearPersistedSupabaseSession: jest.fn(() => Promise.resolve()),
  hasPendingLogoutIntent: jest.fn(() => Promise.resolve(false)),
}));

import { supabase } from '@/lib/supabase';
import { clearCommerceSession } from '@/features/marketplace/commerce/services/commerceSession';
import {
  clearPendingLogoutIntent,
  clearPersistedSupabaseSession,
  hasPendingLogoutIntent,
} from '@/features/auth/services/authStorage';
import { resetAuthStoreForTests, useAuthStore } from '@/features/auth/store/authStore';
import {
  initializeAuth,
  resetAuthBootstrapForTests,
  startAuthBootstrap,
  stopAuthBootstrap,
} from '../authBootstrap';
import { resetSessionCoordinatorForTests } from '../sessionCoordinator';

const mockAuth = supabase.auth;
const makeSession = (userId: string, token = `${userId}-token`) => ({
  access_token: token,
  user: { id: userId },
}) as never;

async function flushAuthWork(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

describe('root auth bootstrap', () => {
  let callback: ((event: string, session: never) => void) | undefined;
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStoreForTests();
    resetSessionCoordinatorForTests();
    resetAuthBootstrapForTests();
    callback = undefined;
    (mockAuth.onAuthStateChange as jest.Mock).mockImplementation((nextCallback) => {
      callback = nextCallback;
      return { data: { subscription: { unsubscribe } } };
    });
  });

  afterEach(() => {
    stopAuthBootstrap();
    jest.useRealTimers();
  });

  it.each([
    [makeSession('user-1'), 'authenticated'],
    [null, 'unauthenticated'],
  ])('initializes an existing or absent session', async (session, status) => {
    (mockAuth.getSession as jest.Mock).mockResolvedValue({
      data: { session }, error: null,
    });

    await initializeAuth();

    expect(useAuthStore.getState()).toEqual(expect.objectContaining({ session, status }));
    expect(mockAuth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => Promise.resolve({ data: { session: null }, error: new Error('returned failure') }),
    () => Promise.reject(new Error('rejected failure')),
  ])('preserves an initialization error', async (getSessionResult) => {
    (mockAuth.getSession as jest.Mock).mockImplementation(getSessionResult);

    await initializeAuth();

    expect(useAuthStore.getState().status).toBe('initialization-error');
    expect(useAuthStore.getState().initializationError).toEqual({
      message: 'Unable to restore your session. Please try again.',
    });
  });

  it('times out initialization without treating it as a guest session', async () => {
    jest.useFakeTimers();
    (mockAuth.getSession as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const initialization = initializeAuth({ timeoutMs: 25 });
    await jest.advanceTimersByTimeAsync(25);
    await initialization;

    expect(useAuthStore.getState().status).toBe('initialization-error');
  });

  it('does not let an older initialization result overwrite a newer auth event', async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    (mockAuth.getSession as jest.Mock).mockImplementation(() => new Promise((resolve) => {
      resolveSession = resolve;
    }));

    const initialization = initializeAuth();
    await flushAuthWork();
    callback?.('SIGNED_IN', makeSession('new-user'));
    resolveSession?.({ data: { session: null }, error: null });
    await initialization;
    await flushAuthWork();

    expect(useAuthStore.getState().session?.user.id).toBe('new-user');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('handles auth events after initialization and repeated events', async () => {
    (mockAuth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    await initializeAuth();

    callback?.('SIGNED_IN', makeSession('user-1'));
    callback?.('TOKEN_REFRESHED', makeSession('user-1', 'refreshed'));
    await Promise.resolve();

    expect(useAuthStore.getState().session?.access_token).toBe('refreshed');
  });

  it('deduplicates initialization and unsubscribes on bootstrap stop', async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    (mockAuth.getSession as jest.Mock).mockImplementation(() => new Promise((resolve) => {
      resolveSession = resolve;
    }));

    const first = startAuthBootstrap();
    const second = initializeAuth();
    await flushAuthWork();
    expect(mockAuth.getSession).toHaveBeenCalledTimes(1);
    resolveSession?.({ data: { session: null }, error: null });
    await Promise.all([first, second]);

    stopAuthBootstrap();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores a pending initialization result after bootstrap unmount', async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    (mockAuth.getSession as jest.Mock).mockImplementation(() => new Promise((resolve) => {
      resolveSession = resolve;
    }));

    const initialization = startAuthBootstrap();
    await flushAuthWork();
    stopAuthBootstrap();
    resolveSession?.({ data: { session: makeSession('stale-user') }, error: null });
    await initialization;

    expect(useAuthStore.getState().session).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('handles Supabase-driven SIGNED_OUT without recursively calling signOut', async () => {
    (mockAuth.getSession as jest.Mock).mockResolvedValue({
      data: { session: makeSession('user-1') }, error: null,
    });
    await initializeAuth();

    callback?.('SIGNED_OUT', null as never);
    await flushAuthWork();

    expect(clearCommerceSession).toHaveBeenCalled();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('does not restore a persisted session after a pending logout survives restart', async () => {
    (hasPendingLogoutIntent as jest.Mock).mockResolvedValue(true);
    (mockAuth.getSession as jest.Mock).mockResolvedValue({
      data: { session: makeSession('logged-out-user') }, error: null,
    });

    await initializeAuth();

    expect(clearPersistedSupabaseSession).toHaveBeenCalledTimes(1);
    expect(clearPendingLogoutIntent).toHaveBeenCalledTimes(1);
    expect(mockAuth.getSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('keeps restart blocked when pending logout deletion still fails', async () => {
    (hasPendingLogoutIntent as jest.Mock).mockResolvedValue(true);
    (clearPersistedSupabaseSession as jest.Mock).mockRejectedValueOnce(new Error('storage failed'));

    await initializeAuth();

    expect(clearPendingLogoutIntent).not.toHaveBeenCalled();
    expect(mockAuth.getSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('logout-error');
  });
});
