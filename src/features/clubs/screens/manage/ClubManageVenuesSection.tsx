import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClubVenueLink } from '@/features/clubs/services/clubsService';
import type { ThemeColors } from '@/hooks/useTheme';

export type PrimaryVenueAction = {
    venueId: string;
    state: 'saving' | 'error';
    errorMessage?: string;
};

export function ClubManageVenuesSection({
    venues,
    isLoading,
    isSavingLinks,
    primaryAction,
    colors,
    onAddVenue,
    onRemoveVenue,
    onSetPrimary,
    onRetryPrimary,
}: {
    venues: ClubVenueLink[];
    isLoading: boolean;
    isSavingLinks: boolean;
    primaryAction: PrimaryVenueAction | null;
    colors: ThemeColors;
    onAddVenue: () => void;
    onRemoveVenue: (venueId: string) => void;
    onSetPrimary: (venueId: string) => void;
    onRetryPrimary: (venueId: string) => void;
}) {
    const [removalId, setRemovalId] = useState<string | null>(null);
    const removalSubmitted = useRef(false);
    const submittedRemovalId = useRef<string | null>(null);
    const addButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
    const removalTarget = venues.find(link => (link.venue_id ?? link.venue?.id) === removalId && link.venue);
    useEffect(() => {
        if (removalId && (!removalTarget || isSavingLinks)) {
            setRemovalId(null);
            // The modal cannot restore focus to a Remove button that has disappeared.
            if (!removalTarget && Platform.OS === 'web') addButtonRef.current?.focus();
        }
    }, [removalId, removalTarget, isSavingLinks]);
    useEffect(() => {
        if (submittedRemovalId.current && !venues.some(link => (link.venue_id ?? link.venue?.id) === submittedRemovalId.current && link.venue)) {
            submittedRemovalId.current = null;
            // A slow refresh must not steal focus from another surviving control.
            if (Platform.OS === 'web' && (typeof document === 'undefined' || !document.activeElement || document.activeElement === document.body || document.activeElement === document.documentElement)) {
                addButtonRef.current?.focus();
            }
        }
    }, [venues]);
    const isPrimarySelectionPending = primaryAction?.state === 'saving';
    const hasActionRow = primaryAction && venues.some(link =>
        link.venue && (link.venue_id ?? link.venue.id) === primaryAction.venueId);

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Linked venues</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>Choose approved venues this club can use for in-person or hybrid events.</Text>
                </View>
                <TouchableOpacity ref={addButtonRef} accessibilityRole="button" onPress={onAddVenue} style={[styles.addButton, { borderColor: colors.accent }]} testID="manage-venues-add">
                    <Text style={[styles.addButtonText, { color: colors.accent }]}>Add</Text>
                </TouchableOpacity>
            </View>
            <View style={[styles.infoRow, { backgroundColor: colors.bgSecondary }]}>
                <Ionicons name="information-circle-outline" size={17} color={colors.textSecondary} />
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                    Primary venue is suggested for new in-person or hybrid events; existing events keep their saved venue.
                </Text>
            </View>
            {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
            {!isLoading && venues.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No venues are linked yet. Events can still use manual meetup locations.</Text>
            ) : null}
            {primaryAction && !hasActionRow ? (
                <View accessibilityLiveRegion="polite" style={[
                    styles.errorNotice,
                    { backgroundColor: isPrimarySelectionPending ? colors.bgSecondary : colors.errorLight },
                ]} testID="manage-venues-selection-status">
                    {isPrimarySelectionPending ? (
                        <>
                            <ActivityIndicator color={colors.accent} />
                            <Text accessibilityState={{ busy: true }} style={[styles.body, { color: colors.textSecondary }]}>Saving…</Text>
                        </>
                    ) : (
                        <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.error }]}>
                            Primary venue selection could not be confirmed. The selected venue is no longer shown in the linked list. Choose another linked venue, or use Add to link a venue.
                        </Text>
                    )}
                </View>
            ) : null}
            {venues.map((venueLink) => {
                const venue = venueLink.venue;
                const venueId = venueLink.venue_id ?? venue?.id;
                if (!venue || !venueId) return null;

                const isActionVenue = primaryAction?.venueId === venueId;
                const isSavingThisVenue = isActionVenue && primaryAction?.state === 'saving';
                const hasPrimaryError = isActionVenue && primaryAction?.state === 'error';

                return (
                    <View key={venueId} style={[styles.venueRow, { borderColor: colors.border }]}>
                        <View style={styles.venueBody}>
                            <Text style={[styles.venueName, { color: colors.textPrimary }]}>{venue.name}</Text>
                            {venueLink.is_primary ? (
                                <View style={[styles.primaryBadge, { backgroundColor: colors.accentLight }]}>
                                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                                    <Text testID={'manage-venue-primary-badge-' + venueId} style={[styles.primaryText, { color: colors.accent }]}>Primary venue</Text>
                                </View>
                            ) : null}
                            <Text style={[styles.venueMeta, { color: colors.textSecondary }]}>
                                {[venue.address_line1, venue.city].filter(Boolean).join(', ')}
                            </Text>
                            {hasPrimaryError ? (
                                <View accessibilityLiveRegion="polite" style={[styles.errorNotice, { backgroundColor: colors.errorLight }]}>
                                    <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.error }]}>
                                        {primaryAction.errorMessage}
                                    </Text>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        accessibilityLabel={'Try again to set ' + venue.name + ' as primary'}
                                        onPress={() => onRetryPrimary(venueId)}
                                        style={[styles.retryButton, { borderColor: colors.error }]}
                                        testID={'manage-venue-retry-' + venueId}
                                    >
                                        <Ionicons name="refresh-outline" size={15} color={colors.error} />
                                        <Text style={[styles.retryText, { color: colors.error }]}>Try again</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.venueActions}>
                            {(!venueLink.is_primary || isSavingThisVenue) && !hasPrimaryError ? (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={'Set ' + venue.name + ' as primary'}
                                    accessibilityState={{ disabled: isPrimarySelectionPending, ...(isSavingThisVenue ? { busy: true } : {}) }}
                                    disabled={isPrimarySelectionPending}
                                    onPress={() => onSetPrimary(venueId)}
                                    style={[
                                        styles.primaryActionButton,
                                        {
                                            backgroundColor: isSavingThisVenue ? colors.disabledLight : colors.accentLight,
                                            borderColor: isSavingThisVenue ? colors.border : colors.accent,
                                        },
                                    ]}
                                    testID={'manage-venue-set-primary-' + venueId}
                                >
                                    {isSavingThisVenue ? <ActivityIndicator size="small" color={colors.disabled} /> : <Ionicons name="star-outline" size={15} color={colors.accent} />}
                                    <Text accessibilityLiveRegion="polite" style={[styles.primaryActionText, { color: isSavingThisVenue ? colors.disabled : colors.accent }]}>
                                        {isSavingThisVenue ? 'Saving…' : 'Set as primary'}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={'Remove ' + venue.name}
                                accessibilityState={{ disabled: isSavingLinks }}
                                disabled={isSavingLinks}
                                onPress={() => {
                                    removalSubmitted.current = false;
                                    submittedRemovalId.current = null;
                                    setRemovalId(venueId);
                                }}
                                style={styles.removeButton}
                                testID={'manage-venue-remove-' + venueId}
                            >
                                <Text style={[styles.removeButtonLabel, { color: colors.error }]}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })}
            {removalTarget?.venue ? (
                <Modal transparent animationType="fade" visible accessibilityLabel="Remove venue?" accessibilityHint={'Unlink ' + removalTarget.venue.name + ' from this club. You can link it again using Add.'} onRequestClose={() => setRemovalId(null)}>
                    <View style={styles.modalOverlay}>
                        <View accessibilityViewIsModal style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <ScrollView>
                                <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Remove venue?</Text>
                                <Text style={[styles.body, { color: colors.textPrimary }]}>Unlink {removalTarget.venue.name} from this club? You can link it again using Add.</Text>
                                {removalTarget.is_primary ? <Text style={[styles.modalNotice, { color: colors.textSecondary }]}>The club will have no primary venue until you select another.</Text> : null}
                                <View style={styles.modalActions}>
                                    <TouchableOpacity accessibilityRole="button" onPress={() => setRemovalId(null)} testID="manage-venue-cancel-remove" style={[styles.modalButton, { borderColor: colors.border }]}>
                                        <Text style={[styles.addButtonText, { color: colors.textPrimary }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Confirm removal of ' + removalTarget.venue.name} testID="manage-venue-confirm-remove" style={[styles.modalButton, { backgroundColor: colors.error, borderColor: colors.error }]} onPress={() => {
                                        if (removalSubmitted.current || isSavingLinks || !removalId) return;
                                        removalSubmitted.current = true;
                                        submittedRemovalId.current = removalId;
                                        setRemovalId(null);
                                        onRemoveVenue(removalId);
                                    }}>
                                        <Text style={[styles.addButtonText, { color: '#FFFFFF' }]}>Remove venue</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 420, maxHeight: '90%', borderWidth: 1, borderRadius: 16, padding: 20 },
    modalNotice: { fontSize: 14, lineHeight: 20, marginTop: 12 },
    modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    modalButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    headerText: { flex: 1 },
    title: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 20 },
    addButton: { minWidth: 64, minHeight: 44, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
    addButtonText: { fontSize: 13, fontWeight: '800' },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 11, marginBottom: 2 },
    noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
    emptyText: { fontSize: 14, lineHeight: 20 },
    venueRow: { borderTopWidth: 1, paddingTop: 14, marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    venueBody: { flex: 1, minWidth: 0 },
    venueName: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
    venueMeta: { fontSize: 13, lineHeight: 18 },
    primaryBadge: { alignSelf: 'flex-start', minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 8, marginBottom: 4 },
    primaryText: { fontSize: 12, fontWeight: '800' },
    venueActions: { alignItems: 'flex-end', gap: 4 },
    primaryActionButton: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 12, paddingHorizontal: 9 },
    primaryActionText: { fontSize: 12, fontWeight: '800' },
    removeButton: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    removeButtonLabel: { fontSize: 12, fontWeight: '800' },
    errorNotice: { alignSelf: 'stretch', borderRadius: 10, padding: 9, gap: 6, marginTop: 8 },
    errorText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
    retryButton: { alignSelf: 'flex-start', minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
    retryText: { fontSize: 12, fontWeight: '800' },
});
