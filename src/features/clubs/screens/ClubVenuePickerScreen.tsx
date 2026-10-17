import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { withClubOrigin, clubHomeHref } from '@/features/clubs/navigation';
import { useAddClubVenueLink, useClubEventVenues, useClubPublicDetail } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { VenueCard } from '@/features/venues/components/VenueCard';
import { formatVenueType, VenueTypeBadge } from '@/features/venues/components/VenueTypeBadge';
import { useApprovedVenues } from '@/features/venues/hooks/useVenues';
import { clubManageColors as colors } from './manage/managePalette';

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
    const { clubId, returnTo, editorMode, eventId, editorReturnTo, manageTab, draft, clubOrigin } = useLocalSearchParams<{
        clubId: string;
        returnTo?: string;
        editorMode?: string;
        eventId?: string;
        editorReturnTo?: string;
        manageTab?: string;
        clubOrigin?: string;
        draft?: string;
    }>();
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
                router.replace(withClubOrigin(`/clubs/${clubId}/manage?tab=venues`, clubOrigin));
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
            router.replace(withClubOrigin(`${editorDestination}?${targetQuery}`, clubOrigin));
            return;
        }
        const target = returnTo && returnTo !== 'events' ? `/clubs/${clubId}/${returnTo}` : `/clubs/${clubId}/events`;
        router.replace(withClubOrigin(`${target}?preselectedVenueId=${venueId}`, clubOrigin));
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
    const backFallback = isManageVenueLinking ? withClubOrigin(`/clubs/${clubId}/manage?tab=venues`, clubOrigin) : returnTo === 'event-editor' ? withClubOrigin(editorDestinationWithQuery, clubOrigin) : clubHomeHref(clubId, clubOrigin);
    const backLabel = isManageVenueLinking
        ? 'Back to Manage Club venues'
        : returnTo === 'event-editor'
            ? 'Back to event editor'
            : 'Back to club';

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={backLabel} onPress={() => navigateBackOrFallback(router, backFallback)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="back-button">
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.textPrimary }]}>{isManageVenueLinking ? 'Link a venue' : 'Select a venue'}</Text>
                <View style={styles.headerSpacer} accessible={false} />
            </View>

            {linkError ? (
                <View style={[styles.linkError, { backgroundColor: colors.errorLight, borderColor: '#E8CFC8' }]} testID="club-venue-link-error" accessibilityRole="alert" accessibilityLiveRegion="polite">
                    <Text style={[styles.linkErrorText, { color: '#74271F' }]}>{linkError}</Text>
                </View>
            ) : null}

            {!hasVenues ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.textPrimary }]}>{isManageVenueLinking ? 'No approved venues available' : 'No venues registered'}</Text>
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
                            variant="editorial"
                            accessibilityHint="Links this venue to the club and returns to venue management."
                            subdued={Boolean((linkingVenueId || addClubVenueLink.isPending) && linkingVenueId !== venue.id)}
                            busy={linkingVenueId === venue.id}
                            onPress={linkingVenueId || addClubVenueLink.isPending
                                ? undefined
                                : (selectedVenue) => { void handleSelectVenue(selectedVenue.id); }}
                            rightLabel={linkingVenueId === venue.id ? 'Linking...' : undefined}
                            rightLabelAdornment={linkingVenueId === venue.id ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
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
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel={[
                                    venue.name,
                                    [venue.address_line1, venue.address_line2, venue.city].filter(Boolean).join(', '),
                                    venue.venue_type ? formatVenueType(venue.venue_type) : null,
                                    venueLink.is_primary ? 'Primary' : null,
                                    venue.verification_status === 'approved' ? 'Verified' : null,
                                ].filter(Boolean).join(', ')}
                                accessibilityHint="Selects this venue for the event and returns to the event editor."
                                style={[styles.venueCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                                testID={`venue-picker-item-${venueId}`}
                            >
                                <View style={styles.venueHeader}>
                                    <Text style={[styles.venueName, { color: colors.textPrimary }]}>{venue.name}</Text>
                                    {venueLink.is_primary ? (
                                        <View style={[styles.primaryBadge, { backgroundColor: colors.accentLight }]}>
                                            <Text style={[styles.primaryBadgeText, { color: colors.accent }]}>Primary</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {[venue.address_line1, venue.address_line2, venue.city].some(Boolean) ? (
                                    <Text style={[styles.venueAddress, { color: colors.textSecondary }]}>
                                        {[venue.address_line1, venue.address_line2, venue.city].filter(Boolean).join(', ')}
                                    </Text>
                                ) : null}
                                <View style={styles.venueFooter}>
                                    {venue.venue_type ? <VenueTypeBadge type={venue.venue_type} colors={colors} variant="editorial" /> : null}
                                    {venue.verification_status === 'approved' ? (
                                        <View style={[styles.verifiedBadge, { backgroundColor: colors.accentLight }]}>
                                            <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                                            <Text style={[styles.verifiedText, { color: colors.accent }]}>Verified</Text>
                                        </View>
                                    ) : null}
                                </View>
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
    content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, minHeight: 44 },
    iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, textAlign: 'center', fontFamily: 'Newsreader_600SemiBold', fontSize: 25, lineHeight: 31 },
    headerSpacer: { width: 44 },
    errorTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 24, lineHeight: 30, marginBottom: 8, textAlign: 'center' },
    errorBody: { maxWidth: 380, fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 21 },
    linkError: { marginBottom: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
    linkErrorText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
    emptyCard: { minHeight: 150, borderRadius: 16, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 23, justifyContent: 'center', alignItems: 'flex-start' },
    emptyTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 21, lineHeight: 26, marginBottom: 7 },
    emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    venuesList: { gap: 0 },
    venueCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
    venueHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 7 },
    venueName: { flex: 1, fontFamily: 'Newsreader_500Medium', fontSize: 19, lineHeight: 24 },
    primaryBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    primaryBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15 },
    venueAddress: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginBottom: 10 },
    venueFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
    verifiedBadge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
    verifiedText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
});
