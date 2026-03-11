/**
 * Mock for expo-linear-gradient
 *
 * Used in: profile.tsx, login.tsx, [bookId].tsx, search.tsx
 * API: <LinearGradient colors={[...]} style={...} start={{x,y}} end={{x,y}} />
 */
import React from 'react';
import { View } from 'react-native';

export const LinearGradient = React.forwardRef(
  ({ children, ...props }: any, ref: any) => (
    <View ref={ref} {...props}>
      {children}
    </View>
  )
);

LinearGradient.displayName = 'LinearGradient';

