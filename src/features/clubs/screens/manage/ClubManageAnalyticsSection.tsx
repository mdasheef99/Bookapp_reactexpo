import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubPublicDetails, ClubBookNominationWithDetails } from '@/features/clubs/services/clubsService';
import type { ClubEventWithDetails } from '@/features/clubs/services/clubsService.types';

interface Props {
    club: ClubPublicDetails;
    membersCount: number;
    moderatorsCount: number;
    nominations: ClubBookNominationWithDetails[];
    events: ClubEventWithDetails[];
    isLoading: boolean;
}

export function ClubManageAnalyticsSection({ club, membersCount, moderatorsCount, nominations, events, isLoading }: Props) {
    const { colors } = useTheme();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    const activeNominations = nominations.filter((n) => n.status === 'active').length;
    const upcomingEvents = events.filter((e) => e.status === 'scheduled' && new Date(e.start_time) > new Date()).length;
    const pastEvents = events.filter((e) => e.status === 'cancelled' || new Date(e.start_time) <= new Date()).length;

    const StatCard = ({ label, value }: { label: string; value: string | number }) => (
        <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );

    return (
        <View>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club overview</Text>
                <View style={styles.statRow}>
                    <StatCard label="Members" value={membersCount} />
                    <StatCard label="Moderators" value={moderatorsCount} />
                </View>
                <View style={styles.statRow}>
                    <StatCard label="Active nominations" value={activeNominations} />
                    <StatCard label="Upcoming events" value={upcomingEvents} />
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Events</Text>
                <View style={styles.statRow}>
                    <StatCard label="Upcoming" value={upcomingEvents} />
                    <StatCard label="Past / Cancelled" value={pastEvents} />
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Current read</Text>
                {club.current_book_title ? (
                    <>
                        <Text style={[styles.currentBookTitle, { color: colors.textPrimary }]}>{club.current_book_title}</Text>
                        {club.current_book_authors && (
                            <Text style={[styles.currentBookMeta, { color: colors.textSecondary }]}>{club.current_book_authors.join(', ')}</Text>
                        )}
                    </>
                ) : (
                    <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No current book set.</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 10,
    },
    statRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    statCard: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
    },
    currentBookTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    currentBookMeta: {
        fontSize: 13,
        marginTop: 4,
    },
    placeholder: {
        fontSize: 14,
        fontStyle: 'italic',
    },
});
