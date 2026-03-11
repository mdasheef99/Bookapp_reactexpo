/**
 * Mock for react-native-safe-area-context
 *
 * Used in: _layout.tsx (SafeAreaProvider)
 */
import React from 'react';
import { View } from 'react-native';

const defaultInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const defaultFrame = { x: 0, y: 0, width: 390, height: 844 };

export const SafeAreaProvider = ({ children, ...props }: any) => (
  <View {...props}>{children}</View>
);

export const SafeAreaView = ({ children, ...props }: any) => (
  <View {...props}>{children}</View>
);

export const useSafeAreaInsets = jest.fn(() => defaultInsets);
export const useSafeAreaFrame = jest.fn(() => defaultFrame);
export const SafeAreaInsetsContext = React.createContext(defaultInsets);
export const SafeAreaFrameContext = React.createContext(defaultFrame);

export const initialWindowMetrics = {
  insets: defaultInsets,
  frame: defaultFrame,
};

export const withSafeAreaInsets = (Component: any) => {
  const WrappedComponent = (props: any) => (
    <Component {...props} insets={defaultInsets} />
  );
  WrappedComponent.displayName = `withSafeAreaInsets(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

