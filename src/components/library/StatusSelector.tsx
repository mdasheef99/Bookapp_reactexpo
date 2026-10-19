import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from './LibraryAppearance';
import { LIBRARY_TEXT } from './LibraryTypography';
import { readingStatusLabel } from '@/features/books/utils/libraryLabels';
import { STACK_STATUS_BELOW, STATUS_SEGMENT_BORDER } from './bookDetails/bookDetailsTokens';

export type ReadingStatus = 'want_to_read' | 'reading' | 'completed';

interface StatusSelectorProps {
  status: ReadingStatus;
  onChange: (status: ReadingStatus) => void;
  disabled?: boolean;
  busy?: boolean;
}

const VALUES: readonly ReadingStatus[] = ['want_to_read', 'reading', 'completed'];

export const StatusSelector = ({ status, onChange, disabled = false, busy = false }: StatusSelectorProps) => {
  const colors = useLibraryAppearance();
  const [width, setWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<number[]>([]);
  const labelSpace = (width - LIBRARY_SPACING.xxs * 2) / VALUES.length - (LIBRARY_SPACING.xxs + STATUS_SEGMENT_BORDER) * 2;
  const vertical =
    width < STACK_STATUS_BELOW ||
    VALUES.some((_, index) => labelWidths[index] == null || labelWidths[index] > labelSpace);
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<(View | null)[]>([]);
  const checkedIndex = VALUES.indexOf(status);
  const tabStop = checkedIndex < 0 ? 0 : checkedIndex;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Reading status"
      accessibilityState={{ disabled, busy }}
      aria-busy={busy}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      aria-disabled={disabled}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      style={[styles.track, vertical && styles.verticalTrack, { backgroundColor: colors.bgSecondary }, disabled && styles.disabled]}
    >
      <View
        accessible={false}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measurementClip}
      >
        <View style={styles.measurementRow}>
          {VALUES.map((value, index) => (
            <Text
              key={value}
              numberOfLines={1}
              style={[LIBRARY_TEXT.label, styles.measurementLabel]}
              onLayout={(event) => {
                const nextWidth = event.nativeEvent.layout.width;
                setLabelWidths((current) => {
                  if (current[index] === nextWidth) return current;
                  const next = [...current];
                  next[index] = nextWidth;
                  return next;
                });
              }}
            >
              {readingStatusLabel(value)}
            </Text>
          ))}
        </View>
      </View>
      {VALUES.map((value, index) => {
        const label = readingStatusLabel(value);
        const checked = status === value;
        const handlePress = () => {
          if (disabled || status === value) return;
          onChange(value);
        };
        const keyboard = {
          onKeyDown: (event: { key?: string; nativeEvent?: { key: string }; preventDefault: () => void }) => {
            const key = event.nativeEvent?.key ?? event.key;
            if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
            event.preventDefault();
            const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : VALUES.length - 1)) % VALUES.length;
            if (VALUES[next] === status) return;
            onChange(VALUES[next]);
            refs.current[next]?.focus();
          },
        };
        const isFocused = focused === index;
        return (
          <Pressable
            key={value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            accessibilityRole="radio"
            accessibilityLabel={label}
            aria-checked={checked}
            aria-disabled={disabled}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            tabIndex={!disabled && index === tabStop ? 0 : -1}
            {...keyboard}
            onPress={handlePress}
            onFocus={() => setFocused(index)}
            onBlur={() => setFocused(null)}
            style={[
              styles.segment,
              vertical && styles.verticalSegment,
              {
                backgroundColor: checked ? colors.bgCard : colors.bgSecondary,
                borderColor: checked ? colors.controlBorder : colors.bgSecondary,
              },
              Platform.OS === 'web' && isFocused && [styles.focusRing, { outlineColor: colors.focusRing }],
            ]}
          >
            <Text
              style={[
                checked ? LIBRARY_TEXT.label : LIBRARY_TEXT.body,
                styles.segmentLabel,
                Platform.OS === 'web' && styles.wrapWords,
                { color: checked ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    minWidth: 0,
    maxWidth: '100%',
    borderRadius: LIBRARY_RADIUS.control,
    padding: LIBRARY_SPACING.xxs,
  },
  verticalTrack: {
    flexDirection: 'column',
  },
  segment: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    flex: 1,
    paddingVertical: LIBRARY_SPACING.xs,
    paddingHorizontal: LIBRARY_SPACING.xxs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LIBRARY_RADIUS.control,
    borderWidth: STATUS_SEGMENT_BORDER,
  },
  verticalSegment: {
    flex: 0,
    width: '100%',
  },
  segmentLabel: {
    textAlign: 'center',
    maxWidth: '100%',
  },
  measurementClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  measurementRow: {
    flexDirection: 'row',
  },
  measurementLabel: {
    flexShrink: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  focusRing: {
    outlineWidth: 2,
    outlineOffset: 2,
    outlineStyle: 'solid',
  },
  wrapWords: {
    minWidth: 0,
    maxWidth: '100%',
    wordBreak: 'normal',
    wordWrap: 'normal',
    overflowWrap: 'normal',
  } as Record<string, unknown>,
});
