import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { mmkvSupabaseStorage } from './mmkv';
import { authRuntimeConfiguration } from '@/features/auth/config/authRuntimeConfig';

const { supabaseUrl, supabaseAnonKey, bypass } = authRuntimeConfiguration;

// In UI-only dev bypass mode we still want the app to render on web even if
// Expo did not inline public env vars into a static export.
const resolvedSupabaseUrl = supabaseUrl ?? 'https://dev-bypass-placeholder.supabase.co';
const resolvedSupabaseAnonKey = supabaseAnonKey ?? 'dev-bypass-anon-key';

if ((!supabaseUrl || !supabaseAnonKey) && !bypass.enabled) {
    throw new Error('Supabase configuration invariant failed.');
}
const localAuthLock = async <T,>(
    _name: string,
    _acquireTimeout: number,
    fn: () => Promise<T>
): Promise<T> => fn();

export const supabase = createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
    auth: {
        storage: mmkvSupabaseStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: localAuthLock,
    },
});
