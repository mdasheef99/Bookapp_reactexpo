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
const pendingLogoutStorageKey = `${supabaseAuthStorageKey}-logout-pending`;

/** SDK fallback for explicit current-device logout only. */
export async function clearPersistedSupabaseSession(): Promise<void> {
  await Promise.resolve(mmkvSupabaseStorage.removeItem(supabaseAuthStorageKey));
}

/** Non-secret crash/restart guard; token deletion must complete before this marker is cleared. */
export async function markPendingLogoutIntent(): Promise<void> {
  await Promise.resolve(mmkvSupabaseStorage.setItem(pendingLogoutStorageKey, '1'));
}

export function hasPendingLogoutIntent(): boolean {
  return mmkvSupabaseStorage.getItem(pendingLogoutStorageKey) === '1';
}

export async function clearPendingLogoutIntent(): Promise<void> {
  await Promise.resolve(mmkvSupabaseStorage.removeItem(pendingLogoutStorageKey));
}
