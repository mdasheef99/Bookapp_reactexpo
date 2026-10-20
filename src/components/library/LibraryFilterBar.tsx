import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LibraryFilter, LibraryFilterChip } from '@/features/books/utils/libraryShelf';
import { useLibraryTypography } from './LibraryTypography';
import { useLibraryAppearance } from './LibraryAppearance';

type LibraryFilterBarProps = {
    chips: LibraryFilterChip[];
    activeFilter: LibraryFilter;
    onChange: (filter: LibraryFilter) => void;
    disabled?: boolean;
};

export function LibraryFilterBar({ chips, activeFilter, onChange, disabled = false }: LibraryFilterBarProps) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();

    return (
        // Wrapping keeps all filters visible at narrow widths, large text and high counts.
        <View style={styles.filterRow}>
            {chips.map((chip) => {
                const isActive = chip.key === activeFilter;

                return (
                    <TouchableOpacity
                        key={chip.key}
                        onPress={() => onChange(chip.key)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive, disabled }}
                        {...(Platform.OS === 'web' ? { 'aria-pressed': isActive } : {})}
                        accessibilityLabel={`${chip.label}, ${chip.count} books`}
                        style={[
                            styles.filterChip,
                            {
                                backgroundColor: isActive ? colors.accent : colors.bgCard,
                                borderColor: isActive ? colors.accent : colors.border,
                                opacity: disabled && !isActive ? 0.5 : 1,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                { color: isActive ? colors.onAccent : colors.textSecondary, fontFamily: fonts.label },
                            ]}
                        >
                            {chip.label}
                        </Text>
                        <Text style={[styles.filterChipCountText, { color: isActive ? colors.onAccent : colors.textSecondary, fontFamily: fonts.body }]}>
                            {chip.count}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        minHeight: 44,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 8,
        gap: 6,
    },
    filterChipText: {
        fontSize: 12,
        lineHeight: 18,
    },
    filterChipCountText: {
        fontSize: 12,
        lineHeight: 18,
        fontVariant: ['tabular-nums'],
    },
});
