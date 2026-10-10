import { Pressable, Text, type View } from 'react-native';
import type { RefObject } from 'react';
import { useTheme } from '@/hooks/useTheme';

export function MetadataSheetTrigger({ title, onPress, focusRef }: {
  title: string; onPress: () => void; focusRef: RefObject<View | null>;
}) {
  const { colors } = useTheme();
  return <Pressable ref={focusRef} accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint="Opens book metadata and edition choices" onPress={onPress}
    style={{ minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border, flexGrow: 1, flexBasis: 150 }}>
    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}