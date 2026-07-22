jest.mock('@/lib/mmkv', () => ({
  mmkvSupabaseStorage: { removeItem: jest.fn() },
}));

import { mmkvSupabaseStorage } from '@/lib/mmkv';
import {
  clearPersistedSupabaseSession,
  deriveSupabaseAuthStorageKey,
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
});
