import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Supabase-compatible persistent storage for Expo Go.
 *
 * AsyncStorage is included in the Expo Go runtime. Native-only stores such as
 * react-native-mmkv require a rebuilt development client and cannot be loaded
 * by the stock Expo Go binary.
 */
export const supabaseStorage = {
  getItem: (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  setItem: (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
  removeItem: (key: string): Promise<void> => AsyncStorage.removeItem(key),
};
