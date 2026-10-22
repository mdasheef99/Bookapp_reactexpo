import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { CONTROL_DISABLED_OPACITY, CONTROL_FOCUS_RING, STATUS_SEGMENT_BORDER } from './bookDetailsTokens';

interface ChoiceRadioGroupProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  testID?: string;
}

export function ChoiceRadioGroup<T extends string>({
  label, value, options, onChange, disabled = false, testID,
}: ChoiceRadioGroupProps<T>) {
  const colors = useLibraryAppearance();
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<(View | null)[]>([]);
  const checkedIndex = options.findIndex(option => option.value === value);
  const tabStop = checkedIndex < 0 ? 0 : checkedIndex;

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      // collapsable={false}: the disabled opacity must not switch this view between flattened and
      // unflattened on Android (Fabric then re-parents its Text and crashes: "child already has a parent").
      collapsable={false}
      style={[styles.group, disabled && styles.disabled]}
    >
      <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.options}>
        {options.map((option, index) => {
          const checked = option.value === value;
          const select = (next: T) => {
            if (disabled || next === value) return;
            onChange(next);
          };
          const keyboard = {
            onKeyDown: (event: { key?: string; nativeEvent?: { key: string }; repeat?: boolean; preventDefault: () => void }) => {
              const key = event.nativeEvent?.key ?? event.key;
              if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
              event.preventDefault();
              const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
              select(options[next].value);
              refs.current[next]?.focus();
            },
          };
          if (Platform.OS === 'web') {
            const onArrowKeyDown = keyboard.onKeyDown;
            keyboard.onKeyDown = event => {
              if ((event.nativeEvent?.key ?? event.key) !== ' ') {
                onArrowKeyDown(event);
                return;
              }
              if (disabled) return;
              event.preventDefault();
              if (!event.repeat) select(option.value);
            };
          }
          return (
            <Pressable
              key={option.value}
              ref={node => { refs.current[index] = node; }}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked, disabled }}
              aria-checked={checked}
              aria-disabled={disabled}
              disabled={disabled}
              tabIndex={!disabled && index === tabStop ? 0 : -1}
              {...keyboard}
              onPress={() => select(option.value)}
              onFocus={() => setFocused(index)}
              onBlur={() => setFocused(null)}
              style={[
                styles.option,
                {
                  backgroundColor: checked ? colors.bgCard : colors.bgSecondary,
                  borderColor: checked ? colors.controlBorder : colors.bgSecondary,
                },
                Platform.OS === 'web' && focused === index && [CONTROL_FOCUS_RING, { outlineColor: colors.focusRing }],
              ]}
            >
              <Text style={[checked ? LIBRARY_TEXT.label : LIBRARY_TEXT.body, { color: checked ? colors.textPrimary : colors.textSecondary }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: LIBRARY_SPACING.xs },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: LIBRARY_SPACING.xs },
  option: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingVertical: LIBRARY_SPACING.xs,
    paddingHorizontal: LIBRARY_SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LIBRARY_RADIUS.control,
    borderWidth: STATUS_SEGMENT_BORDER,
  },
  disabled: { opacity: CONTROL_DISABLED_OPACITY },
});
