/**
 * Mock for expo-blur
 *
 * Used in: DeleteBookModal, NoteEditor, [bookId].tsx
 * API: <BlurView intensity={20} style={...} />
 */
import React from 'react';
import { View } from 'react-native';

export const BlurView = React.forwardRef(
  ({ children, ...props }: any, ref: any) => (
    <View ref={ref} {...props}>
      {children}
    </View>
  )
);

BlurView.displayName = 'BlurView';

