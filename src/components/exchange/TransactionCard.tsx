import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type {
    TransactionStatus,
    TransactionWithListing,
} from '@/features/exchange/services/transactionsService';
import type { ThemeColors } from '@/hooks/useTheme';

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

interface TransactionCardProps {
    txn: TransactionWithListing;
    userId: string;
    colors: ThemeColors;
}

export function TransactionCard({ txn, userId, colors }: TransactionCardProps) {
    const isLender = txn.lender_id === userId;
    const role = isLender ? 'Lending' : 'Borrowing';
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
            accessibilityRole="button"
            accessibilityLabel={`${book?.title ?? 'Unknown Book'} exchange details`}
        >
            {cover ? (
                <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
            ) : (
                <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: colors.bgSecondary }]}>
                    <Ionicons name="book-outline" size={28} color={colors.textTertiary} />
                </View>
            )}
            <View style={styles.info}>
                <Text style={[styles.bookTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {book?.title ?? 'Unknown Book'}
                </Text>
                {(book?.authors?.length ?? 0) > 0 && (
                    <Text style={[styles.bookAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
                        {book!.authors!.join(', ')}
                    </Text>
                )}
                <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
                        <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: `${roleColor}22`, borderColor: roleColor }]}>
                        <Text style={[styles.badgeText, { color: roleColor }]}>{role}</Text>
                    </View>
                </View>
                <Text style={[styles.dateText, { color: colors.textTertiary }]}>{date}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    cover: {
        width: 56,
        height: 76,
        borderRadius: 6,
    },
    coverPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
        gap: 4,
    },
    bookTitle: {
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 18,
    },
    bookAuthor: {
        fontSize: 12,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    dateText: {
        fontSize: 11,
        marginTop: 2,
    },
});
