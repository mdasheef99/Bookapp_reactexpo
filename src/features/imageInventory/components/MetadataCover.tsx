import { useState } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';

// Picker §3 / EP-D14: an unavailable image never blocks the metadata choice.
export function MetadataCover({ reference, label, placeholderLabel, style }: {
  reference: string | null; label: string; placeholderLabel: string; style: ViewStyle;
}) {
  const { colors } = useTheme();
  const [failedReference, setFailedReference] = useState<string | null>(null);
  // Security §8 / picker §13.14: Open Library permits display, not native image caching.
  let cachePolicy: 'none' | undefined;
  if (reference) {
    try {
      if (new URL(reference).hostname.toLowerCase() === 'covers.openlibrary.org') cachePolicy = 'none';
    } catch { /* Existing image-error fallback handles malformed legacy references. */ }
  }
  if (reference && reference !== failedReference) return <Image source={{ uri: reference }} cachePolicy={cachePolicy}
    contentFit="contain" accessible accessibilityRole="image" accessibilityLabel={label}
    style={style as import('react-native').ImageStyle} onError={() => setFailedReference(reference)} />;
  return <View accessible accessibilityRole="image" accessibilityLabel={placeholderLabel}
    style={[style, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSecondary,
      alignItems: 'center', justifyContent: 'center' }]}>
    <Text style={{ color: colors.textSecondary }}>No cover</Text>
  </View>;
}