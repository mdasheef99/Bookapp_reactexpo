import React from 'react';
import { Platform, View } from 'react-native';
export function OrganisingBackground({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  return <View style={{ flex: 1 }} aria-hidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} {...(Platform.OS === 'web' && hidden ? { inert: true } as object : {})}>{children}</View>;
}
