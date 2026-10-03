import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryTypography } from './LibraryTypography';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from './LibraryAppearance';

type LibraryHeaderProps = {
    showAddButton?: boolean;
    onSearch: () => void;
    onAdd?: () => void;
    viewMode?: 'shelf' | 'list';
    onViewModeChange?: (mode: 'shelf' | 'list') => void;
    focusSelectedView?: boolean;
};

export function LibraryHeader({ showAddButton = true, onSearch, onAdd = onSearch, viewMode = 'list', onViewModeChange, focusSelectedView = false }: LibraryHeaderProps) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    const selectedViewRef = React.useRef<React.ElementRef<typeof TouchableOpacity>>(null);
    React.useEffect(() => {
        // The header changes scroll owners when switching modes; retain keyboard focus.
        if (focusSelectedView && Platform.OS === 'web') selectedViewRef.current?.focus();
    }, [focusSelectedView, viewMode]);

    return (
        <View style={styles.header}>
            <View style={styles.mainRow}>
                <View style={styles.titleRow}>
                    <Ionicons name="book-outline" size={22} color={colors.textPrimary} style={{ marginRight: 8 }} />
                    <Text style={[styles.title, { fontFamily: fonts.heading, color: colors.textPrimary }]}>CM's Book Shelf</Text>
                </View>
                <TouchableOpacity
                    onPress={onSearch}
                    style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Search books"
                    accessibilityHint="Open the catalogue to find and add books"
                >
                    <Ionicons name="search-outline" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>
            <View style={styles.actionRow}>
                {onViewModeChange ? (
                    <View style={[styles.viewChoices, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                        {(['shelf', 'list'] as const).map((mode) => {
                            const selected = viewMode === mode;
                            return (
                                <TouchableOpacity key={mode} ref={selected ? selectedViewRef : undefined} onPress={() => onViewModeChange(mode)} activeOpacity={0.8}
                                    accessibilityRole="button" accessibilityLabel={`${mode === 'shelf' ? 'Shelf' : 'List'} view`}
                                    accessibilityState={{ selected }}
                                    {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
                                    testID={`library-view-${mode}`}
                                    style={[styles.viewChoice, selected && { backgroundColor: colors.bgCard }]}>
                                    <Ionicons name={mode === 'shelf' ? 'library-outline' : 'list-outline'} size={16}
                                        color={selected ? colors.textPrimary : colors.textSecondary} />
                                    <Text style={[styles.controlText, { fontFamily: fonts.label, color: selected ? colors.textPrimary : colors.textSecondary }]}>
                                        {mode === 'shelf' ? 'Shelf' : 'List'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : null}
                {showAddButton ? (
                    <TouchableOpacity onPress={onAdd} activeOpacity={0.85}
                        style={[styles.addButton, { backgroundColor: colors.accent }]}
                        accessibilityRole="button" accessibilityLabel="Add a new book to your library"
                        accessibilityHint="Open the catalogue to find a book or add one manually">
                        <Text style={[styles.controlText, { fontFamily: fonts.label, color: colors.onAccent }]}>+ Add Book</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: LIBRARY_SPACING.medium,
        paddingBottom: LIBRARY_SPACING.medium,
    },
    mainRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: LIBRARY_RADIUS.control,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: LIBRARY_SPACING.medium },
    viewChoices: { flexDirection: 'row', padding: 3, borderRadius: LIBRARY_RADIUS.control, borderWidth: 1, flexShrink: 1 },
    viewChoice: { minHeight: 44, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    controlText: { fontSize: 13, lineHeight: 18 },
    addButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: LIBRARY_RADIUS.control, alignItems: 'center', justifyContent: 'center' },
    title: {
        fontSize: 28,
        lineHeight: 32,
        letterSpacing: -0.4,
        flexShrink: 1,
    },
});
