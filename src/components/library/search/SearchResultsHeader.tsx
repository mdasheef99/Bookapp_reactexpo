import { StyleSheet, Text, View } from 'react-native';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton } from '@/components/library/ui';

export function SearchResultsHeader({
    showCachedNotice,
    providerNotice,
    countLabel,
    activeFiltersCount,
    filterOpen,
    sortOpen,
    onOpenFilter,
    onOpenSort,
}: {
    showCachedNotice: boolean;
    providerNotice: string | null;
    countLabel: string;
    activeFiltersCount: number;
    filterOpen: boolean;
    sortOpen: boolean;
    onOpenFilter: () => void;
    onOpenSort: () => void;
}) {
    const colors = useLibraryAppearance();
    return (
        <>
            {showCachedNotice && (
                <Text style={[LIBRARY_TEXT.caption, styles.notice, { color: colors.textSecondary }]}>Showing recent cached Google Books results.</Text>
            )}
            {providerNotice && (
                <Text style={[LIBRARY_TEXT.caption, styles.notice, { color: colors.textSecondary }]}>{providerNotice}</Text>
            )}
            <View style={styles.resultsHeader}>
                <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{countLabel}</Text>
                <View style={styles.resultControls}>
                    <BookButton label={activeFiltersCount > 0 ? `Filter (${activeFiltersCount})` : 'Filter'} variant="secondary"
                        selected={activeFiltersCount > 0} expanded={filterOpen} onPress={onOpenFilter} />
                    <BookButton label="Sort" variant="secondary" expanded={sortOpen} onPress={onOpenSort} />
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    resultsHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: LIBRARY_SPACING.xs, marginBottom: LIBRARY_SPACING.sm },
    resultControls: { flexDirection: 'row', gap: LIBRARY_SPACING.xs },
    notice: { marginBottom: LIBRARY_SPACING.sm },
});
