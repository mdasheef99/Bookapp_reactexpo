/**
 * Mock for react-native-mmkv (JSI module — requires native runtime)
 * 
 * Mocks the createMMKV() factory used in src/lib/mmkv.ts
 * Provides an in-memory Map-based implementation for tests.
 */

const createMockMMKV = () => {
  const store = new Map<string, string | number | boolean>();

  return {
    getString: jest.fn((key: string) => store.get(key) as string | undefined),
    getNumber: jest.fn((key: string) => store.get(key) as number | undefined),
    getBoolean: jest.fn((key: string) => store.get(key) as boolean | undefined),
    set: jest.fn((key: string, value: string | number | boolean) => {
      store.set(key, value);
    }),
    delete: jest.fn((key: string) => {
      store.delete(key);
    }),
    remove: jest.fn((key: string) => {
      store.delete(key);
    }),
    contains: jest.fn((key: string) => store.has(key)),
    getAllKeys: jest.fn(() => Array.from(store.keys())),
    clearAll: jest.fn(() => store.clear()),
    // For test inspection
    _store: store,
  };
};

export const createMMKV = jest.fn((_options?: { id?: string }) => createMockMMKV());

