import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubPublicDetails, ClubBookNominationWithDetails } from '@/features/clubs/services/clubsService';
import { formatNominationStatus, getBookCoverUrl, hasNominationVotingClosed } from './manageUtils';

interface Props {
    club: ClubPublicDetails;
    nominations: ClubBookNominationWithDetails[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isAdmin: boolean;
    onFinalize: (nominationId: string) => Promise<void>;
    onSetCurrentBook: (nominationId: string) => Promise<void>;
    onShowOverride: () => void;
}

export function ClubManageCurrentBookSection({ club, nominations, isLoading, isError, error, isAdmin, onFinalize, onSetCurrentBook, onShowOverride }: Props) {
    const { colors } = useTheme();
    const [activeNominationId, setActiveNominationId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    if (isError && error) {
        const message = error instanceof Error ? error.message : 'Something went wrong loading nominations.';
        return (
            <View style={styles.errorCard}>
                <Text style={[styles.errorText, { color: colors.error }]}>{message}</Text>
            </View>
        );
    }

    return (
        <View>
            {club.current_book_id ? (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Current book</Text>
                    <Text style={[styles.currentBook, { color: colors.textPrimary }]}>{club.current_book_title}</Text>
                    {club.current_book_authors && (
                        <Text style={[styles.authors, { color: colors.textSecondary }]}>{club.current_book_authors.join(', ')}</Text>
                    )}
                </View>
            ) : (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Current book</Text>
                    <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No current book is set.</Text>
                </View>
            )}

            {nominations.length > 0 && (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Nominations</Text>
                    {nominations.map((nom) => {
                        const isVotingClosed = hasNominationVotingClosed(nom.voting_ends_at);
                        const canFinalize = isAdmin && nom.status === 'active' && isVotingClosed;
                        const canSetCurrent = isAdmin && nom.status === 'active' && !isVotingClosed;
                        const isCurrentBook = !!club.current_book_id && club.current_book_id === nom.book_id;
                        const coverUrl = nom.book?.cover_url
                            ? getBookCoverUrl({ volumeInfo: { imageLinks: { thumbnail: nom.book.cover_url } } } as any)
                            : null;

                        return (
                            <View key={nom.id} style={[styles.nominationRow, { borderBottomColor: colors.border }]}>
                                {coverUrl ? (
                                    <Image source={{ uri: coverUrl }} style={styles.nominationCover} resizeMode="cover" />
                                ) : (
                                    <View style={[styles.nominationCover, styles.nominationCoverPlaceholder, { backgroundColor: colors.bgSecondary }]}>
                                        <Text style={[styles.coverPlaceholderText, { color: colors.textTertiary }]}>No cover</Text>
                                    </View>
                                )}

                                <View style={styles.nominationInfo}>
                                    <Text style={[styles.nominationTitle, { color: colors.textPrimary }]} testID={`manage-current-book-title-${nom.id}`}>
                                        {nom.book?.title || 'Untitled nomination'}
                                    </Text>
                                    <Text style={[styles.nominationMeta, { color: colors.textSecondary }]}>
                                        {formatNominationStatus(nom.status)} · {nom.vote_count ?? 0} votes
                                        {isVotingClosed && nom.status === 'active' && (
                                            <Text testID={`manage-current-book-closed-${nom.id}`}> · Voting closed</Text>
                                        )}
                                        {nom.status === 'active' && !isVotingClosed && (
                                            <Text testID={`manage-current-book-active-${nom.id}`}> · Voting open</Text>
                                        )}
                                    </Text>
                                    {nom.nominatorProfile?.display_name && (
                                        <Text style={[styles.nominationNominator, { color: colors.textTertiary }]}>
                                            Nominated by {nom.nominatorProfile.display_name}
                                        </Text>
                                    )}
                                    {isCurrentBook && (
                                        <Text style={[styles.nominationSelected, { color: colors.accent }]} testID={`manage-current-book-current-${nom.id}`}>
                                            Current book
                                        </Text>
                                    )}
                                    {!isCurrentBook && nom.status === 'active' && isVotingClosed && (
                                        <Text style={[styles.nominationSelected, { color: colors.accent }]} testID={`manage-current-book-selected-${nom.id}`}>
                                            Selected: will be finalized when confirmed
                                        </Text>
                                    )}
                                </View>

                                {canFinalize && (
                                    <TouchableOpacity
                                        testID={`manage-finalize-${nom.id}`}
                                        onPress={async () => {
                                            setActiveNominationId(nom.id);
                                            await onFinalize(nom.id);
                                            setActiveNominationId(null);
                                        }}
                                        disabled={activeNominationId === nom.id}
                                        style={[styles.finalizeButton, { backgroundColor: colors.accent, opacity: activeNominationId === nom.id ? 0.5 : 1 }]}
                                    >
                                        <Text style={styles.finalizeButtonText}>{activeNominationId === nom.id ? 'Finalizing...' : 'Finalize'}</Text>
                                    </TouchableOpacity>
                                )}

                                {canSetCurrent && (
                                    <TouchableOpacity
                                        testID={`manage-set-current-${nom.id}`}
                                        onPress={async () => {
                                            setActiveNominationId(nom.id);
                                            await onSetCurrentBook(nom.id);
                                            setActiveNominationId(null);
                                        }}
                                        disabled={activeNominationId === nom.id}
                                        style={[styles.finalizeButton, { backgroundColor: colors.accent, opacity: activeNominationId === nom.id ? 0.5 : 1 }]}
                                    >
                                        <Text style={styles.finalizeButtonText}>{activeNominationId === nom.id ? 'Saving...' : 'Set as current'}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}

            {isAdmin && (
                <TouchableOpacity
                    testID="manage-toggle-override"
                    onPress={onShowOverride}
                    style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                >
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Manual override</Text>
                    <Text style={[styles.placeholder, { color: colors.textSecondary }]}>Set a current book directly without nominations or voting.</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    errorCard: {
        padding: 14,
        borderRadius: 12,
        marginBottom: 14,
    },
    errorText: {
        fontSize: 14,
    },
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    currentBook: {
        fontSize: 15,
        fontWeight: '600',
    },
    authors: {
        fontSize: 13,
        marginTop: 2,
    },
    placeholder: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    nominationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        gap: 10,
    },
    nominationCover: {
        width: 48,
        height: 72,
        borderRadius: 4,
    },
    nominationCoverPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    coverPlaceholderText: {
        fontSize: 10,
        textAlign: 'center',
    },
    nominationInfo: {
        flex: 1,
        paddingRight: 10,
    },
    nominationTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    nominationMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    nominationNominator: {
        fontSize: 12,
        marginTop: 2,
        fontStyle: 'italic',
    },
    nominationSelected: {
        fontSize: 12,
        marginTop: 2,
        fontWeight: '700',
    },
    finalizeButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    finalizeButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13,
    },
});
