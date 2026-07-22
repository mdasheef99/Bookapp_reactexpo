/**
 * Jest setup file for BookTalks Mobile
 * Runs after the test framework is installed — jest globals (describe, test, expect) are available.
 */

// Extended matchers from React Native Testing Library (replaces deprecated @testing-library/jest-native)
// Import matchers and extend expect manually (no convenience import in v13.x)
import * as matchers from '@testing-library/react-native/matchers';
expect.extend(matchers);

// Mock react-native-url-polyfill (imported for side effects in supabase.ts)
jest.mock('react-native-url-polyfill/auto', () => {});

// Mock react-native-reanimated (used internally by expo-router, react-native-screens)
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Set test environment variables so supabase.ts doesn't throw
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.EXPO_PUBLIC_DEV_SKIP_AUTH = 'false';
process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
process.env.EXPO_PUBLIC_APP_ENV = 'development';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTags: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  wrap: (Component: unknown) => Component,
}));

// Silence console warnings in tests (optional, uncomment if too noisy)
// const originalWarn = console.warn;
// console.warn = (...args: any[]) => {
//   if (typeof args[0] === 'string' && args[0].includes('Animated:')) return;
//   originalWarn(...args);
// };

