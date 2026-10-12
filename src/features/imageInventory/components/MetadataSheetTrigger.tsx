import { Pressable, Text, type View, type StyleProp, type ViewStyle } from 'react-native';
import type { RefObject } from 'react';
import { useTheme } from '@/hooks/useTheme';

export function MetadataSheetTrigger({ title, onPress, focusRef, style }: {
  title: string; onPress: () => void; focusRef: RefObject<View | null>; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return <Pressable ref={focusRef} accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint="Opens book metadata and edition choices" onPress={onPress}
    style={[{ minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border }, style]}>
    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}
