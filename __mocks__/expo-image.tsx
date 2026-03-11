/**
 * Mock for expo-image
 *
 * Used in: [bookId].tsx
 * API: <Image source={uri} style={...} contentFit="cover" />
 */
import React from 'react';
import { View } from 'react-native';

export const Image = React.forwardRef(
  ({ testID, ...props }: any, ref: any) => (
    <View ref={ref} testID={testID} accessibilityRole="image" {...props} />
  )
);

Image.displayName = 'ExpoImage';

