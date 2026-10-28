import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT, libraryFontScale } from '../LibraryTypography';
import { ICON_SIZE, ROW_MIN_HEIGHT, ROW_SUMMARY_LINES } from './bookDetailsTokens';

export interface DetailRowProps {
  id: string;
  label: string;
  secondary?: string;
  absent?: boolean;
  expanded?: boolean;
  link?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  triggerRef?: React.RefObject<View | null>;
}

export function DetailRow({
  id,
  label,
  secondary,
  absent = false,
  expanded,
  link = false,
  onPress,
  children,
  triggerRef,
}: DetailRowProps) {
  const colors = useLibraryAppearance();
  const [focused, setFocused] = useState(false);

  // At large system text the label and summary no longer fit side by side, so they stack.
  const stacked = libraryFontScale() >= STACK_FONT_SCALE;

  const content = (
    <View testID={`detail-row-text-${id}`} style={stacked ? styles.textStacked : styles.textInline}>
      <Text style={[LIBRARY_TEXT.body, styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      {secondary ? (
        <Text
          numberOfLines={ROW_SUMMARY_LINES}
          ellipsizeMode="tail"
          style={[
            LIBRARY_TEXT.body,
            stacked ? styles.rowSummaryStacked : styles.rowSummary,
            { color: absent ? colors.textTertiary : colors.textSecondary },
          ]}
        >
          {secondary}
        </Text>
      ) : stacked ? null : (
        <View style={styles.spacer} />
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={`book-row-${id}`} style={[styles.row, { borderColor: colors.divider }]}>
        {content}
      </View>
    );
  }

  const disclosure = !link && expanded !== undefined;

  return (
    <View>
      <Pressable
        ref={triggerRef}
        testID={`book-row-${id}`}
        accessibilityRole={link ? 'link' : 'button'}
        accessibilityLabel={[label, secondary].filter(Boolean).join(', ')}
        aria-expanded={disclosure ? expanded : undefined}
        accessibilityState={disclosure ? { expanded } : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPress={onPress}
        style={[
          styles.row,
          { borderColor: colors.divider },
          Platform.OS === 'web' && focused && [styles.focusRing, { outlineColor: colors.focusRing }],
        ]}
      >
        {content}
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={ICON_SIZE}
          color={colors.textSecondary}
          accessible={false}
          aria-hidden
        />
      </Pressable>
      {expanded && (
        <View testID={`book-expanded-${id}`} style={styles.expanded}>
          {children}
        </View>
      )}
    </View>
  );
}

export const STACK_FONT_SCALE = 1.3;

const styles = StyleSheet.create({
  textInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
  },
  textStacked: {
    flex: 1,
    gap: LIBRARY_SPACING.xs,
  },
  rowSummaryStacked: {
    textAlign: 'left',
  },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    minWidth: MIN_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
    paddingVertical: LIBRARY_SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flexShrink: 1,
  },
  rowSummary: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  spacer: {
    flex: 1,
  },
  expanded: {
    gap: LIBRARY_SPACING.sm,
    paddingBottom: LIBRARY_SPACING.md,
  },
  focusRing: {
    outlineWidth: 2,
    outlineOffset: 2,
    outlineStyle: 'solid',
  },
});
