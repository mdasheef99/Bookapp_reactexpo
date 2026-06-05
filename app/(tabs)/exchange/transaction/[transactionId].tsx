import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
    TransactionRatingPrompt,
    type RatingDraft,
} from '@/components/exchange/TransactionRatingPrompt';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    useApproveTransaction,
    useCancelTransaction,
    useCompleteTransaction,
    useDeclineTransaction,
    useFileDispute,
    useTransactionDetails,
    useTransitionStatus,
} from '@/features/exchange/hooks/useTransactions';
import {
    useMyTransactionRating,
    useSubmitTransactionRating,
} from '@/features/exchange/hooks/useRatings';
import type { TransactionStatus } from '@/features/exchange/services/transactionsService';
import {
    resolveTransactionActions,
    type TransactionAction,
    type TransactionActionTone,
    type TransactionActorRole,
    type TransactionMessageTone,
} from '@/features/exchange/utils/transactionActionResolver';
import { useTheme } from '@/hooks/useTheme';
import { navigateBackOrFallback } from '@/lib/navigation';

const STATUS_LABELS: Record<TransactionStatus, string> = {
    requested: 'ðŸ“¬ Requested',
    approved: 'âœ… Approved',
    declined: 'âŒ Declined',
    cancelled: 'ðŸš« Cancelled',
    payment_pending: 'ðŸ’³ Payment Pending',
    ready_to_ship: 'ðŸ“¦ Ready to Ship',
    shipped: 'ðŸšš Shipped',
    delivered: 'ðŸ“® Delivered',
    completed: 'ðŸŽ‰ Completed',
    disputed: 'âš ï¸ Disputed',
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
    requested: '#F59E0B',
    approved: '#10B981',
    declined: '#EF4444',
    cancelled: '#6B7280',
    payment_pending: '#3B82F6',
    ready_to_ship: '#8B5CF6',
    shipped: '#6366F1',
    delivered: '#06B6D4',
    completed: '#10B981',
    disputed: '#EF4444',
};

const SHIPPING_TIMELINE_STEPS: TransactionStatus[] = [
    'requested',
    'approved',
    'payment_pending',
    'ready_to_ship',
    'shipped',
    'delivered',
    'completed',
];

const MEETUP_TIMELINE_STEPS: TransactionStatus[] = [
    'requested',
    'approved',
    'delivered',
    'completed',
];

const DELIVERY_LABELS: Record<string, string> = {
    meetup: 'ðŸ¤ Meetup',
    porter: 'ðŸš² Porter',
    dunzo: 'ðŸš— Dunzo',
};

function ProfileCard({
    label,
    profile,
    colors,
}: {
    label: string;
    profile: { avatar_url?: string | null; display_name: string; city?: string | null } | null;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{label}</Text>
            {profile ? (
                <View style={styles.profileRow}>
                    {profile.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.bgSecondary }]}>
                            <Ionicons name="person" size={18} color={colors.textTertiary} />
                        </View>
                    )}
                    <View>
                        <Text style={[styles.profileName, { color: colors.textPrimary }]}>{profile.display_name}</Text>
                        {profile.city ? (
                            <Text style={[styles.profileCity, { color: colors.textTertiary }]}>ðŸ“ {profile.city}</Text>
                        ) : null}
                    </View>
                </View>
            ) : (
                <Text style={[styles.profileCity, { color: colors.textTertiary }]}>Unknown user</Text>
            )}
        </View>
    );
}

function TimelineBar({
    status,
    deliveryType,
    colors,
}: {
    status: TransactionStatus;
    deliveryType: string;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    const isTerminal = ['declined', 'cancelled', 'disputed'].includes(status);
    const steps = deliveryType === 'meetup' ? MEETUP_TIMELINE_STEPS : SHIPPING_TIMELINE_STEPS;

    if (isTerminal) {
        return (
            <View style={[styles.terminalBanner, { backgroundColor: `${STATUS_COLORS[status]}22`, borderColor: `${STATUS_COLORS[status]}55` }]}>
                <Text style={[styles.terminalText, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
            </View>
        );
    }

    const currentIdx = steps.indexOf(status);
    return (
        <View style={styles.timeline}>
            {steps.map((step, idx) => {
                const done = currentIdx >= 0 && idx < currentIdx;
                const active = idx === currentIdx;
                const color = done || active ? colors.accent : colors.border;
                return (
                    <View key={step} style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: color, borderColor: color }]}>
                            {done && <Ionicons name="checkmark" size={10} color="#FFF" />}
                        </View>
                        {idx < steps.length - 1 && (
                            <View style={[styles.timelineLine, { backgroundColor: done ? colors.accent : colors.border }]} />
                        )}
                    </View>
                );
            })}
        </View>
    );
}

function ActionButtons({
    status,
    role,
    deliveryType,
    colors,
    onApprove,
    onDecline,
    onCancel,
    onComplete,
    onDispute,
    onTransition,
}: {
    status: TransactionStatus;
    role: TransactionActorRole;
    deliveryType: string;
    colors: ReturnType<typeof useTheme>['colors'];
    onApprove: () => void;
    onDecline: () => void;
    onCancel: () => void;
    onComplete: () => void;
    onDispute: () => void;
    onTransition: (newStatus: TransactionStatus, label: string) => void;
}) {
    const resolution = resolveTransactionActions({ status, role, deliveryType });

    if (resolution.kind === 'message') {
        const isSuccess = resolution.tone === 'success';
        return (
            <View style={[styles.infoBox, { backgroundColor: isSuccess ? '#10B98122' : colors.bgSecondary }]}>
                <Text style={[styles.infoText, { color: getMessageColor(resolution.tone, colors) }]}>
                    {isSuccess ? 'ðŸŽ‰ ' : ''}{resolution.message}
                </Text>
            </View>
        );
    }

    const isSingleAction = resolution.actions.length === 1;
    return (
        <View style={isSingleAction ? undefined : styles.btnRow}>
            {resolution.actions.map(action => (
                <TouchableOpacity
                    key={`${action.key}-${action.label}`}
                    testID={action.key === 'transition' ? 'exchange-transaction-primary-action' : undefined}
                    onPress={() => handleResolvedAction(action, {
                        onApprove,
                        onDecline,
                        onCancel,
                        onComplete,
                        onDispute,
                        onTransition,
                    })}
                    style={[
                        styles.btn,
                        isSingleAction && styles.btnFull,
                        action.variant === 'outline' && styles.btnOutline,
                        getActionButtonStyle(action, colors),
                    ]}
                >
                    <Text style={[styles.btnText, { color: action.variant === 'outline' ? getActionColor(action.tone, colors) : '#FFF' }]}>
                        {`${getActionPrefix(action)}${action.label}`}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

function getActorRole(isLender: boolean, isBorrower: boolean): TransactionActorRole {
    if (isLender) return 'lender';
    if (isBorrower) return 'borrower';
    return 'viewer';
}

function getActionColor(tone: TransactionActionTone, colors: ReturnType<typeof useTheme>['colors']) {
    if (tone === 'danger') return '#EF4444';
    if (tone === 'success') return '#10B981';
    return colors.accent;
}

function getActionButtonStyle(action: TransactionAction, colors: ReturnType<typeof useTheme>['colors']) {
    const color = getActionColor(action.tone, colors);
    if (action.variant === 'outline') return { borderColor: color };
    return { backgroundColor: color };
}

function getActionPrefix(action: TransactionAction) {
    if (action.key === 'decline') return '❌ ';
    if (action.key === 'approve') return '✅ ';
    if (action.key === 'cancel') return '🚫 ';
    if (action.key === 'complete') return '🎉 ';
    if (action.nextStatus === 'shipped') return '🚚 ';
    if (action.nextStatus === 'delivered' && action.label === 'Confirm Delivery') return '📮 ';
    return '📬 ';
}

function getMessageColor(tone: TransactionMessageTone, colors: ReturnType<typeof useTheme>['colors']) {
    if (tone === 'success') return '#10B981';
    if (tone === 'muted') return colors.textTertiary;
    return colors.textSecondary;
}

function handleResolvedAction(
    action: TransactionAction,
    handlers: {
        onApprove: () => void;
        onDecline: () => void;
        onCancel: () => void;
        onComplete: () => void;
        onDispute: () => void;
        onTransition: (newStatus: TransactionStatus, label: string) => void;
    }
) {
    if (action.key === 'approve') handlers.onApprove();
    if (action.key === 'decline') handlers.onDecline();
    if (action.key === 'cancel') handlers.onCancel();
    if (action.key === 'complete') handlers.onComplete();
    if (action.key === 'dispute') handlers.onDispute();
    if (action.key === 'transition' && action.nextStatus) {
        handlers.onTransition(action.nextStatus, action.label);
    }
}

export default function TransactionDetailScreen() {
    const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
    const { colors } = useTheme();
    const { session } = useAuth();
    const [isDisputeFormOpen, setIsDisputeFormOpen] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const currentUserId = session?.user?.id ?? null;

    const { data: txn, isLoading, isError, refetch } = useTransactionDetails(transactionId ?? null);
    const approveMutation = useApproveTransaction();
    const declineMutation = useDeclineTransaction();
    const cancelMutation = useCancelTransaction();
    const completeMutation = useCompleteTransaction();
    const transitionMutation = useTransitionStatus();
    const fileDisputeMutation = useFileDispute();
    const ratingQuery = useMyTransactionRating(transactionId ?? null, currentUserId);
    const submitRatingMutation = useSubmitTransactionRating();

    const anyPending =
        approveMutation.isPending ||
        declineMutation.isPending ||
        cancelMutation.isPending ||
        completeMutation.isPending ||
        fileDisputeMutation.isPending ||
        transitionMutation.isPending;

    if (isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (isError || !txn) {
        return (
            <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>Transaction not found</Text>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/(tabs)/exchange/my-transactions')} style={[styles.backBtn, { backgroundColor: colors.accent }]}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isLender = currentUserId === txn.lender_id;
    const isBorrower = currentUserId === txn.borrower_id;
    const role = getActorRole(isLender, isBorrower);
    const status = txn.status;
    const book = txn.listing?.book;
    const ratingTargetUserId = isLender ? txn.borrower_id : isBorrower ? txn.lender_id : null;
    const ratingTargetName = isLender
        ? txn.borrower?.display_name ?? 'the borrower'
        : txn.lender?.display_name ?? 'the lender';
    const pickupVenueAddress = txn.pickup_venue
        ? [txn.pickup_venue.address_line1, txn.pickup_venue.address_line2, txn.pickup_venue.city].filter(Boolean).join(', ')
        : '';

    function confirm(title: string, message: string, onConfirm: () => void) {
        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', style: 'destructive', onPress: onConfirm },
        ]);
    }

    function handleApprove() {
        approveMutation.mutate(
            { transactionId: txn!.id, actorId: currentUserId! },
            {
                onSuccess: () => Alert.alert('âœ… Approved!', 'You approved the exchange request.', [{ text: 'OK', onPress: () => refetch() }]),
                onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to approve'),
            }
        );
    }

    function handleDecline() {
        confirm('Decline Request?', 'The borrower\'s credit will be refunded.', () => {
            declineMutation.mutate(
                { transactionId: txn!.id, actorId: currentUserId! },
                {
                    onSuccess: () => Alert.alert('Request Declined', undefined, [{ text: 'OK', onPress: () => refetch() }]),
                    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to decline'),
                }
            );
        });
    }

    function handleCancel() {
        confirm('Cancel Exchange?', 'Your credit hold will be released.', () => {
            cancelMutation.mutate(
                { transactionId: txn!.id, actorId: currentUserId! },
                {
                    onSuccess: () => Alert.alert('Exchange Cancelled', undefined, [{ text: 'OK', onPress: () => refetch() }]),
                    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to cancel'),
                }
            );
        });
    }

    function handleComplete() {
        confirm('Complete Exchange?', 'This will transfer your 1 credit to the lender.', () => {
            completeMutation.mutate(
                { transactionId: txn!.id, actorId: currentUserId! },
                {
                    onSuccess: () => Alert.alert('ðŸŽ‰ Exchange Complete!', 'Thank you for using BookTalks!', [{ text: 'OK', onPress: () => refetch() }]),
                    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to complete'),
                }
            );
        });
    }

    function handleTransition(newStatus: TransactionStatus, label: string) {
        transitionMutation.mutate(
            { transactionId: txn!.id, newStatus, actorId: currentUserId! },
            {
                onSuccess: () => Alert.alert(`Marked as ${label}`, undefined, [{ text: 'OK', onPress: () => refetch() }]),
                onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to update'),
            }
        );
    }

    function handleOpenDispute() {
        setIsDisputeFormOpen(true);
    }

    function handleSubmitDispute() {
        const reason = disputeReason.trim();
        if (!currentUserId || !reason) {
            Alert.alert('Reason required', 'Please describe what happened before filing a dispute.');
            return;
        }

        fileDisputeMutation.mutate(
            { transactionId: txn!.id, actorId: currentUserId, reason },
            {
                onSuccess: () => {
                    setIsDisputeFormOpen(false);
                    setDisputeReason('');
                    Alert.alert('Dispute filed', 'We marked this exchange as disputed.', [{ text: 'OK', onPress: () => refetch() }]);
                },
                onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to file dispute'),
            }
        );
    }

    function handleSubmitRating(draft: RatingDraft) {
        if (!currentUserId || !ratingTargetUserId) return;
        submitRatingMutation.mutate(
            {
                transactionId: txn!.id,
                fromUserId: currentUserId,
                toUserId: ratingTargetUserId,
                rating: draft.rating,
                tags: draft.tags,
                review: draft.review,
            },
            {
                onSuccess: () => Alert.alert('Rating submitted', 'Thanks for helping keep BookTalks exchanges trustworthy.'),
                onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to submit rating'),
            }
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/(tabs)/exchange/my-transactions')} style={styles.headerBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Exchange Request</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[status]}22` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
                </View>

                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <TimelineBar status={status} deliveryType={txn.delivery_type} colors={colors} />
                </View>

                <View style={[styles.card, styles.bookCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    {txn.listing?.photos?.[0] ? (
                        <Image source={{ uri: txn.listing.photos[0] }} style={styles.bookCover} />
                    ) : (
                        <View style={[styles.bookCover, styles.bookCoverPlaceholder, { backgroundColor: colors.bgSecondary }]}>
                            <Ionicons name="book-outline" size={24} color={colors.textTertiary} />
                        </View>
                    )}
                    <View style={styles.bookInfo}>
                        <Text style={[styles.bookTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                            {book?.title ?? 'Unknown Book'}
                        </Text>
                        {book?.authors?.length ? (
                            <Text style={[styles.bookAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
                                {book.authors.join(', ')}
                            </Text>
                        ) : null}
                        <Text style={[styles.deliveryTag, { color: colors.accent }]}>
                            {DELIVERY_LABELS[txn.delivery_type] ?? txn.delivery_type}
                        </Text>
                    </View>
                </View>

                <ProfileCard label="Lender" profile={txn.lender} colors={colors} />
                <ProfileCard label="Borrower" profile={txn.borrower} colors={colors} />

                {txn.pickup_venue ? (
                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Pickup venue</Text>
                        <Text style={[styles.pickupVenueName, { color: colors.textPrimary }]}>
                            {txn.pickup_venue.name}
                        </Text>
                        {pickupVenueAddress ? (
                            <Text style={[styles.messageText, { color: colors.textSecondary }]}>
                                {pickupVenueAddress}
                            </Text>
                        ) : null}
                    </View>
                ) : null}

                {txn.message ? (
                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Message</Text>
                        <Text style={[styles.messageText, { color: colors.textSecondary }]}>{txn.message}</Text>
                    </View>
                ) : null}

                {txn.awb_number ? (
                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Tracking</Text>
                        <Text style={[styles.messageText, { color: colors.textSecondary }]}>AWB: {txn.awb_number}</Text>
                        {txn.delivery_service ? (
                            <Text style={[styles.messageText, { color: colors.textTertiary }]}>via {txn.delivery_service}</Text>
                        ) : null}
                    </View>
                ) : null}

                {status === 'disputed' ? (
                    <View style={[styles.disputeBanner, { backgroundColor: '#EF444422', borderColor: '#EF444455' }]}>
                        <Text style={styles.disputeTitle}>This exchange is in dispute</Text>
                        <Text style={[styles.disputeCopy, { color: colors.textSecondary }]}>
                            Resolve this only after both participants agree the issue is settled.
                        </Text>
                    </View>
                ) : null}

                {isDisputeFormOpen ? (
                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Dispute reason</Text>
                        <TextInput
                            value={disputeReason}
                            onChangeText={setDisputeReason}
                            placeholder="What happened?"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            style={[
                                styles.disputeInput,
                                {
                                    borderColor: colors.border,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.bgSecondary,
                                },
                            ]}
                        />
                        <View style={styles.disputeActions}>
                            <TouchableOpacity
                                onPress={() => setIsDisputeFormOpen(false)}
                                style={[styles.disputeSecondaryBtn, { borderColor: colors.border }]}
                            >
                                <Text style={[styles.disputeSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSubmitDispute}
                                disabled={fileDisputeMutation.isPending}
                                style={[styles.disputePrimaryBtn, { backgroundColor: '#EF4444' }]}
                            >
                                <Text style={styles.disputePrimaryText}>
                                    {fileDisputeMutation.isPending ? 'Submitting...' : 'Submit dispute'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}

                {status === 'completed' && ratingTargetUserId ? (
                    <TransactionRatingPrompt
                        colors={colors}
                        otherPartyName={ratingTargetName}
                        existingRating={ratingQuery.data}
                        isSubmitting={submitRatingMutation.isPending}
                        onSubmit={handleSubmitRating}
                    />
                ) : null}

                <View style={styles.bottomSpacer} />
            </ScrollView>

            <View style={[styles.cta, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
                {anyPending ? (
                    <ActivityIndicator size="large" color={colors.accent} />
                ) : (
                    <ActionButtons
                        status={status}
                        role={role}
                        deliveryType={txn.delivery_type}
                        colors={colors}
                        onApprove={handleApprove}
                        onDecline={handleDecline}
                        onCancel={handleCancel}
                        onComplete={handleComplete}
                        onDispute={handleOpenDispute}
                        onTransition={handleTransition}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
    headerBack: { padding: 4, marginRight: 12 },
    headerTitle: { fontSize: 17, fontWeight: '600' },
    scrollContent: { paddingBottom: 24 },
    statusBadge: { alignSelf: 'center', marginTop: 16, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    statusText: { fontSize: 15, fontWeight: '700' },
    card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
    bookCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    bookCover: { width: 60, height: 80, borderRadius: 6 },
    bookCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    bookInfo: { flex: 1 },
    bookTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    bookAuthor: { fontSize: 13, marginBottom: 4 },
    deliveryTag: { fontSize: 13, fontWeight: '600' },
    sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    profileName: { fontSize: 15, fontWeight: '600' },
    profileCity: { fontSize: 13, marginTop: 2 },
    pickupVenueName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    messageText: { fontSize: 14, lineHeight: 20 },
    timeline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timelineItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    timelineDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    timelineLine: { flex: 1, height: 2, marginHorizontal: 2 },
    terminalBanner: { margin: 16, marginBottom: 0, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    terminalText: { fontSize: 16, fontWeight: '700' },
    cta: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, borderTopWidth: 1 },
    btnRow: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    btnFull: { width: '100%' },
    btnOutline: { borderWidth: 1.5, backgroundColor: 'transparent' },
    btnText: { fontSize: 15, fontWeight: '700' },
    infoBox: { padding: 14, borderRadius: 12, alignItems: 'center' },
    infoText: { fontSize: 14, fontWeight: '500' },
    disputeBanner: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
    disputeTitle: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
    disputeCopy: { fontSize: 13, lineHeight: 18, marginTop: 4 },
    disputeInput: { minHeight: 88, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top', fontSize: 14 },
    disputeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    disputeSecondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    disputeSecondaryText: { fontSize: 14, fontWeight: '700' },
    disputePrimaryBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    disputePrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    errorText: { fontSize: 16, marginTop: 8 },
    backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
    backBtnText: { color: '#FFF', fontWeight: '600' },
    bottomSpacer: { height: 120 },
});
