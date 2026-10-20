import { Pressable, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { storeViewRoutes } from '@/features/storeView/navigation/storeViewRoutes';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import {
    type ImageInventoryIdentity,
    useOwnerInventoryDiscovery,
} from '../queries/ownerUxQueries';

export function InventoryHubRecoveryCard({ identity }: { identity: ImageInventoryIdentity }) {
    const router = useRouter();
    const discovery = useOwnerInventoryDiscovery(identity);
    const { isOffline } = useNetworkStatus();
    const { colors } = useTheme();
    const active = discovery.data?.activeSession;
    return (
        <GlassCard padding={18} borderRadius={16}>
            <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>Scan book spines</Text>
            {discovery.error ? (
                <>
                    <Text selectable style={{ color: colors.textSecondary, marginTop: 6 }}>Saved scan status could not be loaded.</Text>
                    <Button title="Retry scan status" variant="secondary" style={{ marginTop: 14 }} onPress={() => void discovery.refetch()} disabled={isOffline} />
                </>
            ) : (
                <>
                    <Text selectable style={{ color: colors.textSecondary, marginTop: 6 }}>
                        {active ? `${active.inputCount} images · ${active.attentionCount} need attention` : 'Capture or choose a shelf photo.'}
                    </Text>
                    <Button
                        title={active ? 'Resume scan' : 'Start scan'}
                        style={{ marginTop: 14 }}
                        onPress={() => router.push(active ? inventoryRoutes.session(active.sessionId) : inventoryRoutes.scan())}
                        disabled={discovery.isLoading || isOffline || !discovery.data}
                    />
                </>
            )}
            <Link href={storeViewRoutes.root()} asChild>
                <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Added books are in Store View"
                    style={{ minHeight: 44, marginTop: 14, justifyContent: 'center' }}
                >
                    <Text selectable style={{ color: colors.accent, fontWeight: '700' }}>
                        Added books are in Store View
                    </Text>
                </Pressable>
            </Link>
        </GlassCard>
    );
}
