/**
 * Mock for @react-native-async-storage/async-storage
 *
 * Used in: src/hooks/useRecentSearches.ts
 * APIs: AsyncStorage.getItem, AsyncStorage.setItem, AsyncStorage.removeItem
 *
 * Provides an in-memory Map-based implementation for tests.
 */

const store = new Map<string, string>();

const AsyncStorage = {
  getItem: jest.fn((key: string) => {
    return Promise.resolve(store.get(key) ?? null);
  }),
  setItem: jest.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
  mergeItem: jest.fn((key: string, value: string) => {
    const existing = store.get(key);
    if (existing) {
      const merged = { ...JSON.parse(existing), ...JSON.parse(value) };
      store.set(key, JSON.stringify(merged));
    } else {
      store.set(key, value);
    }
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    store.clear();
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => {
    return Promise.resolve(Array.from(store.keys()));
  }),
  multiGet: jest.fn((keys: string[]) => {
    return Promise.resolve(keys.map((k) => [k, store.get(k) ?? null]));
  }),
  multiSet: jest.fn((pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => store.set(k, v));
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((k) => store.delete(k));
    return Promise.resolve();
  }),
};

export default AsyncStorage;

