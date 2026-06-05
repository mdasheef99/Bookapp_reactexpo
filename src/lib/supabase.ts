import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { mmkvSupabaseStorage } from './mmkv';

const isDevAuthBypass = process.env.EXPO_PUBLIC_DEV_SKIP_AUTH === 'true';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if ((!supabaseUrl || !supabaseAnonKey) && !isDevAuthBypass) {
    throw new Error(
        'Missing Supabase environment variables. ' +
        'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env'
    );
}

// In UI-only dev bypass mode we still want the app to render on web even if
// Expo did not inline public env vars into a static export.
const resolvedSupabaseUrl = supabaseUrl ?? 'https://dev-bypass-placeholder.supabase.co';
const resolvedSupabaseAnonKey = supabaseAnonKey ?? 'dev-bypass-anon-key';
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
