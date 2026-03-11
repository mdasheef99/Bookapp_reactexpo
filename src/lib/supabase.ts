import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { mmkvSupabaseStorage } from './mmkv';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. ' +
        'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: mmkvSupabaseStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
