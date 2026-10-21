import type { ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';
import {
    InventoryCapturePreviewScreen,
    InventoryCaptureSetupScreen,
} from './CaptureScreens';
import {
    InventoryHubRecoveryCard,
    InventorySessionProgressScreen,
} from './CaptureProgressScreens';
import { InventoryMissedBookScreen } from './MissedBookScreen';
import { InventoryReadinessSummaryScreen } from './ReadinessSummaryScreen';

function Guarded({ children }: { children: (identity: ImageInventoryIdentity) => ReactNode }) {
    return <InventoryAccessBoundary>{children}</InventoryAccessBoundary>;
}

export function InventoryHubFoundationScreen() {
    return <Guarded>{(identity) => <Hub identity={identity} />}</Guarded>;
}

function Hub({ identity }: { identity: ImageInventoryIdentity }) {
    return (
        <ScreenBackground>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 14 }}
            >
                <InventoryHubRecoveryCard identity={identity} />
            </ScrollView>
        </ScreenBackground>
    );
}

export function InventoryScanSetupFoundationScreen() {
    return <InventoryCaptureSetupScreen />;
}

export function InventorySessionFoundationScreen({ sessionId }: { sessionId: string }) {
    return <InventorySessionProgressScreen sessionId={sessionId} />;
}

export function InventoryPreviewFoundationScreen({ sessionId }: { sessionId: string }) {
    return <InventoryCapturePreviewScreen sessionId={sessionId} />;
}

export function InventoryMissedFoundationScreen({ sessionId }: { sessionId: string }) {
    return <InventoryMissedBookScreen sessionId={sessionId} />;
}

export function InventorySummaryFoundationScreen({ sessionId }: { sessionId: string }) {
    return <InventoryReadinessSummaryScreen sessionId={sessionId} />;
}

export function InvalidInventoryRouteScreen() {
    const { colors } = useTheme();
    return (
        <Guarded>
            {() => (
                <ScreenBackground>
                    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24 }}>
                        <GlassCard padding={20} borderRadius={16}>
                            <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
                                Inventory route unavailable
                            </Text>
                            <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
                                This inventory link is invalid or incomplete. Return to Inventory.
                            </Text>
                        </GlassCard>
                    </ScrollView>
                </ScreenBackground>
            )}
        </Guarded>
    );
}
