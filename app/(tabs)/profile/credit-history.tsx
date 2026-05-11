import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { creditService, type CreditEvent, type CreditEventType } from '@/features/credits/services/creditService';
import { useTheme } from '@/hooks/useTheme';

const PAGE_SIZE = 20;

type CreditFilter = 'all' | 'earned' | 'spent' | 'holds';

const FILTERS: Array<{ key: CreditFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'earned', label: 'Earned' },
    { key: 'spent', label: 'Spent' },
    { key: 'holds', label: 'Holds' },
];

export function shouldRefetchCurrentHistoryPageOnRefresh(offset: number): boolean {
    return offset === 0;
}

const EVENT_LABELS: Record<CreditEventType, string> = {
    signup_bonus: 'Signup bonus',
    lend_completed: 'Lending reward',
    borrow_spent: 'Borrowed book',
    referral_bonus: 'Referral bonus',
    admin_adjustment: 'Admin adjustment',
    hold_placed: 'Credit hold placed',
    hold_released: 'Credit hold released',
};

const EVENT_DETAILS: Record<CreditEventType, string> = {
    signup_bonus: 'Welcome credit added to your account.',
    lend_completed: 'You earned a credit by completing an exchange as lender.',
    borrow_spent: 'A credit was spent on a completed exchange.',
    referral_bonus: 'You earned a credit from a referral.',
    admin_adjustment: 'Your balance was adjusted by BookTalks support.',
    hold_placed: 'A credit is reserved while an exchange request is active.',
    hold_released: 'A reserved credit returned to your available balance.',
};

function formatAmount(amount: number): string {
    if (amount > 0) return `+${amount}`;
    return String(amount);
}

function formatCreditNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function filterEvent(event: CreditEvent, filter: CreditFilter) {
    const amount = Number(event.amount);
    if (filter === 'all') return true;
    if (filter === 'earned') return amount > 0 && event.event_type !== 'hold_released';
    if (filter === 'spent') return event.event_type === 'borrow_spent' || (event.event_type === 'admin_adjustment' && amount < 0);
    return event.event_type === 'hold_placed' || event.event_type === 'hold_released';
}

function CreditEventRow({ event, runningBalance }: { event: CreditEvent; runningBalance: number }) {
    const { colors } = useTheme();
    const amount = Number(event.amount);
    const amountColor = amount > 0 ? '#10B981' : amount < 0 ? colors.error : colors.textTertiary;

    return (
        <View style={[styles.eventRow, { borderBottomColor: colors.border }]}>
            <View style={styles.eventBody}>
                <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>
                    {EVENT_LABELS[event.event_type]}
                </Text>
                <Text style={[styles.eventDetail, { color: colors.textSecondary }]}>
                    {EVENT_DETAILS[event.event_type]}
                </Text>
                <Text style={[styles.eventDate, { color: colors.textTertiary }]}>
                    {formatDate(event.created_at)}
                </Text>
                <Text style={[styles.runningBalance, { color: colors.textTertiary }]}>
                    Balance after: {formatCreditNumber(runningBalance)}
                </Text>
            </View>
            <Text style={[styles.eventAmount, { color: amountColor }]}>
                {formatAmount(amount)}
            </Text>
        </View>
    );
}

export default function CreditHistoryScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();
    const userId = session?.user?.id ?? null;
    const [offset, setOffset] = useState(0);
    const [events, setEvents] = useState<CreditEvent[]>([]);
    const [activeFilter, setActiveFilter] = useState<CreditFilter>('all');

    const balanceQuery = useQuery({
        queryKey: ['creditBalance', userId],
        queryFn: () => creditService.getCreditBalance(userId!),
        enabled: !!userId,
        staleTime: 60_000,
    });

    const historyQuery = useQuery({
        queryKey: ['creditHistory', userId, offset],
        queryFn: () => creditService.getCreditHistory(userId!, PAGE_SIZE, offset),
        enabled: !!userId,
    });

    const isRefreshing = balanceQuery.isRefetching || historyQuery.isRefetching;

    useEffect(() => {
        if (!historyQuery.data) return;
        setEvents(current => {
            if (offset === 0) return historyQuery.data.events;
            const knownIds = new Set(current.map(event => event.id));
            const nextEvents = historyQuery.data.events.filter(event => !knownIds.has(event.id));
            return [...current, ...nextEvents];
        });
    }, [historyQuery.data, offset]);

    const summary = useMemo(() => {
        const balance = balanceQuery.data;
        return {
            available: balance?.available ?? 0,
            held: balance?.held ?? 0,
            earned: balance?.lifetime_earned ?? 0,
            spent: balance?.lifetime_spent ?? 0,
        };
    }, [balanceQuery.data]);

    const eventsWithRunningBalance = useMemo(() => {
        let balanceAfterNewerEvents = summary.available;

        return events.map(event => {
            const runningBalance = balanceAfterNewerEvents;
            balanceAfterNewerEvents -= Number(event.amount);
            return { event, runningBalance };
        });
    }, [events, summary.available]);

    const filteredEvents = useMemo(
        () => eventsWithRunningBalance.filter(item => filterEvent(item.event, activeFilter)),
        [activeFilter, eventsWithRunningBalance]
    );

    const refresh = () => {
        balanceQuery.refetch();
        if (shouldRefetchCurrentHistoryPageOnRefresh(offset)) {
            historyQuery.refetch();
            return;
        }

        setEvents([]);
        setOffset(0);
    };

    const loadMore = () => {
        if (historyQuery.data?.hasMore && !historyQuery.isFetching) {
            setOffset(events.length);
        }
    };

    return (
        <ScreenBackground>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Credit History</Text>
                <View style={styles.headerSpacer} />
            </View>

            <FlatList
                data={filteredEvents}
                keyExtractor={item => item.event.id}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.accent} />
                }
                ListHeaderComponent={
                    <View style={styles.content}>
                        <GlassCard padding={20} borderRadius={20}>
                            <View style={styles.summaryPrimary}>
                                <Text style={[styles.availableValue, { color: colors.accent }]}>
                                    {summary.available}
                                </Text>
                                <Text style={[styles.availableLabel, { color: colors.textSecondary }]}>
                                    available
                                </Text>
                            </View>
                            <View style={[styles.summaryGrid, { borderTopColor: colors.border }]}>
                                <View style={styles.summaryCell}>
                                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{summary.held}</Text>
                                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>On hold</Text>
                                </View>
                                <View style={styles.summaryCell}>
                                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{summary.earned}</Text>
                                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Earned</Text>
                                </View>
                                <View style={styles.summaryCell}>
                                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{summary.spent}</Text>
                                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Spent</Text>
                                </View>
                            </View>
                        </GlassCard>

                        <View style={styles.filterRow}>
                            {FILTERS.map(filter => {
                                const isActive = activeFilter === filter.key;
                                return (
                                    <TouchableOpacity
                                        key={filter.key}
                                        style={[
                                            styles.filterChip,
                                            {
                                                backgroundColor: isActive ? colors.accent : colors.bgCard,
                                                borderColor: isActive ? colors.accent : colors.border,
                                            },
                                        ]}
                                        onPress={() => setActiveFilter(filter.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${filter.label} credit events`}
                                    >
                                        <Text style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : colors.textPrimary }]}>
                                            {filter.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.listItem}>
                        <GlassCard padding={0} borderRadius={16}>
                            <CreditEventRow event={item.event} runningBalance={item.runningBalance} />
                        </GlassCard>
                    </View>
                )}
                ListEmptyComponent={
                    historyQuery.isLoading ? (
                        <ActivityIndicator color={colors.accent} style={styles.loading} />
                    ) : historyQuery.isError ? (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Could not load history</Text>
                            <Button title="Retry" onPress={refresh} variant="secondary" />
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                {events.length > 0 ? 'No activity for this filter' : 'No credit activity yet'}
                            </Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {events.length > 0
                                    ? 'Try a different credit activity type.'
                                    : 'Credits from signup, exchange holds, lending rewards, and completed borrows will appear here.'}
                            </Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    historyQuery.data?.hasMore ? (
                        <View style={styles.footer}>
                            <Button
                                title="Load more"
                                onPress={loadMore}
                                variant="secondary"
                                loading={historyQuery.isFetching}
                            />
                        </View>
                    ) : <View style={styles.footerSpacer} />
                }
                contentContainerStyle={styles.listContent}
            />
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 40,
    },
    listContent: {
        paddingBottom: 32,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    summaryPrimary: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    availableValue: {
        fontSize: 44,
        fontWeight: '800',
    },
    availableLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 2,
    },
    summaryGrid: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingTop: 16,
        marginTop: 16,
    },
    summaryCell: {
        flex: 1,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 10,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
    },
    filterChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '700',
    },
    listItem: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 0,
    },
    eventBody: {
        flex: 1,
        paddingRight: 12,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    eventDetail: {
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
    },
    eventDate: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 6,
    },
    runningBalance: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    eventAmount: {
        fontSize: 18,
        fontWeight: '800',
    },
    loading: {
        marginTop: 32,
    },
    emptyState: {
        paddingHorizontal: 32,
        paddingVertical: 36,
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    footerSpacer: {
        height: 12,
    },
});
