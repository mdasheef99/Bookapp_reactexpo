import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { StoreViewItem } from '../contracts/storeViewContracts';
import {
    EFFECTIVE_STATE_LABELS,
    formatCondition,
    formatPrice,
    stockLabel,
} from './storeViewPresentation';

export function StoreViewCard({ item }: { item: StoreViewItem }) {
    const { colors } = useTheme();
    const inventoryId = item.identity.inventoryId;
    const effectiveState = item.lifecycle.effectiveState;
    return (
        <Link
            href={{ pathname: '/(store-owner)/store-view/[inventoryId]', params: { inventoryId } }}
            asChild
        >
            <Pressable
                testID={`store-view-card-${inventoryId}`}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.presentation.title} in Store View`}
            >
                <GlassCard padding={14} borderRadius={16}>
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                        {item.publicState?.coverUrl ? (
                            <Image
                                source={{ uri: item.publicState.coverUrl }}
                                accessibilityLabel={`${item.presentation.title} cover`}
                                contentFit="cover"
                                style={{ width: 72, height: 104, borderRadius: 8, backgroundColor: colors.bgSecondary }}
                            />
                        ) : (
                            <View
                                accessibilityLabel="No approved cover available"
                                style={{ width: 72, height: 104, borderRadius: 8, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center' }}>No cover</Text>
                            </View>
                        )}
                        <View style={{ flex: 1, gap: 5 }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                <Text
                                    selectable
                                    testID={`store-view-state-${inventoryId}`}
                                    style={{ color: effectiveState === 'publication_failed' ? colors.error : colors.accent, fontSize: 12, fontWeight: '800' }}
                                >
                                    {EFFECTIVE_STATE_LABELS[effectiveState]}
                                </Text>
                                {item.attention.attentionState === 'action_required' ? (
                                    <Text selectable style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>
                                        Needs attention
                                    </Text>
                                ) : null}
                            </View>
                            <Text selectable style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }} numberOfLines={2}>
                                {item.presentation.title}
                            </Text>
                            <Text selectable style={{ color: colors.textSecondary }} numberOfLines={1}>
                                {item.presentation.authors.join(', ') || 'Author unavailable'}
                            </Text>
                            <Text selectable style={{ color: colors.textPrimary, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                                {formatPrice(item.presentation.sellingPriceMinor)}
                            </Text>
                            <Text selectable style={{ color: colors.textSecondary, fontSize: 13 }}>
                                {formatCondition(item.presentation.condition)} · {stockLabel(item)}
                            </Text>
                        </View>
                    </View>
                </GlassCard>
            </Pressable>
        </Link>
    );
}
