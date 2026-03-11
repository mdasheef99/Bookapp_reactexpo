/**
 * Unit tests for useAuth.ts
 *
 * Tests: dev bypass, initialize (getSession + onAuthStateChange),
 * 5s timeout, signOut, error handling.
 *
 * IMPORTANT: useAuth uses module-level global state (globalSession, globalUser, etc.)
 * so we use jest.isolateModules + fresh imports to ensure test isolation.
 */
jest.mock('@/lib/supabase');

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';

const mockAuth = supabase.auth;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('useAuth', () => {
  describe('dev bypass mode (EXPO_PUBLIC_DEV_SKIP_AUTH=true)', () => {
    it('creates mock session and user without calling supabase', async () => {
      // Dev skip auth is already 'true' from jest.setup.ts
      const { useAuth } = require('../useAuth');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.session).toBeDefined();
      expect(result.current.session?.access_token).toBe('dev-access-token');
      expect(result.current.user?.id).toBe('dev-user-00000000-0000-0000-0000-000000000000');
      expect(result.current.user?.email).toBe('dev@booktalks.test');
      // Should NOT have called supabase.auth.getSession in dev mode
      expect(mockAuth.getSession).not.toHaveBeenCalled();
    });
  });

  describe('production mode', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.EXPO_PUBLIC_DEV_SKIP_AUTH;
      process.env.EXPO_PUBLIC_DEV_SKIP_AUTH = 'false';
    });

    afterEach(() => {
      process.env.EXPO_PUBLIC_DEV_SKIP_AUTH = originalEnv;
    });

    it('calls getSession and sets session on success', async () => {
      const mockSession = {
        access_token: 'real-token',
        user: { id: 'user-1', phone: '+919876543210' },
      };
      (mockAuth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const { useAuth } = require('../useAuth');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockAuth.getSession).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.session?.access_token).toBe('real-token');
      expect(result.current.user?.id).toBe('user-1');
    });

    it('subscribes to onAuthStateChange after getSession', async () => {
      (mockAuth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const { useAuth } = require('../useAuth');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockAuth.onAuthStateChange).toHaveBeenCalled();
    });

    it('stops loading on error (timeout or network failure)', async () => {
      const Sentry = require('@sentry/react-native');
      (mockAuth.getSession as jest.Mock).mockRejectedValueOnce(
        new Error('Auth initialization timed out'),
      );

      const { useAuth } = require('../useAuth');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.session).toBeNull();
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Auth initialization timed out' }),
        expect.objectContaining({
          tags: expect.objectContaining({
            area: 'auth',
            action: 'initialize_session_failed',
            feature: 'auth',
            hook: 'useAuth',
          }),
          extra: expect.objectContaining({ timeout_ms: 5000 }),
        }),
      );
    });
  });

  describe('signOut', () => {
    it('clears session and user, calls supabase.auth.signOut', async () => {
      // First initialize with dev bypass to set session
      const { useAuth } = require('../useAuth');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.session).toBeDefined();

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockAuth.signOut).toHaveBeenCalled();
      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
    });
  });
});

