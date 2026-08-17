import { ActivityIndicator, Text, View } from 'react-native';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import type {
    StoreViewHistoryActivity,
    StoreViewHistoryRevision,
} from '../contracts/storeViewHistoryContracts';
import { useStoreViewHistory } from '../queries/storeViewHistoryQueries';

const REVISION_LABELS: Record<StoreViewHistoryRevision['sourceAction'], string> = {
    initial_publish: 'Went live',
    republish: 'Went live again',
    retry: 'Went live after a publication retry',
    save_details: 'Public details update went live',
    stock_adjustment: 'Stock update went live',
    media_change: 'Photo change went live',
};

const AUDIT_LABELS: Readonly<Record<string, string>> = {
    'phase9.inventory.details_updated': 'Details changed',
    'phase9.inventory.stock_adjusted': 'Stock changed',
    'phase9.inventory.media_reordered': 'Photos reordered',
    'phase9.inventory.media_removed': 'Photo removed',
    'phase9.inventory.media_replaced': 'Photo replaced',
    'phase9.publication.publish': 'Published',
    'phase9.publication.pause': 'Paused',
    'phase9.publication.private': 'Made private',
    'phase9.publication.retry': 'Publication retried',
};

const EVENT_LABELS: Readonly<Record<string, string>> = {
    'inventory.details.updated': 'Details changed',
    'inventory.stock.adjusted': 'Stock changed',
    'inventory.media.reordered': 'Photos reordered',
    'inventory.media.removed': 'Photo removed',
    'inventory.media.replaced': 'Photo replaced',
    'inventory.publication.published': 'Published',
    'inventory.publication.paused': 'Paused',
    'inventory.publication.private': 'Made private',
    'inventory.publication.failed': 'Publication failed',
};

function activityLabel(entry: StoreViewHistoryActivity): string {
    if (entry.kind === 'audit') {
        return AUDIT_LABELS[entry.action]
            ?? entry.action.replace(/^phase9\./, '').replaceAll('.', ' ').replaceAll('_', ' ');
    }
    if (entry.kind === 'event') {
        return EVENT_LABELS[entry.eventType] ?? entry.eventType.replaceAll('.', ' ').replaceAll('_', ' ');
    }
    if (entry.status === 'dead_letter') {
        return `Publication retry failed after ${entry.attemptCount} attempts`;
    }
    if (entry.status === 'resolved' || entry.status === 'resolved_noop') {
        return 'Publication retry completed';
    }
    return 'Publication retry scheduled';
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
    })}`;
}

export function StoreViewHistorySection({ identity, inventoryId }: {
    identity: ImageInventoryIdentity;
    inventoryId: string;
}) {
    const { colors } = useTheme();
    const history = useStoreViewHistory(identity, inventoryId);

    if (history.isPending) {
        return <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.textSecondary }}>Loading activity…</Text>
        </View>;
    }
    if (history.isError || !history.data) {
        return <Text style={{ color: colors.textSecondary }}>Activity history is unavailable.</Text>;
    }

    const activity = history.data.activity;
    const revisions = history.data.publicRevisions;

    return (
        <View style={{ gap: 12 }}>
            <View style={{ gap: 8 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
                    Public revisions
                </Text>
                {revisions.length === 0 ? (
                    <Text style={{ color: colors.textSecondary }}>Nothing has gone live yet.</Text>
                ) : revisions.map((revision) => (
                    <View key={revision.revisionNumber} testID={`store-view-revision-${revision.revisionNumber}`} style={{ gap: 2 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                            Revision {revision.revisionNumber} · {REVISION_LABELS[revision.sourceAction]}
                        </Text>
                        <Text style={{ color: colors.textSecondary }}>{formatDate(revision.createdAt)}</Text>
                    </View>
                ))}
            </View>
            <View style={{ gap: 8 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
                    Activity
                </Text>
                {activity.length === 0 ? (
                    <Text style={{ color: colors.textSecondary }}>No activity recorded yet.</Text>
                ) : activity.map((entry, index) => (
                    <View key={`${entry.kind}-${index}`} testID="store-view-activity-entry" style={{ gap: 2 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{activityLabel(entry)}</Text>
                        <Text style={{ color: colors.textSecondary }}>{formatDate(entry.createdAt)}</Text>
                    </View>
                ))}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Activity records what happened. Public revisions record the exact state that became customer-visible.
                History is read-only.
            </Text>
        </View>
    );
}
