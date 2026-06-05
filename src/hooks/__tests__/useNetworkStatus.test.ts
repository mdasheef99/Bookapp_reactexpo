/**
 * Unit tests for useNetworkStatus.ts
 *
 * Tests: default state, native platform graceful fallback (dynamic import
 * fails in Jest), web platform branch (navigator.onLine), cleanup on unmount.
 *
 * NOTE: jest-expo defaults to Platform.OS = 'ios', so the native branch
 * runs by default. Dynamic `import('@react-native-community/netinfo')`
 * fails in Jest (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG), but the
 * source code gracefully handles this via try/catch. We test that fallback.
 *
 * KEY: No jest.resetModules() — that causes React dual-copy issues with renderHook.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useNetworkStatus } from '../useNetworkStatus';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNetworkStatus', () => {
  describe('native platform (default in jest-expo)', () => {
    it('returns isConnected=true and isOffline=false by default', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Default useState(true) — synchronous
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('gracefully handles dynamic import failure', async () => {
      // Dynamic import() fails in Jest, so the catch block runs
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkStatus());

      // Wait for the async catch to execute
      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          'NetInfo not available:',
          expect.anything()
        );
      });

      // After catch, setIsConnected(true) keeps the default
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isOffline).toBe(false);

      warnSpy.mockRestore();
    });

    it('stays connected after fallback (assumes connected)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkStatus());

      // Wait for the async fallback to resolve
      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalled();
      });

      // isConnected stays true (fallback behavior)
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isOffline).toBe(false);

      warnSpy.mockRestore();
    });
  });

  describe('web platform', () => {
    const originalPlatformOS = Platform.OS;
    // Store real window methods (may not exist in RN test env)
    const origAddEventListener = (global as any).window?.addEventListener;
    const origRemoveEventListener = (global as any).window?.removeEventListener;
    const origDispatchEvent = (global as any).window?.dispatchEvent;

    let listeners: Record<string, Function[]>;

    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      // Mock window event listener APIs for react-native test env
      listeners = {};
      (global as any).window.addEventListener = jest.fn((event: string, handler: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      });
      (global as any).window.removeEventListener = jest.fn((event: string, handler: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      });
      (global as any).window.dispatchEvent = jest.fn((event: { type: string }) => {
        (listeners[event.type] || []).forEach((h) => h(event));
      });
    });

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
      // Restore originals
      if (origAddEventListener) (global as any).window.addEventListener = origAddEventListener;
      if (origRemoveEventListener) (global as any).window.removeEventListener = origRemoveEventListener;
      if (origDispatchEvent) (global as any).window.dispatchEvent = origDispatchEvent;
    });

    it('uses navigator.onLine on web platform', () => {
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('ignores offline events for localhost web previews', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      act(() => {
        (listeners['offline'] || []).forEach((h) => h());
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('treats localhost web previews as connected when navigator.onLine is unreliable', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'location', {
        value: { hostname: '127.0.0.1' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('registers online/offline listeners on web', () => {
      renderHook(() => useNetworkStatus());

      expect((global as any).window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect((global as any).window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('responds to offline/online events', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'app.example.test' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      // Simulate going offline
      act(() => {
        (listeners['offline'] || []).forEach((h) => h());
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isOffline).toBe(true);

      // Simulate coming back online
      act(() => {
        (listeners['online'] || []).forEach((h) => h());
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });
  });
});
