jest.mock('@/lib/storage', () => ({
  supabaseStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { supabaseStorage } from '@/lib/storage';
import {
  clearPersistedSupabaseSession,
  clearPendingLogoutIntent,
  deriveSupabaseAuthStorageKey,
  hasPendingLogoutIntent,
  markPendingLogoutIntent,
  supabaseAuthStorageKey,
} from '../authStorage';

describe('Supabase auth storage fallback', () => {
  it('derives the SDK-compatible project-specific key', () => {
    expect(deriveSupabaseAuthStorageKey('https://project-ref.supabase.co'))
      .toBe('sb-project-ref-auth-token');
  });

  it('removes only the configured Supabase auth key', async () => {
    await clearPersistedSupabaseSession();
    expect(supabaseStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(supabaseStorage.removeItem).toHaveBeenCalledWith(expect.stringMatching(/^sb-.+-auth-token$/));
    expect(supabaseAuthStorageKey).toBe('sb-test-auth-token');
  });

  it('persists and clears a non-secret pending-logout marker separately from the token', async () => {
    (supabaseStorage.getItem as jest.Mock).mockResolvedValue('1');

    await markPendingLogoutIntent();
    await expect(hasPendingLogoutIntent()).resolves.toBe(true);
    await clearPendingLogoutIntent();

    expect(supabaseStorage.setItem).toHaveBeenCalledWith(
      'sb-test-auth-token-logout-pending',
      '1',
    );
    expect(supabaseStorage.removeItem).toHaveBeenCalledWith(
      'sb-test-auth-token-logout-pending',
    );
  });
});
