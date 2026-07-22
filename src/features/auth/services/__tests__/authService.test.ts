/**
 * Unit tests for authService.ts
 *
 * Tests: signInWithOtp, verifyOtp, signOut, getSession,
 * and error propagation for each method.
 */
import { authService } from '../authService';
import { logoutCurrentDevice } from '@/application/auth/logout';

// Activate co-located mock (src/lib/__mocks__/supabase.ts)
jest.mock('@/lib/supabase');
jest.mock('@/application/auth/logout', () => ({
  logoutCurrentDevice: jest.fn(() => Promise.resolve()),
}));

// Import AFTER jest.mock so we get the mocked version
import { supabase } from '@/lib/supabase';

const mockAuth = supabase.auth;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authService', () => {
  describe('signInWithOtp', () => {
    it('calls supabase.auth.signInWithOtp with +91 prefix and sms channel', async () => {
      await authService.signInWithOtp('9876543210');

      expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'sms' },
      });
    });

    it('returns data on success', async () => {
      const mockData = { messageId: 'msg-123' };
      (mockAuth.signInWithOtp as jest.Mock).mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await authService.signInWithOtp('9876543210');
      expect(result).toEqual(mockData);
    });

    it('throws when supabase returns an error', async () => {
      const authError = { message: 'Rate limit exceeded', status: 429 };
      (mockAuth.signInWithOtp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: authError,
      });

      await expect(authService.signInWithOtp('9876543210')).rejects.toEqual(authError);
    });
  });

  describe('verifyOtp', () => {
    it('calls supabase.auth.verifyOtp with +91 prefix and sms type', async () => {
      await authService.verifyOtp('9876543210', '123456');

      expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        token: '123456',
        type: 'sms',
      });
    });

    it('returns session data on success', async () => {
      const sessionData = {
        session: { access_token: 'tok', user: { id: 'u1' } },
        user: { id: 'u1' },
      };
      (mockAuth.verifyOtp as jest.Mock).mockResolvedValueOnce({
        data: sessionData,
        error: null,
      });

      const result = await authService.verifyOtp('9876543210', '123456');
      expect(result).toEqual(sessionData);
    });

    it('throws when supabase returns an error', async () => {
      const authError = { message: 'Invalid OTP' };
      (mockAuth.verifyOtp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: authError,
      });

      await expect(authService.verifyOtp('9876543210', '000000')).rejects.toEqual(authError);
    });
  });

  describe('signOut', () => {
    it('delegates to the authoritative current-device logout path', async () => {
      await authService.signOut();
      expect(logoutCurrentDevice).toHaveBeenCalled();
    });

    it('propagates an unexpected logout-controller failure', async () => {
      const authError = new Error('Local cleanup failed');
      (logoutCurrentDevice as jest.Mock).mockRejectedValueOnce(authError);

      await expect(authService.signOut()).rejects.toEqual(authError);
    });
  });

  describe('getSession', () => {
    it('extracts session from nested response', async () => {
      const mockSession = { access_token: 'tok', user: { id: 'u1' } };
      (mockAuth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const result = await authService.getSession();
      expect(result).toEqual(mockSession);
    });

    it('returns null when no active session', async () => {
      (mockAuth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const result = await authService.getSession();
      expect(result).toBeNull();
    });

    it('throws when supabase returns an error', async () => {
      const authError = { message: 'Session expired' };
      (mockAuth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: authError,
      });

      await expect(authService.getSession()).rejects.toEqual(authError);
    });
  });
});

