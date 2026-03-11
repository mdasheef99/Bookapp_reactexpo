/**
 * Mock for react-native-gesture-handler
 *
 * Used in: _layout.tsx (GestureHandlerRootView), SwipeableBookCard.tsx (Swipeable)
 */
import React from 'react';
import { View, ScrollView as RNScrollView, FlatList as RNFlatList } from 'react-native';

export const GestureHandlerRootView = ({ children, ...props }: any) => (
  <View {...props}>{children}</View>
);

export const Swipeable = React.forwardRef(({ children, ...props }: any, ref: any) => (
  <View ref={ref} {...props}>
    {children}
  </View>
));
Swipeable.displayName = 'Swipeable';

export const DrawerLayout = ({ children, ...props }: any) => (
  <View {...props}>{children}</View>
);

// Re-export RN scroll components
export const ScrollView = RNScrollView;
export const FlatList = RNFlatList;

// Gesture state enum
export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

// Touch handlers (no-op)
export const TouchableOpacity = View;
export const TouchableHighlight = View;
export const TouchableWithoutFeedback = View;

// Gesture types (no-op)
export const PanGestureHandler = View;
export const TapGestureHandler = View;
export const LongPressGestureHandler = View;
export const PinchGestureHandler = View;
export const RotationGestureHandler = View;
export const FlingGestureHandler = View;

// Gesture detector
export const GestureDetector = ({ children }: any) => children;
export const Gesture = {
  Pan: jest.fn(() => ({})),
  Tap: jest.fn(() => ({})),
  LongPress: jest.fn(() => ({})),
  Pinch: jest.fn(() => ({})),
  Rotation: jest.fn(() => ({})),
  Fling: jest.fn(() => ({})),
  Simultaneous: jest.fn(() => ({})),
  Exclusive: jest.fn(() => ({})),
  Race: jest.fn(() => ({})),
};

