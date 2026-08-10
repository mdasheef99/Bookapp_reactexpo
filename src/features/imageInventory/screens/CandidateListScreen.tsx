import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { OwnerUxClientError } from '../api/ownerUxService';
import { CandidateCard } from '../components/CandidateCard';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import {
    type ImageInventoryIdentity,
    useOwnerInventoryCandidates,
} from '../queries/ownerUxQueries';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';

const inaccessibleCodes = new Set(['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND']);

function Reviews({ identity }: { identity: ImageInventoryIdentity }) {
    const router = useRouter();
    const { colors } = useTheme();
    const { isOffline } = useNetworkStatus();
    const [cursor, setCursor] = useState<string | null>(null);
    const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
    const [cursorFailure, setCursorFailure] = useState(false);
    const seen = useRef(new Set<string>());
    const firstPageScopeVersion = useRef<number | null>(null);
    const query = useOwnerInventoryCandidates(identity, {
        scope: 'needs_review',
        attention: 'all',
        pageSize: 20,
        cursor,
    });
    const unavailable = query.error instanceof OwnerUxClientError
        && inaccessibleCodes.has(query.error.code);
    const next = query.data?.pageInfo.nextCursor ?? null;
    const goNext = () => {
        if (!next) return;
        if (seen.current.has(next)) {
            setCursorFailure(true);
            return;
        }
        seen.current.add(next);
        setCursorHistory((current) => [...current, cursor]);
        setCursor(next);
    };
    const goBack = () => {
        const previous = cursorHistory.at(-1) ?? null;
        if (cursor) seen.current.delete(cursor);
        setCursorHistory((current) => current.slice(0, -1));
        setCursor(previous);
        setCursorFailure(false);
    };
    const restart = () => {
        seen.current.clear();
        setCursor(null);
        setCursorHistory([]);
        setCursorFailure(false);
    };
    useEffect(() => {
        const version = query.data?.scopeVersion;
        if (!version) return;
        if (cursor === null) {
            firstPageScopeVersion.current = version;
            return;
        }
        if (firstPageScopeVersion.current !== version) restart();
    }, [cursor, query.data?.scopeVersion]);
    return (
        <ScreenBackground>
            <FlatList
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}
                data={query.data?.items ?? []}
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews
                keyExtractor={(item) => item.candidateId}
                renderItem={({ item }) => (
                    <CandidateCard
                        candidate={item}
                        onPress={() => router.push(inventoryRoutes.candidate(
                            item.sessionId,
                            item.candidateId,
                        ))}
                    />
                )}
                ListHeaderComponent={(
                    <View style={{ gap: 8, paddingBottom: 8 }}>
                        <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>
                            Books needing review
                        </Text>
                        {isOffline ? <Text selectable style={{ color: colors.textSecondary }}>May be out of date · reconnect before editing.</Text> : null}
                    </View>
                )}
                ListEmptyComponent={query.isLoading ? (
                    <View style={{ alignItems: 'center', gap: 10, padding: 24 }}>
                        <ActivityIndicator color={colors.accent} />
                        <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Loading private candidates…</Text>
                    </View>
                ) : unavailable ? (
                    <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.textSecondary }}>This private review list is unavailable.</Text>
                ) : query.error || cursorFailure ? (
                    <View style={{ gap: 12 }}>
                        <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.textSecondary }}>Books could not be loaded.</Text>
                        <Button title="Retry" onPress={() => { setCursorFailure(false); void query.refetch(); }} />
                    </View>
                ) : (
                    <Text selectable style={{ color: colors.textSecondary }}>Nothing to review</Text>
                )}
                ListFooterComponent={query.data?.items.length ? (
                    <View style={{ gap: 10, paddingTop: 8 }}>
                        {cursorFailure ? (
                            <View style={{ gap: 10 }}>
                                <Text selectable style={{ color: colors.error }}>The next page changed. Retry from the first page.</Text>
                                <Button title="Restart review list" variant="secondary" onPress={restart} />
                            </View>
                        ) : null}
                        {cursorHistory.length ? <Button title="Previous page" variant="secondary" onPress={goBack} /> : null}
                        {next ? <Button title="Next page" variant="secondary" onPress={goNext} disabled={cursorFailure || query.isFetching} /> : null}
                    </View>
                ) : null}
            />
        </ScreenBackground>
    );
}

export function InventoryReviewsScreen() {
    return <InventoryAccessBoundary>{(identity) => <Reviews identity={identity} />}</InventoryAccessBoundary>;
}
