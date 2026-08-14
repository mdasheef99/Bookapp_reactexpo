import { useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { PublicationClientError } from '@/features/imageInventory/api/publicationService';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import { StoreViewManagementClientError } from '../api/storeViewManagementService';
import type { StoreViewChanges } from '../contracts/storeViewManagementContracts';
import { StoreViewActions } from '../components/StoreViewActions';
import { StoreViewEditModal } from '../components/StoreViewEditModal';
import { StoreViewStockModal } from '../components/StoreViewStockModal';
import {
    EFFECTIVE_STATE_LABELS,
    formatCondition,
    formatPrice,
    stockLabel,
} from '../components/storeViewPresentation';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { StoreViewAccessBoundary } from './StoreViewAccessBoundary';

function Field({ label, value, privateValue = false, testID }: { label: string; value: string; privateValue?: boolean; testID?: string }) {
    const { colors } = useTheme();
    return (
        <View style={{ gap: 3 }}>
            <Text selectable style={{ color: privateValue ? colors.accent : colors.textTertiary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
                {label}{privateValue ? ' · Owner only' : ''}
            </Text>
            <Text testID={testID} selectable style={{ color: colors.textPrimary, lineHeight: 20 }}>{value}</Text>
        </View>
    );
}

function Section({ title, ownerOnly = false, children }: { title: string; ownerOnly?: boolean; children: ReactNode }) {
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
    const management = useStoreViewManagementCommands(identity);
    const publication = usePublicationCommands(identity);
    const actionLock = useRef(false);
    const [editOpen, setEditOpen] = useState(false);
    const [stockOpen, setStockOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [stockError, setStockError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
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
    const busy = actionBusy || management.isPending || publication.isPending;
    const attention = item.attention.attentionReasons.length
        ? item.attention.attentionReasons.map((reason) => reason.replaceAll('_', ' ')).join(', ')
        : 'None';

    const refetch = async () => {
        await query.refetch();
    };
    const runLocked = async (work: () => Promise<void>) => {
        if (actionLock.current) return;
        actionLock.current = true;
        setActionBusy(true);
        try { await work(); } finally {
            actionLock.current = false;
            setActionBusy(false);
        }
    };
    const save = (changes: StoreViewChanges) => void runLocked(async () => {
        setEditError(null);
        setFeedback(null);
        try {
            await management.mutateAsync({
                kind: 'save', inventoryId: item.identity.inventoryId,
                inventoryVersion: item.versions.inventoryVersion, changes,
            });
            await refetch();
            setEditOpen(false);
            setFeedback('Changes saved.');
        } catch (failure) {
            const code = failure instanceof StoreViewManagementClientError ? failure.code : null;
            if (code === 'P9_VERSION_CONFLICT') {
                setEditError('This book changed. Latest details were refreshed; review and try again.');
                await refetch();
                return;
            }
            if (code === 'P9_NO_CHANGES') {
                setEditError('There are no changes to save.');
                return;
            }
            setEditError(item.lifecycle.publicationState === 'published'
                ? "Changes weren't saved. Your live listing is unchanged."
                : failure instanceof Error ? failure.message : "Changes weren't saved.");
        }
    });
    const adjustStock = (delta: number) => void runLocked(async () => {
        setStockError(null);
        setFeedback(null);
        try {
            await management.mutateAsync({
                kind: 'stock', inventoryId: item.identity.inventoryId,
                inventoryVersion: item.versions.inventoryVersion, delta,
            });
            await refetch();
            setStockOpen(false);
            setFeedback('Stock updated.');
        } catch (failure) {
            const code = failure instanceof StoreViewManagementClientError ? failure.code : null;
            if (code === 'P9_VERSION_CONFLICT') {
                setStockError('This book changed. Latest stock was refreshed; review and try again.');
                await refetch();
                return;
            }
            setStockError(failure instanceof Error ? failure.message : 'Stock was not changed.');
        }
    });
    const runPublication = (
        action: 'publish' | 'pause' | 'republish' | 'make_private' | 'retry_publication',
    ) => void runLocked(async () => {
        setFeedback(null);
        try {
            await publication.mutateAsync({
                inventoryId: item.identity.inventoryId,
                inventoryVersion: item.versions.inventoryVersion,
                publicationIntentVersion: item.versions.publicationIntentVersion,
                intent: action === 'republish' ? 'publish'
                    : action === 'make_private' ? 'private'
                        : action === 'retry_publication' ? 'retry'
                            : action,
            });
            await refetch();
            setFeedback(action === 'retry_publication'
                ? 'Publication retry requested.'
                : 'Publication state updated.');
        } catch (failure) {
            const conflict = failure instanceof PublicationClientError
                && (failure.code === 'P9_VERSION_CONFLICT' || failure.code === 'P9_STATE_CONFLICT');
            if (conflict) {
                setFeedback('This book changed. Latest details were refreshed; review and try again.');
                await refetch();
                return;
            }
            setFeedback(failure instanceof Error ? failure.message : 'Publication state was not changed.');
        }
    });
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
                    <Field testID="store-view-detail-state" label="State" value={EFFECTIVE_STATE_LABELS[item.lifecycle.effectiveState]} />
                    <Field testID="store-view-detail-attention" label="Attention" value={attention} />
                    <Field label="Stock" value={stockLabel(item)} />
                    {feedback ? <Text testID="store-view-action-feedback" selectable style={{ color: colors.textSecondary, fontWeight: '700' }}>{feedback}</Text> : null}
                    <StoreViewActions
                        capabilities={item.capabilities}
                        disabled={busy}
                        onEdit={() => { setEditError(null); setEditOpen(true); }}
                        onStock={() => { setStockError(null); setStockOpen(true); }}
                        onPublication={runPublication}
                    />
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
            <StoreViewEditModal
                visible={editOpen}
                detail={item}
                submitting={busy}
                error={editError}
                onDismiss={() => { if (!busy) setEditOpen(false); }}
                onSave={save}
            />
            <StoreViewStockModal
                visible={stockOpen}
                detail={item}
                submitting={busy}
                error={stockError}
                onDismiss={() => { if (!busy) setStockOpen(false); }}
                onSave={adjustStock}
            />
        </ScreenBackground>
    );
}

export function StoreViewDetailScreen({ inventoryId }: { inventoryId: string }) {
    return <StoreViewAccessBoundary>{(identity) => <StoreViewDetailContent identity={identity} inventoryId={inventoryId} />}</StoreViewAccessBoundary>;
}
