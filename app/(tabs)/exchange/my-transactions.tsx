import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useMyTransactionsWithListings } from '@/features/exchange/hooks/useTransactions';
import type {
    TransactionWithListing,
    TransactionStatus,
} from '@/features/exchange/services/transactionsService';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TransactionStatus, string> = {
    requested: '#F59E0B',
    approved: '#10B981',
    payment_pending: '#3B82F6',
    ready_to_ship: '#8B5CF6',
    shipped: '#6366F1',
    delivered: '#059669',
    completed: '#10B981',
    declined: '#EF4444',
    cancelled: '#94A3B8',
    disputed: '#DC2626',
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
    requested: 'Requested',
    approved: 'Approved',
    payment_pending: 'Payment Pending',
    ready_to_ship: 'Ready to Ship',
    shipped: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
};

type Segment = 'all' | 'borrowing' | 'lending';
const SEGMENTS: { value: Segment; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'borrowing', label: 'Borrowing' },
    { value: 'lending', label: 'Lending' },
];

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.cover, { backgroundColor: colors.bgSecondary }]} />
            <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skeletonLine, { width: '75%', backgroundColor: colors.bgSecondary }]} />
                <View style={[styles.skeletonLine, { width: '50%', backgroundColor: colors.bgSecondary }]} />
                <View style={[styles.skeletonBadge, { backgroundColor: colors.bgSecondary }]} />
            </View>
        </View>
    );
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

function TransactionCard({
    txn,
    userId,
    colors,
}: {
    txn: TransactionWithListing;
    userId: string;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    const isLender = txn.lender_id === userId;
    const role = isLender ? '📤 Lending' : '📥 Borrowing';
    const roleColor = isLender ? '#10B981' : '#6366F1';
    const book = txn.listing?.book ?? null;
    const cover = txn.listing?.photos?.[0] ?? null;
    const statusColor = STATUS_COLORS[txn.status];
    const statusLabel = STATUS_LABELS[txn.status];
    const date = new Date(txn.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
    });

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => router.push(`/(tabs)/exchange/transaction/${txn.id}`)}
            activeOpacity={0.7}
        >
            {cover ? (
                <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
            ) : (
                <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: colors.bgSecondary }]}>
                    <Ionicons name="book-outline" size={28} color={colors.textTertiary} />
                </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.bookTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {book?.title ?? 'Unknown Book'}
                </Text>
                {(book?.authors?.length ?? 0) > 0 && (
                    <Text style={[styles.bookAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
                        {book!.authors!.join(', ')}
                    </Text>
                )}
                <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                        <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: roleColor + '22', borderColor: roleColor }]}>
                        <Text style={[styles.badgeText, { color: roleColor }]}>{role}</Text>
                    </View>
                </View>
                <Text style={[styles.dateText, { color: colors.textTertiary }]}>{date}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
    );
}


// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MyTransactionsScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();
    const userId = session?.user?.id ?? null;
    const [segment, setSegment] = useState<Segment>('all');

    const { data: transactions, isLoading, isError, refetch, isRefetching } =
        useMyTransactionsWithListings(userId);

    const filtered = useMemo(() => {
        if (!transactions) return [];
        if (segment === 'borrowing') return transactions.filter(t => t.borrower_id === userId);
        if (segment === 'lending') return transactions.filter(t => t.lender_id === userId);
        return transactions;
    }, [transactions, segment, userId]);

    return (
        <LinearGradient
            colors={['#6366F1', '#4F46E5', colors.bgPrimary]}
            locations={[0, 0.15, 0.45]}
            style={styles.container}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Exchanges</Text>
            </View>

            {/* Segment filter */}
            <View style={[styles.segmentBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {SEGMENTS.map(seg => (
                    <TouchableOpacity
                        key={seg.value}
                        style={[styles.segmentBtn, segment === seg.value && { backgroundColor: colors.accent }]}
                        onPress={() => setSegment(seg.value)}
                    >
                        <Text style={[
                            styles.segmentText,
                            { color: segment === seg.value ? '#FFF' : colors.textSecondary },
                        ]}>
                            {seg.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.listPad}>
                    {[0, 1, 2, 3].map(i => <SkeletonCard key={i} colors={colors} />)}
                </View>
            ) : isError ? (
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Failed to load</Text>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                        onPress={() => refetch()}
                    >
                        <Text style={styles.actionBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : filtered.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="swap-horizontal-outline" size={56} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No exchanges yet</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Browse books and request an exchange to get started
                    </Text>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.actionBtnText}>Browse Books</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listPad}
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={refetch}
                            tintColor={colors.accent}
                        />
                    }
                    renderItem={({ item }) => (
                        <TransactionCard txn={item} userId={userId!} colors={colors} />
                    )}
                />
            )}
        </LinearGradient>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 52,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerBack: { padding: 4, marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
    segmentBar: {
        flexDirection: 'row',
        margin: 16,
        marginTop: 12,
        borderRadius: 10,
        borderWidth: 1,
        padding: 3,
        gap: 3,
    },
    segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segmentText: { fontSize: 13, fontWeight: '600' },
    listPad: { padding: 16, paddingTop: 8, gap: 10 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    cover: { width: 56, height: 76, borderRadius: 6 },
    coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    skeletonLine: { height: 12, borderRadius: 6 },
    skeletonBadge: { height: 22, width: 80, borderRadius: 10 },
    bookTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
    bookAuthor: { fontSize: 12 },
    badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    dateText: { fontSize: 11, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
    emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    actionBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
    actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
