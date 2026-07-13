import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useTheme } from '@/hooks/useTheme';
import { useAddClubVenueLink, useClubEventVenues, useClubPublicDetail } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { VenueCard } from '@/features/venues/components/VenueCard';
import { useApprovedVenues } from '@/features/venues/hooks/useVenues';

function getVenueLinkErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';

    if (/(duplicate|already linked|already exists|unique constraint|23505)/.test(message)) {
        return 'This venue is already linked to the club.';
    }
    if (/(row-level security|\brls\b|permission|not authorized|not allowed|42501|club role)/.test(message)) {
        return 'You do not have permission to link venues to this club.';
    }
    if (/(failed to fetch|network|offline|timed? ?out|connection)/.test(message)) {
        return 'Unable to connect. Check your network and try again.';
    }
    return 'Unable to link this venue right now. Please try again.';
}

export default function ClubVenuePickerScreen() {
    const { clubId, returnTo, editorMode, eventId, editorReturnTo, manageTab, draft } = useLocalSearchParams<{
        clubId: string;
        returnTo?: string;
        editorMode?: string;
        eventId?: string;
        editorReturnTo?: string;
        manageTab?: string;
        draft?: string;
    }>();
    const { colors } = useTheme();
    const isManageVenueLinking = returnTo === 'manage-venues';

    const { data: club, isLoading: isClubLoading, isError: isClubError, error: clubError } = useClubPublicDetail(clubId ?? null);
    const { data: linkedVenues = [], isLoading: isVenuesLoading, isError: isVenuesError, error: venuesError } = useClubEventVenues(clubId ?? null, !!clubId && !isManageVenueLinking);
    const { data: approvedVenues = [], isLoading: isApprovedVenuesLoading, isError: isApprovedVenuesError, error: approvedVenuesError } = useApprovedVenues({ limit: 50, offset: 0 });
    const addClubVenueLink = useAddClubVenueLink();
    const linkInFlightRef = useRef(false);
    const [linkingVenueId, setLinkingVenueId] = useState<string | null>(null);
    const [linkError, setLinkError] = useState<string | null>(null);

    const editorDestination = editorMode === 'edit' && eventId
        ? `/clubs/${clubId}/events/${eventId}/edit`
        : `/clubs/${clubId}/events/create`;
    const editorDestinationQuery = new URLSearchParams({
        ...(editorReturnTo ? { returnTo: editorReturnTo } : {}),
        ...(manageTab ? { manageTab } : {}),
        ...(draft ? { draft } : {}),
    }).toString();
    const editorDestinationWithQuery = editorDestinationQuery ? `${editorDestination}?${editorDestinationQuery}` : editorDestination;

    const handleSelectVenue = async (venueId: string) => {
        if (isManageVenueLinking) {
            if (linkInFlightRef.current || addClubVenueLink.isPending) return;
            linkInFlightRef.current = true;
            setLinkingVenueId(venueId);
            setLinkError(null);
            try {
                await addClubVenueLink.mutateAsync({ clubId, venueId });
                router.replace(`/clubs/${clubId}/manage?tab=venues`);
            } catch (error) {
                setLinkError(getVenueLinkErrorMessage(error));
            } finally {
                linkInFlightRef.current = false;
                setLinkingVenueId(null);
            }
            return;
        }
        if (returnTo === 'event-editor') {
            const targetQuery = new URLSearchParams({
                preselectedVenueId: venueId,
                ...(editorReturnTo ? { returnTo: editorReturnTo } : {}),
                ...(manageTab ? { manageTab } : {}),
                ...(draft ? { draft } : {}),
            }).toString();
            router.replace(`${editorDestination}?${targetQuery}`);
            return;
        }
        const target = returnTo && returnTo !== 'events' ? `/clubs/${clubId}/${returnTo}` : `/clubs/${clubId}/events`;
        router.replace(`${target}?preselectedVenueId=${venueId}`);
    };

    const isVenueDataLoading = isManageVenueLinking ? isApprovedVenuesLoading : isVenuesLoading;
    const isVenueDataError = isManageVenueLinking ? isApprovedVenuesError : isVenuesError;
    const venueDataError = isManageVenueLinking ? approvedVenuesError : venuesError;

    if (isClubLoading || isVenueDataLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} testID="venue-picker-loading" />
            </View>
        );
    }

    if (isClubError || !club) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load club</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(clubError, 'Unable to load this club right now.')}</Text>
            </View>
        );
    }

    if (isVenueDataError) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load venues</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(venueDataError, 'Unable to load venues right now.')}</Text>
            </View>
        );
    }

    const venuesToRender = isManageVenueLinking ? approvedVenues : linkedVenues;
    const hasVenues = venuesToRender.length > 0;
    const backFallback = isManageVenueLinking ? `/clubs/${clubId}/manage?tab=venues` : returnTo === 'event-editor' ? editorDestinationWithQuery : `/clubs/${clubId}`;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, backFallback)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="back-button">
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{isManageVenueLinking ? 'Link a venue' : 'Select a venue'}</Text>
                <View style={styles.headerSpacer} />
            </View>

            {linkError ? (
                <Text style={[styles.linkError, { color: colors.error }]} testID="club-venue-link-error">
                    {linkError}
                </Text>
            ) : null}

            {!hasVenues ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{isManageVenueLinking ? 'No approved venues available' : 'No venues registered'}</Text>
                    <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                        {isManageVenueLinking ? 'Approved venues will appear here when they are ready to link.' : 'This club does not have any linked venues yet. Admins can add venues from the Manage Club screen.'}
                    </Text>
                </View>
            ) : isManageVenueLinking ? (
                <View style={styles.venuesList}>
                    {approvedVenues.map((venue) => (
                        <VenueCard
                            key={venue.id}
                            venue={venue}
                            colors={colors}
                            onPress={linkingVenueId || addClubVenueLink.isPending
                                ? undefined
                                : (selectedVenue) => { void handleSelectVenue(selectedVenue.id); }}
                            rightLabel={linkingVenueId === venue.id ? 'Linking...' : undefined}
                        />
                    ))}
                </View>
            ) : (
                <View style={styles.venuesList}>
                    {linkedVenues.map((venueLink) => {
                        const venue = venueLink.venue;
                        if (!venue) return null;
                        const venueId = venueLink.venue_id;
                        if (!venueId) return null;
                        return (
                            <TouchableOpacity
                                key={venueId}
                                onPress={() => handleSelectVenue(venueId)}
                                style={[styles.venueCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                                testID={`venue-picker-item-${venueId}`}
                            >
                                <View style={styles.venueHeader}>
                                    <Text style={[styles.venueName, { color: colors.textPrimary }]}>{venue.name}</Text>
                                    {venueLink.is_primary ? (
                                        <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
                                            <Text style={[styles.badgeText, { color: colors.accent }]}>Primary</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text style={[styles.venueAddress, { color: colors.textSecondary }]}>
                                    {[venue.address_line1, venue.address_line2, venue.city].filter(Boolean).join(', ')}
                                </Text>
                                {venue.venue_type ? (
                                    <Text style={[styles.venueType, { color: colors.textTertiary }]}>
                                        {venue.venue_type.charAt(0).toUpperCase() + venue.venue_type.slice(1)}
                                    </Text>
                                ) : null}
                                {venue.verification_status === 'approved' ? (
                                    <View style={[styles.verifiedBadge, { backgroundColor: colors.accentLight }]}>
                                        <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                                        <Text style={[styles.verifiedText, { color: colors.accent }]}> Verified</Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' },
    headerSpacer: { width: 40 },
    errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    errorBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    linkError: { fontSize: 14, lineHeight: 20, marginBottom: 16, textAlign: 'center' },
    emptyCard: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    venuesList: { gap: 12 },
    venueCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
    venueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    venueName: { fontSize: 16, fontWeight: '700', flex: 1 },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    venueAddress: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
    venueType: { fontSize: 13, marginBottom: 8 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    verifiedText: { fontSize: 12, fontWeight: '700' },
});
