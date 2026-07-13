/**
 * Mock for src/lib/supabase.ts
 *
 * Co-located mock (Jest auto-picks this up for `@/lib/supabase` imports).
 * Provides a fully mocked Supabase client with jest.fn() for all methods
 * used in the codebase: auth (signInWithOtp, signInWithPassword, verifyOtp, signOut, getSession,
 * onAuthStateChange), and database queries (from, select, insert, update, delete, upsert).
 */

const mockAuth = {
  signInWithOtp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  signInWithPassword: jest.fn(() =>
    Promise.resolve({
      data: {
        session: { access_token: 'test-token', user: { id: 'test-user-id', email: 'clubs-admin-seed@booktalks.test' } },
        user: { id: 'test-user-id', email: 'clubs-admin-seed@booktalks.test' },
      },
      error: null,
    })
  ),
  verifyOtp: jest.fn(() =>
    Promise.resolve({
      data: {
        session: { access_token: 'test-token', user: { id: 'test-user-id', phone: '+911234567890' } },
        user: { id: 'test-user-id', phone: '+911234567890' },
      },
      error: null,
    })
  ),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  getUser: jest.fn(() =>
    Promise.resolve({
      data: { user: { id: 'test-user-id', email: 'clubs-admin-seed@booktalks.test' } },
      error: null,
    })
  ),
  getSession: jest.fn(() =>
    Promise.resolve({
      data: { session: null },
      error: null,
    })
  ),
  onAuthStateChange: jest.fn((_callback: any) => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
};

// Chainable query builder mock
const createQueryBuilder = () => {
  const builder: any = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    like: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    in: jest.fn(() => builder),
    is: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => builder),
    single: jest.fn(() => builder),
    maybeSingle: jest.fn(() => builder),
    match: jest.fn(() => builder),
    or: jest.fn(() => builder),
    filter: jest.fn(() => builder),
    then: jest.fn((resolve: any) => resolve({ data: [], error: null })),
  };
  return builder;
};

const storageBuckets: Record<string, any> = {};

const getStorageBucket = (bucket: string) => {
  if (!storageBuckets[bucket]) {
    storageBuckets[bucket] = {
      upload: jest.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.test/test-path' } })),
    };
  }
  return storageBuckets[bucket];
};

export const supabase = {
  auth: mockAuth,
  from: jest.fn((_table: string) => createQueryBuilder()),
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  functions: {
    invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
  storage: {
    from: jest.fn((bucket: string) => getStorageBucket(bucket)),
  },
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  })),
};

