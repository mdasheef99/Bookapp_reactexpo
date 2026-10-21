import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton, BookEmpty } from '@/components/library/ui';

export function SearchHeading({ offline }: { offline: boolean }) {
    const colors = useLibraryAppearance();
    return (
        <View style={styles.heading}>
            <Text accessibilityRole="header" role="heading" aria-level={1} style={[LIBRARY_TEXT.title, { color: colors.textPrimary }]}>Find books</Text>
            <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Search by title, author or ISBN.</Text>
            {offline && <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Offline · Search needs a connection.</Text>}
        </View>
    );
}

export function SearchIdleState() {
    const colors = useLibraryAppearance();
    return (
        <View style={styles.state}>
            <Text style={[LIBRARY_TEXT.heading, styles.centerText, { color: colors.textPrimary }]}>Find your next book</Text>
            <Text style={[LIBRARY_TEXT.body, styles.centerText, { color: colors.textSecondary }]}>
                Search books, authors or ISBNs, then add a title to your library or wishlist.
            </Text>
        </View>
    );
}

export function SearchShortQueryState() {
    return (
        <View style={styles.state}>
            <BookEmpty title="Keep typing" message="Enter at least 3 characters to search." />
        </View>
    );
}

export function SearchNoResults({ offline, providerNotice, onAddManually }: { offline: boolean; providerNotice: string | null; onAddManually: () => void }) {
    const colors = useLibraryAppearance();
    return (
        <View style={styles.state}>
            <BookEmpty title={offline ? 'Search needs a connection' : 'No books found'}
                message={offline ? 'Reconnect to search the catalogues.' : 'Try another search or change the filters.'} />
            {!offline && providerNotice && (
                <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.caption, styles.centerText, { color: colors.textSecondary }]}>{providerNotice}</Text>
            )}
            {!offline && <BookButton testID="library-manual-entry-open" label="Add it manually"
                variant="primary" onPress={onAddManually} />}
            {!offline && <Text style={[LIBRARY_TEXT.body, styles.centerText, { color: colors.textSecondary }]}>
                {"Can't find it? Save a title and author to your library."}
            </Text>}
        </View>
    );
}

export function SearchErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
    return (
        <View accessibilityRole="alert" style={styles.state}>
            <BookEmpty title="Search couldn’t finish" message={message ?? undefined}
                actionLabel="Try again" onAction={onRetry} />
        </View>
    );
}

export function SearchLoadingFooter({ loading }: { loading: boolean }) {
    const colors = useLibraryAppearance();
    if (!loading) return null;
    return (
        <View style={styles.loadingFooter}>
            <ActivityIndicator color={colors.accent} accessibilityLabel="Loading more results" />
        </View>
    );
}

const styles = StyleSheet.create({
    heading: { gap: LIBRARY_SPACING.xs, marginBottom: LIBRARY_SPACING.md },
    state: { alignItems: 'center', paddingVertical: LIBRARY_SPACING.xl, gap: LIBRARY_SPACING.md },
    centerText: { textAlign: 'center' },
    loadingFooter: { paddingVertical: LIBRARY_SPACING.lg, alignItems: 'center' },
});
