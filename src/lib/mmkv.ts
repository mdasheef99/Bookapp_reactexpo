import { createMMKV } from 'react-native-mmkv';

/**
 * MMKV storage instance for the app.
 * Used for high-performance synchronous key-value storage.
 */
export const mmkv = createMMKV({ id: 'booktalks-storage' });

/**
 * Supabase-compatible storage adapter using MMKV.
 * Implements the SupportedStorage interface required by @supabase/supabase-js.
 * MMKV is ~30x faster than AsyncStorage and fully synchronous.
 */
export const mmkvSupabaseStorage = {
    getItem: (key: string): string | null => {
        const value = mmkv.getString(key);
        return value === undefined ? null : value;
    },
    setItem: (key: string, value: string): void => {
        mmkv.set(key, value);
    },
    removeItem: (key: string): void => {
        mmkv.remove(key);
    },
};

