jest.mock('@/lib/mmkv', () => ({
  mmkvSupabaseStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { mmkvSupabaseStorage } from '@/lib/mmkv';
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
    expect(mmkvSupabaseStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(mmkvSupabaseStorage.removeItem).toHaveBeenCalledWith(expect.stringMatching(/^sb-.+-auth-token$/));
    expect(supabaseAuthStorageKey).toBe('sb-test-auth-token');
  });

  it('persists and clears a non-secret pending-logout marker separately from the token', async () => {
    (mmkvSupabaseStorage.getItem as jest.Mock).mockReturnValue('1');

    await markPendingLogoutIntent();
    expect(hasPendingLogoutIntent()).toBe(true);
    await clearPendingLogoutIntent();

    expect(mmkvSupabaseStorage.setItem).toHaveBeenCalledWith(
      'sb-test-auth-token-logout-pending',
      '1',
    );
    expect(mmkvSupabaseStorage.removeItem).toHaveBeenCalledWith(
      'sb-test-auth-token-logout-pending',
    );
  });
});
