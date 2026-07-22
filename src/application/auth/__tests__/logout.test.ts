jest.mock('@/lib/supabase');
jest.mock('@/features/marketplace/commerce/services/commerceSession', () => ({
  clearCommerceSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/auth/services/authStorage', () => ({
  clearPersistedSupabaseSession: jest.fn(() => Promise.resolve()),
  supabaseAuthStorageKey: 'sb-test-auth-token',
}));

import { supabase } from '@/lib/supabase';
import { clearCommerceSession } from '@/features/marketplace/commerce/services/commerceSession';
import { clearPersistedSupabaseSession } from '@/features/auth/services/authStorage';
import { resetAuthStoreForTests, setAuthState, useAuthStore } from '@/features/auth/store/authStore';
import { logoutCurrentDevice, resetLogoutForTests } from '../logout';
import { applySessionTransition, resetSessionCoordinatorForTests } from '../sessionCoordinator';

const session = { access_token: 'test-token', user: { id: 'user-1' } } as never;

describe('current-device logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStoreForTests();
    resetSessionCoordinatorForTests('user-1');
    resetLogoutForTests();
    setAuthState({ session, status: 'authenticated', initializationError: null });
  });

  it('uses local scope and completes application cleanup on success', async () => {
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

    await logoutCurrentDevice();

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearCommerceSession).toHaveBeenCalled();
    expect(clearPersistedSupabaseSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it.each([
    ['returned', () => Promise.resolve({ error: new Error('remote failed') })],
    ['thrown', () => Promise.reject(new Error('network failed'))],
  ])('removes only the persisted local session after a %s SDK failure', async (_kind, result) => {
    (supabase.auth.signOut as jest.Mock).mockImplementation(result);

    await expect(logoutCurrentDevice()).resolves.toBeUndefined();

    expect(clearPersistedSupabaseSession).toHaveBeenCalledTimes(1);
    expect(clearCommerceSession).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('deduplicates concurrent and repeated logout calls', async () => {
    let finish: ((value: unknown) => void) | undefined;
    (supabase.auth.signOut as jest.Mock).mockImplementation(() => new Promise((resolve) => {
      finish = resolve;
    }));

    const first = logoutCurrentDevice();
    const second = logoutCurrentDevice();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    finish?.({ error: null });
    await Promise.all([first, second]);
    await logoutCurrentDevice();

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('does not restore a failed-logout session from a later refresh event', async () => {
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: new Error('offline') });
    await logoutCurrentDevice();

    await applySessionTransition('TOKEN_REFRESHED', session);
    expect(useAuthStore.getState().session).toBeNull();

    await applySessionTransition('SIGNED_IN', session);
    expect(useAuthStore.getState().session?.user.id).toBe('user-1');
  });

  it('does not report logout success when persisted-session removal also fails', async () => {
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: new Error('offline') });
    (clearPersistedSupabaseSession as jest.Mock).mockRejectedValueOnce(new Error('storage failed'));

    await expect(logoutCurrentDevice()).rejects.toThrow(
      'Unable to complete current-device session removal.',
    );
    expect(clearCommerceSession).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });
});
