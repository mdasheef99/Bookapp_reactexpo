describe('supabase client configuration', () => {
    const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    beforeEach(() => {
        jest.resetModules();
        process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    });

    afterEach(() => {
        process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    });

    it('uses a process-local auth lock so web previews cannot hang on navigator.locks', async () => {
        type SupabaseClientOptions = {
            auth: {
                lock: <T>(name: string, acquireTimeout: number, fn: () => Promise<T>) => Promise<T>;
            };
        };

        const createClient = jest.fn((_url: string, _anonKey: string, _options: SupabaseClientOptions) => ({ auth: {} }));

        jest.doMock('@supabase/supabase-js', () => ({ createClient }));
        jest.doMock('react-native-url-polyfill/auto', () => ({}));
        jest.doMock('../storage', () => ({
            supabaseStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
        }));

        require('../supabase');

        const options = createClient.mock.calls[0]?.[2];
        expect(options).toBeDefined();
        if (!options) throw new Error('Expected Supabase client options to be provided.');

        expect(options.auth.lock).toEqual(expect.any(Function));

        const result = await options.auth.lock('lock:test', 5000, async () => 'completed');

        expect(result).toBe('completed');
    });
});
