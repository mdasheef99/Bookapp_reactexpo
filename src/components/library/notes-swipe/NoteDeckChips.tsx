import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT, LIBRARY_TEXT_BASE } from '../LibraryTypography';
import { CONTROL_DISABLED_OPACITY, CONTROL_FOCUS_RING } from '../bookDetails/bookDetailsTokens';
import { NOTE_CATEGORIES, NoteDeckCategory, categoryLabel } from '@/features/books/notes/manualNoteContract';

export function chipLabel(category: NoteDeckCategory): string {
  if (category === 'all') return 'All';
  const found = NOTE_CATEGORIES.find(item => item.value === category);
  return found?.label ?? categoryLabel(category);
}

export function NoteDeckChips({ categories, selected, onSelect, disabled = false }: {
  categories: readonly NoteDeckCategory[]; selected: NoteDeckCategory; onSelect: (category: NoteDeckCategory) => void; disabled?: boolean;
}) {
  const colors = useLibraryAppearance();
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<(View | null)[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const xByIndex = useRef<Record<number, number>>({});
  const checkedIndex = categories.findIndex(choice => choice === selected);
  const tabStop = checkedIndex < 0 ? 0 : checkedIndex;
  const containerWidth = useRef<number | undefined>(undefined);
  const scrollToSelected = useCallback(() => {
    const x = xByIndex.current[tabStop];
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - LIBRARY_SPACING.md), animated: false });
  }, [tabStop]);
  useEffect(scrollToSelected, [scrollToSelected]);
  const choose = (value: NoteDeckCategory) => { if (!disabled) onSelect(value); };
  return <View testID="note-deck-chips-bar" accessibilityRole="radiogroup" accessibilityLabel="Filter notes"
      accessibilityState={{ disabled }} style={[styles.bar, { backgroundColor: colors.bgPrimary }, disabled && { opacity: CONTROL_DISABLED_OPACITY }]}>
    <ScrollView ref={scrollRef} testID="note-deck-chips" horizontal showsHorizontalScrollIndicator={false}
      onLayout={event => {
        const width = event.nativeEvent.layout.width;
        if (containerWidth.current === width) return;
        containerWidth.current = width;
        scrollToSelected();
      }} contentContainerStyle={styles.row}>
      {categories.map((category, index) => {
        const checked = selected === category;
        const label = chipLabel(category);
        const onKeyDown = (event: { key?: string; nativeEvent?: { key: string }; target?: unknown; currentTarget?: unknown; repeat?: boolean; preventDefault: () => void }) => {
          const key = event.nativeEvent?.key ?? event.key;
          if (disabled) return;
          if (key === ' ' && event.target === event.currentTarget) {
            event.preventDefault();
            if (!event.repeat) choose(category);
            return;
          }
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
          event.preventDefault();
          const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : categories.length - 1)) % categories.length;
          choose(categories[next]);
          refs.current[next]?.focus();
        };
        return <Pressable key={category} ref={node => { refs.current[index] = node; }} accessibilityRole="radio" accessibilityLabel={label}
          aria-checked={checked} {...(disabled ? { 'aria-disabled': true } : {})} accessibilityState={{ selected: checked, checked, ...(disabled ? { disabled } : {}) }} {...(disabled ? { disabled } : {})}
          tabIndex={!disabled && index === tabStop ? 0 : -1} onPress={() => choose(category)}
          onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
          onLayout={event => {
            const x = event.nativeEvent.layout.x;
            if (xByIndex.current[index] === x) return;
            xByIndex.current[index] = x;
            if (index === tabStop) scrollToSelected();
          }}
          {...(Platform.OS === 'web' ? { onKeyDown } : {})}
          style={[styles.chip, { minHeight: Math.max(MIN_TARGET, LIBRARY_TEXT.label.lineHeight + LIBRARY_SPACING.xs * 2 + 2), backgroundColor: checked ? colors.chipSelectedBackground : colors.bgCard, borderColor: colors.controlBorder },
            Platform.OS === 'web' && focused === index && [CONTROL_FOCUS_RING, { outlineColor: colors.focusRing }]]}>
          <Text style={[LIBRARY_TEXT_BASE.label, { color: checked ? colors.chipSelectedText : colors.textPrimary }]}>{checked ? '✓ ' : ''}{label}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  bar: { paddingHorizontal: LIBRARY_SPACING.md, paddingVertical: LIBRARY_SPACING.xs },
  row: { flexDirection: 'row', gap: LIBRARY_SPACING.xs, alignItems: 'center' },
  chip: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: LIBRARY_SPACING.sm, paddingVertical: LIBRARY_SPACING.xs, borderWidth: 1, borderRadius: LIBRARY_RADIUS.chip, justifyContent: 'center' },
});
