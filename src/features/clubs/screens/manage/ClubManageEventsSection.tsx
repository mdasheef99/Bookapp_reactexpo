import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubEventWithDetails } from '@/features/clubs/services/clubsService.types';
import { formatClubEventStatus, formatClubEventTiming, formatClubEventType, getClubEventLocationLabel } from '../clubEvents.shared';
import type { FeedbackState } from './manageUtils';

interface Props {
    events: ClubEventWithDetails[];
    isLoading: boolean;
    canCreate: boolean;
    canManageEvent: (event: ClubEventWithDetails) => boolean;
    onCreate: () => void;
    onEdit: (eventId: string) => void;
    onCancel: (eventId: string) => Promise<void>;
    onDelete: (eventId: string) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

export function ClubManageEventsSection({ events, isLoading, canCreate, canManageEvent, onCreate, onEdit, onCancel, onDelete, onFeedback }: Props) {
    const { colors } = useTheme();
    const [activeEventId, setActiveEventId] = useState<string | null>(null);

    const upcoming = events.filter((e) => e.status === 'scheduled' && new Date(e.start_time) > new Date());
    const past = events.filter((e) => e.status === 'cancelled' || new Date(e.start_time) <= new Date());

    const handleCancel = (event: ClubEventWithDetails) => {
        Alert.alert(
            'Cancel this event?',
            `Cancel "${event.title}"? It will stay visible to members in a cancelled state.`,
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Cancel event',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            onFeedback(null);
                            setActiveEventId(event.id);
                            await onCancel(event.id);
                            onFeedback({ type: 'success', message: 'Event cancelled.' });
                        } catch (error) {
                            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to cancel event.' });
                        } finally {
                            setActiveEventId(null);
                        }
                    },
                },
            ],
        );
    };

    const handleDelete = (event: ClubEventWithDetails) => {
        Alert.alert(
            'Delete permanently?',
            `Delete "${event.title}"? This cannot be undone.`,
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            onFeedback(null);
                            setActiveEventId(event.id);
                            await onDelete(event.id);
                            onFeedback({ type: 'success', message: 'Event deleted.' });
                        } catch (error) {
                            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to delete event.' });
                        } finally {
                            setActiveEventId(null);
                        }
                    },
                },
            ],
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    const EventRow = ({ event }: { event: ClubEventWithDetails }) => (
        <View key={event.id} style={[styles.eventRow, { borderBottomColor: colors.border }]}>
            <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>{formatClubEventTiming(event)}</Text>
                <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>
                    {formatClubEventType(event.event_type)} · {getClubEventLocationLabel(event)}
                </Text>
                <View style={[styles.badge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.badgeText, { color: event.status === 'cancelled' ? colors.error : colors.accent }]}>
                        {formatClubEventStatus(event.status)}
                    </Text>
                </View>
            </View>
            {canManageEvent(event) && (
                <View style={styles.eventActions}>
                    <TouchableOpacity
                        testID={`manage-edit-event-${event.id}`}
                        onPress={() => onEdit(event.id)}
                        disabled={activeEventId === event.id}
                        style={[styles.actionButton, { borderColor: colors.accent, opacity: activeEventId === event.id ? 0.5 : 1 }]}
                    >
                        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Edit</Text>
                    </TouchableOpacity>
                    {event.status === 'scheduled' ? (
                        <TouchableOpacity
                            testID={`cancel-event-${event.id}`}
                            onPress={() => handleCancel(event)}
                            disabled={activeEventId === event.id}
                            style={[styles.actionButton, { borderColor: colors.error, opacity: activeEventId === event.id ? 0.5 : 1 }]}
                        >
                            <Text style={{ color: colors.error, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            testID={`delete-event-${event.id}`}
                            onPress={() => handleDelete(event)}
                            disabled={activeEventId === event.id}
                            style={[styles.actionButton, { borderColor: colors.error, opacity: activeEventId === event.id ? 0.5 : 1 }]}
                        >
                            <Text style={{ color: colors.error, fontWeight: '700', fontSize: 13 }}>Delete</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );

    return (
        <View>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.headerRow}>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Manage events</Text>
                        <Text style={[styles.placeholder, { color: colors.textSecondary }]}>Create, edit, and manage the club schedule in one place.</Text>
                    </View>
                    {canCreate && (
                        <TouchableOpacity
                            testID="manage-create-event"
                            onPress={onCreate}
                            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                        >
                            <Text style={styles.primaryButtonText}>Create event</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {upcoming.length > 0 && (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upcoming events</Text>
                    {upcoming.map((event) => (
                        <EventRow key={event.id} event={event} />
                    ))}
                </View>
            )}

            {past.length > 0 && (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Past & cancelled events</Text>
                    {past.map((event) => (
                        <EventRow key={event.id} event={event} />
                    ))}
                </View>
            )}

            {upcoming.length === 0 && past.length === 0 && (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Events</Text>
                    <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No events yet.</Text>
                </View>
            )}
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    headerInfo: {
        flex: 1,
    },
    eventRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: 1,
        gap: 10,
    },
    eventInfo: {
        flex: 1,
        gap: 4,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    eventMeta: {
        fontSize: 12,
        lineHeight: 18,
    },
    badge: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginTop: 4,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    eventActions: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 8,
    },
    actionButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    primaryButton: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13,
    },
    placeholder: {
        fontSize: 14,
        paddingVertical: 6,
    },
});
