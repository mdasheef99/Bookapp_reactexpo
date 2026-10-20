import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LibraryFilter, LibraryFilterChip } from '@/features/books/utils/libraryShelf';
import { LIBRARY_TEXT } from './LibraryTypography';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from './LibraryAppearance';
import { CONTROL_DISABLED_OPACITY, CONTROL_FOCUS_RING } from './bookDetails/bookDetailsTokens';

type LibraryFilterBarProps = {
    chips: LibraryFilterChip[];
    activeFilter: LibraryFilter;
    onChange: (filter: LibraryFilter) => void;
    disabled?: boolean;
};

export function LibraryFilterBar({ chips, activeFilter, onChange, disabled = false }: LibraryFilterBarProps) {
    const colors = useLibraryAppearance();
    const refs = React.useRef<(View | null)[]>([]);
    const [focused, setFocused] = React.useState<number | null>(null);
    const checkedIndex = chips.findIndex(chip => chip.key === activeFilter);
    const tabStop = checkedIndex < 0 ? 0 : checkedIndex;
    const choose = (filter: LibraryFilter) => { if (!disabled) onChange(filter); };

    return <View accessibilityRole="radiogroup" accessibilityLabel="Filter books" accessibilityState={{ disabled }} aria-disabled={disabled}
        style={[styles.filterRow, disabled && { opacity: CONTROL_DISABLED_OPACITY }]}>
        {chips.map((chip, index) => {
            const checked = chip.key === activeFilter;
            const onKeyDown = (event: { key?: string; nativeEvent?: { key: string }; target?: unknown; currentTarget?: unknown; repeat?: boolean; preventDefault: () => void }) => {
                const key = event.nativeEvent?.key ?? event.key;
                if (disabled) return;
                // RN Web's responder handles Enter; radio Space needs its own activation.
                if (key === ' ' && event.target === event.currentTarget) {
                    event.preventDefault();
                    if (!event.repeat) choose(chip.key);
                    return;
                }
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
                event.preventDefault();
                const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : chips.length - 1)) % chips.length;
                choose(chips[next].key);
                refs.current[next]?.focus();
            };
            return <Pressable key={chip.key} ref={node => { refs.current[index] = node; }} onPress={() => choose(chip.key)}
                disabled={disabled} accessibilityRole="radio" accessibilityLabel={`${chip.label}, ${chip.count} ${chip.count === 1 ? 'book' : 'books'}`}
                accessibilityState={{ selected: checked, checked, disabled }} aria-checked={checked} aria-disabled={disabled}
                tabIndex={!disabled && index === tabStop ? 0 : -1} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
                {...(Platform.OS === 'web' ? { onKeyDown } : {})}
                style={[styles.filterChip, { backgroundColor: checked ? colors.chipSelectedBackground : 'transparent', borderColor: colors.controlBorder },
                    Platform.OS === 'web' && focused === index && [CONTROL_FOCUS_RING, { outlineColor: colors.focusRing }]]}>
                <Text style={[LIBRARY_TEXT.label, { color: checked ? colors.chipSelectedText : colors.textPrimary }]}>{checked ? '✓ ' : ''}{chip.label} {chip.count}</Text>
            </Pressable>;
        })}
    </View>;
}

const styles = StyleSheet.create({
    // Wrapping keeps all filters visible at narrow widths, large text and high counts.
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: LIBRARY_SPACING.xs },
    filterChip: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: LIBRARY_RADIUS.chip, borderWidth: 1, paddingHorizontal: LIBRARY_SPACING.sm, paddingVertical: LIBRARY_SPACING.xs, justifyContent: 'center' },
});
