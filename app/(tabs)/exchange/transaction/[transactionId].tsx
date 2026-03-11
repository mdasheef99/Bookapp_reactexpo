import React from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTransactionDetails } from '@/features/exchange/hooks/useTransactions';
import {
    useApproveTransaction,
    useDeclineTransaction,
    useCancelTransaction,
    useCompleteTransaction,
    useTransitionStatus,
} from '@/features/exchange/hooks/useTransactions';
import type { TransactionStatus } from '@/features/exchange/services/transactionsService';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TransactionStatus, string> = {
    requested: '📬 Requested',
    approved: '✅ Approved',
    declined: '❌ Declined',
    cancelled: '🚫 Cancelled',
    payment_pending: '💳 Payment Pending',
    ready_to_ship: '📦 Ready to Ship',
    shipped: '🚚 Shipped',
    delivered: '📮 Delivered',
    completed: '🎉 Completed',
    disputed: '⚠️ Disputed',
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

// Ordered steps for the progress timeline
const SHIPPING_TIMELINE_STEPS: TransactionStatus[] = [
    'requested', 'approved', 'payment_pending',
    'ready_to_ship', 'shipped', 'delivered', 'completed',
];

const MEETUP_TIMELINE_STEPS: TransactionStatus[] = [
    'requested', 'approved', 'delivered', 'completed',
];

const DELIVERY_LABELS: Record<string, string> = {
    meetup: '🤝 Meetup',
    porter: '🚲 Porter',
    dunzo: '🚗 Dunzo',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
                            <Text style={[styles.profileCity, { color: colors.textTertiary }]}>📍 {profile.city}</Text>
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
            <View style={[styles.terminalBanner, { backgroundColor: STATUS_COLORS[status] + '22', borderColor: STATUS_COLORS[status] + '55' }]}>
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

// ─── Action Buttons ───────────────────────────────────────────────────────────

function ActionButtons({
    status,
    isLender,
    isBorrower,
    deliveryType,
    colors,
    onApprove,
    onDecline,
    onCancel,
    onComplete,
    onTransition,
}: {
    status: TransactionStatus;
    isLender: boolean;
    isBorrower: boolean;
    deliveryType: string;
    colors: ReturnType<typeof useTheme>['colors'];
    onApprove: () => void;
    onDecline: () => void;
    onCancel: () => void;
    onComplete: () => void;
    onTransition: (newStatus: TransactionStatus, label: string) => void;
}) {
    if (deliveryType !== 'meetup' && ['payment_pending', 'ready_to_ship', 'shipped'].includes(status)) {
        return (
            <View style={[styles.infoBox, { backgroundColor: colors.bgSecondary }]}>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>Meetup-only exchange: delivery-based progress is not currently supported in-app.</Text>
            </View>
        );
    }
    if (status === 'requested') {
        if (isLender) {
            return (
                <View style={styles.btnRow}>
                    <TouchableOpacity onPress={onDecline} style={[styles.btn, styles.btnOutline, { borderColor: '#EF4444' }]}>
                        <Text style={[styles.btnText, { color: '#EF4444' }]}>❌ Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onApprove} style={[styles.btn, { backgroundColor: '#10B981' }]}>
                        <Text style={[styles.btnText, { color: '#FFF' }]}>✅ Approve</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        if (isBorrower) {
            return (
                <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.btnFull, { backgroundColor: '#EF4444' }]}>
                    <Text style={[styles.btnText, { color: '#FFF' }]}>🚫 Cancel Request</Text>
                </TouchableOpacity>
            );
        }
    }
    if (status === 'approved') {
        if (isBorrower) {
            if (deliveryType !== 'meetup') {
                return (
                    <View style={[styles.infoBox, { backgroundColor: colors.bgSecondary }]}>
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>Meetup-only exchange: this request can&apos;t move into payment or delivery steps in-app yet.</Text>
                    </View>
                );
            }
            const nextStatus: TransactionStatus = 'delivered';
            const label = 'Confirm Meetup';
            return (
                <TouchableOpacity testID="exchange-transaction-primary-action" onPress={() => onTransition(nextStatus, label)} style={[styles.btn, styles.btnFull, { backgroundColor: colors.accent }]}> 
                    <Text style={[styles.btnText, { color: '#FFF' }]}>📬 {label}</Text>
                </TouchableOpacity>
            );
        }
        if (isLender) {
            return (
                <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.btnFull, { backgroundColor: '#EF4444' }]}>
                    <Text style={[styles.btnText, { color: '#FFF' }]}>🚫 Cancel</Text>
                </TouchableOpacity>
            );
        }
    }
    if (status === 'ready_to_ship' && isLender) {
        return (
            <TouchableOpacity onPress={() => onTransition('shipped', 'Shipped')} style={[styles.btn, styles.btnFull, { backgroundColor: colors.accent }]}>
                <Text style={[styles.btnText, { color: '#FFF' }]}>🚚 Mark as Shipped</Text>
            </TouchableOpacity>
        );
    }
    if (status === 'shipped' && isBorrower) {
        return (
            <TouchableOpacity onPress={() => onTransition('delivered', 'Delivered')} style={[styles.btn, styles.btnFull, { backgroundColor: colors.accent }]}>
                <Text style={[styles.btnText, { color: '#FFF' }]}>📮 Confirm Delivery</Text>
            </TouchableOpacity>
        );
    }
    if (status === 'delivered') {
        return (
            <TouchableOpacity onPress={onComplete} style={[styles.btn, styles.btnFull, { backgroundColor: '#10B981' }]}>
                <Text style={[styles.btnText, { color: '#FFF' }]}>🎉 Complete Exchange</Text>
            </TouchableOpacity>
        );
    }
    if (status === 'completed') {
        return (
            <View style={[styles.infoBox, { backgroundColor: '#10B98122' }]}>
                <Text style={[styles.infoText, { color: '#10B981' }]}>🎉 Exchange successfully completed!</Text>
            </View>
        );
    }
    // Terminal / no action
    return (
        <View style={[styles.infoBox, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.infoText, { color: colors.textTertiary }]}>No actions available for this status.</Text>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TransactionDetailScreen() {
    const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
    const { colors } = useTheme();
    const { session } = useAuth();
    const currentUserId = session?.user?.id ?? null;

    const { data: txn, isLoading, isError, refetch } = useTransactionDetails(transactionId ?? null);
    const approveMutation = useApproveTransaction();
    const declineMutation = useDeclineTransaction();
    const cancelMutation = useCancelTransaction();
    const completeMutation = useCompleteTransaction();
    const transitionMutation = useTransitionStatus();

    const anyPending =
        approveMutation.isPending || declineMutation.isPending ||
        cancelMutation.isPending || completeMutation.isPending ||
        transitionMutation.isPending;

    // ── Loading / Error ───────────────────────────────────────────────────────
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
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.accent }]}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isLender = currentUserId === txn.lender_id;
    const isBorrower = currentUserId === txn.borrower_id;
    const status = txn.status;
    const book = txn.listing?.book;

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
                onSuccess: () => Alert.alert('✅ Approved!', 'You approved the exchange request.', [{ text: 'OK', onPress: () => refetch() }]),
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
                    onSuccess: () => Alert.alert('🎉 Exchange Complete!', 'Thank you for using BookTalks!', [{ text: 'OK', onPress: () => refetch() }]),
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

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Exchange Request</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
                </View>

                {/* Timeline */}
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <TimelineBar status={status} deliveryType={txn.delivery_type} colors={colors} />
                </View>

                {/* Book info */}
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

                {/* Profiles */}
                <ProfileCard label="Lender" profile={txn.lender} colors={colors} />
                <ProfileCard label="Borrower" profile={txn.borrower} colors={colors} />

                {/* Message */}
                {txn.message ? (
                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Message</Text>
                        <Text style={[styles.messageText, { color: colors.textSecondary }]}>{txn.message}</Text>
                    </View>
                ) : null}

                {/* Tracking (if available) */}
                {txn.awb_number ? (
                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Tracking</Text>
                        <Text style={[styles.messageText, { color: colors.textSecondary }]}>AWB: {txn.awb_number}</Text>
                        {txn.delivery_service ? (
                            <Text style={[styles.messageText, { color: colors.textTertiary }]}>via {txn.delivery_service}</Text>
                        ) : null}
                    </View>
                ) : null}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Action buttons */}
            <View style={[styles.cta, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
                {anyPending ? (
                    <ActivityIndicator size="large" color={colors.accent} />
                ) : (
                    <ActionButtons
                        status={status}
                        isLender={isLender}
                        isBorrower={isBorrower}
                        deliveryType={txn.delivery_type}
                        colors={colors}
                        onApprove={handleApprove}
                        onDecline={handleDecline}
                        onCancel={handleCancel}
                        onComplete={handleComplete}
                        onTransition={handleTransition}
                    />
                )}
            </View>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    errorText: { fontSize: 16, marginTop: 8 },
    backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
    backBtnText: { color: '#FFF', fontWeight: '600' },
    bgSecondary: {},
});
