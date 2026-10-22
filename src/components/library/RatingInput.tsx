import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from './LibraryAppearance';
import { LIBRARY_TEXT } from './LibraryTypography';
import { CONTROL_DISABLED_OPACITY, CONTROL_FOCUS_RING, ICON_SIZE, MAX_SCORE } from './bookDetails/bookDetailsTokens';

interface RatingInputProps {
  rating: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  /** Icon size in dp (default ICON_SIZE). Touch targets stay >= MIN_TARGET. */
  size?: number;
  /** Centre the label and stars (Book Details summary under the cover). */
  centered?: boolean;
}

/** One-word label for a saved or draft rating (SDD-07 §14.2b). */
export function ratingValueLabel(rating: number): string {
  switch (rating) {
    case 1: return 'Poor';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Great';
    case 5: return 'Loved it';
    default: return 'Tap to rate';
  }
}

const STARS = Array.from({ length: MAX_SCORE }, (_, index) => index + 1);

export const RatingInput = ({ rating, onChange, disabled = false, size = ICON_SIZE, centered = false }: RatingInputProps) => {
  const colors = useLibraryAppearance();
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<(View | null)[]>([]);
  const checkedIndex = STARS.indexOf(rating);
  const tabStop = checkedIndex < 0 ? 0 : checkedIndex;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Your rating"
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={[styles.group, centered && styles.centered, disabled && styles.disabled]}
    >
      <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>Your rating</Text>
      <View style={styles.stars}>
        {STARS.map((star, index) => {
          const checked = star === rating;
          const keyboard = {
            onKeyDown: (event: { key?: string; nativeEvent?: { key: string }; preventDefault: () => void }) => {
              const key = event.nativeEvent?.key ?? event.key;
              if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
              event.preventDefault();
              const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : STARS.length - 1)) % STARS.length;
              onChange(STARS[next]);
              refs.current[next]?.focus();
            },
          };
          return (
            <Pressable
              key={star}
              ref={node => { refs.current[index] = node; }}
              accessibilityRole="radio"
              accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
              accessibilityState={{ checked, disabled }}
              aria-checked={checked}
              aria-disabled={disabled}
              disabled={disabled}
              tabIndex={!disabled && index === tabStop ? 0 : -1}
              {...keyboard}
              onPress={() => { if (!disabled) onChange(star); }}
              onFocus={() => setFocused(index)}
              onBlur={() => setFocused(null)}
              style={[
                styles.star,
                Platform.OS === 'web' && focused === index && [CONTROL_FOCUS_RING, { outlineColor: colors.focusRing }],
              ]}
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={size}
                color={star <= rating ? colors.textPrimary : colors.textSecondary}
                accessible={false}
                aria-hidden
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  group: { gap: LIBRARY_SPACING.xs },
  centered: { alignItems: 'center' },
  stars: { flexDirection: 'row' },
  star: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LIBRARY_RADIUS.control,
  },
  disabled: { opacity: CONTROL_DISABLED_OPACITY },
});
