import { Image } from 'expo-image';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import {
    EFFECTIVE_STATE_LABELS,
    formatCondition,
    formatPrice,
    stockLabel,
} from '../components/storeViewPresentation';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { StoreViewAccessBoundary } from './StoreViewAccessBoundary';

function Field({ label, value, privateValue = false }: { label: string; value: string; privateValue?: boolean }) {
    const { colors } = useTheme();
    return (
        <View style={{ gap: 3 }}>
            <Text selectable style={{ color: privateValue ? colors.accent : colors.textTertiary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
                {label}{privateValue ? ' · Owner only' : ''}
            </Text>
            <Text selectable style={{ color: colors.textPrimary, lineHeight: 20 }}>{value}</Text>
        </View>
    );
}

function Section({ title, ownerOnly = false, children }: { title: string; ownerOnly?: boolean; children: React.ReactNode }) {
    const { colors } = useTheme();
    return (
        <GlassCard padding={18} borderRadius={16} style={ownerOnly ? { borderWidth: 2, borderColor: colors.accent } : undefined}>
            <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800', paddingBottom: 12 }}>
                {title}{ownerOnly ? ' · Owner only' : ''}
            </Text>
            <View style={{ gap: 12 }}>{children}</View>
        </GlassCard>
    );
}

export function StoreViewDetailContent({ identity, inventoryId }: { identity: ImageInventoryIdentity; inventoryId: string }) {
    const { colors } = useTheme();
    const query = useStoreViewDetail(identity, inventoryId);
    if (query.isPending) {
        return <ScreenBackground><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}><ActivityIndicator color={colors.accent} /><Text selectable style={{ color: colors.textSecondary }}>Loading book details…</Text></View></ScreenBackground>;
    }
    if (query.isError || !query.data) {
        return (
            <ScreenBackground>
                <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20 }}>
                    <Section title="Store View unavailable">
                        <Text selectable style={{ color: colors.textSecondary }}>This book could not be shown. It may not exist or may not belong to this Store Owner.</Text>
                    </Section>
                </ScrollView>
            </ScreenBackground>
        );
    }
    const item = query.data;
    const attention = item.attention.attentionReasons.length
        ? item.attention.attentionReasons.map((reason) => reason.replaceAll('_', ' ')).join(', ')
        : 'None';
    return (
        <ScreenBackground>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
                <Section title="Book">
                    {item.publicState?.coverUrl ? <Image source={{ uri: item.publicState.coverUrl }} accessibilityLabel={`${item.presentation.title} cover`} contentFit="contain" style={{ width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.bgSecondary }} /> : null}
                    <Field label="Title" value={item.presentation.title} />
                    <Field label="Authors" value={item.presentation.authors.join(', ') || 'Not provided'} />
                    <Field label="Language" value={item.presentation.language || 'Not provided'} />
                </Section>
                <Section title="Status">
                    <Field label="State" value={EFFECTIVE_STATE_LABELS[item.lifecycle.effectiveState]} />
                    <Field label="Attention" value={attention} />
                    <Field label="Stock" value={stockLabel(item)} />
                </Section>
                <Section title="Selling details">
                    <Field label="Price" value={formatPrice(item.presentation.sellingPriceMinor)} />
                    <Field label="Condition" value={formatCondition(item.presentation.condition)} />
                    <Field label="Public description" value={item.presentation.publicDescription || 'Not provided'} />
                    <Field label="Public condition note" value={item.presentation.publicConditionNote || 'Not provided'} />
                    <Field label="Damage" value={item.presentation.hasDamage ? (item.presentation.damageNote || item.presentation.damageTypes.join(', ') || 'Damage recorded') : 'No damage recorded'} />
                </Section>
                <Section title="Stock and operations" ownerOnly>
                    <Field privateValue label="Quantity buckets" value={`Total ${item.stock.quantityTotal} · Available ${item.stock.quantityAvailable} · Reserved ${item.stock.quantityReserved} · Sold ${item.stock.quantitySold} · Removed ${item.stock.quantityRemoved}`} />
                    <Field privateValue label="Shelf / location" value={item.privateOperations.shelfLocation || 'Not provided'} />
                    <Field privateValue label="Internal notes" value={item.privateOperations.internalNotes || 'Not provided'} />
                </Section>
                <Section title="Media">
                    <Field label="Approved media" value={`${item.mediaSummary.approvedCount}`} />
                </Section>
            </ScrollView>
        </ScreenBackground>
    );
}

export function StoreViewDetailScreen({ inventoryId }: { inventoryId: string }) {
    return <StoreViewAccessBoundary>{(identity) => <StoreViewDetailContent identity={identity} inventoryId={inventoryId} />}</StoreViewAccessBoundary>;
}
