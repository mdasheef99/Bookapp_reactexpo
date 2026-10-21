import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_TEXT } from './LibraryTypography';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from './LibraryAppearance';
import { CONTROL_DISABLED_OPACITY, CONTROL_FOCUS_RING } from './bookDetails/bookDetailsTokens';
import { BookButton } from './ui';
import { ExportButton } from './export';

type LibraryHeaderProps = {
    onAdd?: () => void;
    onExport?: () => void;
    exportDisabled?: boolean;
    exportBusy?: boolean;
    viewMode?: 'shelf' | 'list';
    onViewModeChange?: (mode: 'shelf' | 'list') => void;
    focusSelectedView?: boolean;
    disabled?: boolean;
    viewDisabled?: boolean;
};

const VIEW_MODES = ['shelf', 'list'] as const;

export function LibraryHeader({ onAdd, onExport, exportDisabled = false, exportBusy = false, viewMode = 'list', onViewModeChange, focusSelectedView = false, disabled = false, viewDisabled = disabled }: LibraryHeaderProps) {
    const colors = useLibraryAppearance();
    const refs = React.useRef<(View | null)[]>([]);
    const [focused, setFocused] = React.useState<number | null>(null);
    React.useEffect(() => {
        // The header changes scroll owners when switching modes; retain keyboard focus.
        if (focusSelectedView && Platform.OS === 'web') refs.current[VIEW_MODES.indexOf(viewMode)]?.focus();
    }, [focusSelectedView, viewMode]);
    const choose = (mode: 'shelf' | 'list') => { if (!viewDisabled) onViewModeChange?.(mode); };

    return <View style={styles.header}>
        <Text accessibilityRole="header" role="heading" aria-level={1} style={[LIBRARY_TEXT.title, { color: colors.textPrimary }]}>My Library</Text>
        <View style={styles.actionRow}>
            {onViewModeChange && <View accessibilityRole="radiogroup" accessibilityLabel="Library view" accessibilityState={{ disabled: viewDisabled }} aria-disabled={viewDisabled}
                style={[styles.viewChoices, { borderColor: colors.controlBorder }, viewDisabled && { opacity: CONTROL_DISABLED_OPACITY }]}>
                {VIEW_MODES.map((mode, index) => {
                    const selected = viewMode === mode;
                    const onKeyDown = (event: { key?: string; nativeEvent?: { key: string }; target?: unknown; currentTarget?: unknown; repeat?: boolean; preventDefault: () => void }) => {
                        const key = event.nativeEvent?.key ?? event.key;
                        if (viewDisabled) return;
                        if (key === ' ' && event.target === event.currentTarget) {
                            event.preventDefault();
                            if (!event.repeat) choose(mode);
                            return;
                        }
                        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
                        event.preventDefault();
                        const next = (index + 1) % VIEW_MODES.length;
                        choose(VIEW_MODES[next]);
                        refs.current[next]?.focus();
                    };
                    return <Pressable key={mode} ref={node => { refs.current[index] = node; }} onPress={() => choose(mode)}
                        disabled={viewDisabled} accessibilityRole="radio" accessibilityLabel={`${mode === 'shelf' ? 'Shelf' : 'List'} view`}
                        accessibilityState={{ selected, checked: selected, disabled: viewDisabled }} aria-checked={selected} aria-disabled={viewDisabled}
                        tabIndex={!viewDisabled && selected ? 0 : -1} testID={`library-view-${mode}`}
                        onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} {...(Platform.OS === 'web' ? { onKeyDown } : {})}
                        style={[styles.viewChoice, selected && { backgroundColor: colors.bgCard },
                            Platform.OS === 'web' && focused === index && [CONTROL_FOCUS_RING, { outlineColor: colors.focusRing }]]}>
                        <Text style={[LIBRARY_TEXT.label, { color: selected ? colors.textPrimary : colors.textSecondary }]}>{mode === 'shelf' ? 'Shelf' : 'List'}</Text>
                    </Pressable>;
                })}
            </View>}
            {onAdd && <BookButton label="Add a book" variant="primary" onPress={onAdd} disabled={disabled} />}
            {onExport && <ExportButton label={exportBusy ? 'Exporting…' : 'Export library'} accessibilityLabel="Export library as CSV"
                variant="text" busy={exportBusy} disabled={exportDisabled || exportBusy}
                onPress={() => { if (!exportDisabled && !exportBusy) onExport(); }} />}
        </View>
    </View>;
}

const styles = StyleSheet.create({
    header: { paddingTop: LIBRARY_SPACING.md, paddingBottom: LIBRARY_SPACING.md },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: LIBRARY_SPACING.sm, marginTop: LIBRARY_SPACING.md },
    viewChoices: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: LIBRARY_RADIUS.control, borderWidth: 1 },
    viewChoice: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: LIBRARY_SPACING.sm, borderRadius: LIBRARY_RADIUS.control, alignItems: 'center', justifyContent: 'center' },
});
