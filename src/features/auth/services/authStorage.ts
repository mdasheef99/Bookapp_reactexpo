import { authRuntimeConfiguration } from '@/features/auth/config/authRuntimeConfig';
import { mmkvSupabaseStorage } from '@/lib/mmkv';

export function deriveSupabaseAuthStorageKey(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  if (!projectRef) {
    throw new Error('Unable to derive the Supabase auth storage key.');
  }
  return `sb-${projectRef}-auth-token`;
}

const storageUrl = authRuntimeConfiguration.supabaseUrl
  ?? 'https://dev-bypass-placeholder.supabase.co';

export const supabaseAuthStorageKey = deriveSupabaseAuthStorageKey(storageUrl);

/** SDK fallback for explicit current-device logout only. */
export async function clearPersistedSupabaseSession(): Promise<void> {
  await Promise.resolve(mmkvSupabaseStorage.removeItem(supabaseAuthStorageKey));
}
