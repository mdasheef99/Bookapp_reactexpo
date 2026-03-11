/**
 * Mock for expo-router
 *
 * Used in: _layout.tsx, login.tsx, verify-otp.tsx, [bookId].tsx, search.tsx, etc.
 * APIs: router.push/replace/back, useRouter, useSegments, useLocalSearchParams, Slot, Link
 */
import React from 'react';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
  setParams: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  navigate: jest.fn(),
};

export const router = mockRouter;

export const useRouter = jest.fn(() => mockRouter);

export const useSegments = jest.fn(() => [] as string[]);

export const useLocalSearchParams = jest.fn(() => ({}) as Record<string, string>);

export const usePathname = jest.fn(() => '/');

export const useGlobalSearchParams = jest.fn(() => ({}) as Record<string, string>);

export const Slot = ({ children }: { children?: React.ReactNode }) => children ?? null;

export const Link = ({ children, ...props }: any) =>
  React.createElement('a', props, children);

export const Tabs = ({ children }: any) => children ?? null;
Tabs.Screen = (_props: any) => null;

export const Stack = ({ children }: any) => children ?? null;
Stack.Screen = (_props: any) => null;

