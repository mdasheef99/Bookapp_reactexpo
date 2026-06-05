import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TransactionCard } from '@/components/exchange/TransactionCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyTransactionsWithListings } from '@/features/exchange/hooks/useTransactions';
import { useTheme } from '@/hooks/useTheme';
import { navigateBackOrFallback } from '@/lib/navigation';

type Segment = 'all' | 'borrowing' | 'lending';

const SEGMENTS: { value: Segment; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'borrowing', label: 'Borrowing' },
    { value: 'lending', label: 'Lending' },
];

function SkeletonCard({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.cover, { backgroundColor: colors.bgSecondary }]} />
            <View style={styles.skeletonBody}>
                <View style={[styles.skeletonLine, { width: '75%', backgroundColor: colors.bgSecondary }]} />
                <View style={[styles.skeletonLine, { width: '50%', backgroundColor: colors.bgSecondary }]} />
                <View style={[styles.skeletonBadge, { backgroundColor: colors.bgSecondary }]} />
            </View>
        </View>
    );
}

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
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.headerBack} onPress={() => navigateBackOrFallback(router, '/(tabs)/exchange')}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Exchanges</Text>
            </View>

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
                        onPress={() => navigateBackOrFallback(router, '/(tabs)/exchange')}
                    >
                        <Text style={styles.actionBtnText}>Browse Books</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listPad}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    headerBack: {
        padding: 4,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
    },
    segmentBar: {
        flexDirection: 'row',
        margin: 16,
        marginTop: 12,
        borderRadius: 10,
        borderWidth: 1,
        padding: 3,
        gap: 3,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '600',
    },
    listPad: {
        padding: 16,
        paddingTop: 8,
        gap: 10,
    },
    separator: {
        height: 10,
    },
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
    skeletonBody: {
        flex: 1,
        gap: 8,
    },
    skeletonLine: {
        height: 12,
        borderRadius: 6,
    },
    skeletonBadge: {
        height: 22,
        width: 80,
        borderRadius: 10,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    actionBtn: {
        marginTop: 8,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 10,
    },
    actionBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
});
