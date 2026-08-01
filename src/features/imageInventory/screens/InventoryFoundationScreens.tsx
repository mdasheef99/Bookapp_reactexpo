import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import StoreInventoryScreen from '@/features/stores/screens/StoreInventoryScreen';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import {
    useOwnerInventoryCandidate,
    useOwnerInventoryCandidates,
    useOwnerInventoryDiscovery,
    useOwnerInventorySession,
} from '../queries/ownerUxQueries';
import { OwnerUxClientError } from '../api/ownerUxService';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';
import {
    InventoryCapturePreviewScreen,
    InventoryCaptureSetupScreen,
} from './CaptureScreens';
import {
    InventoryHubRecoveryCard,
    InventorySessionProgressScreen,
} from './CaptureProgressScreens';
import {
    InventoryReviewsScreen,
} from './CandidateReviewScreens';
import { InventoryCandidateReviewScreen } from './CandidateReviewRouteScreen';
import { InventoryMissedBookScreen } from './MissedBookScreen';
import { InventoryReadinessSummaryScreen } from './ReadinessSummaryScreen';

type QueryState = {
    isLoading: boolean;
    error: Error | null;
};

function FoundationCard({
    title,
    description,
    state,
}: {
    title: string;
    description: string;
    state?: QueryState;
}) {
    const { colors } = useTheme();
    const unavailable = state?.error instanceof OwnerUxClientError
        && ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND']
            .includes(state.error.code);
    const body = state?.isLoading
        ? 'Loading private inventory data…'
        : unavailable
            ? 'This private inventory route is unavailable.'
            : state?.error
                ? 'Inventory data could not be loaded. Try again.'
                : description;

    return (
        <ScreenBackground>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{ padding: 24 }}
            >
                <GlassCard padding={20} borderRadius={16}>
                    <Text
                        selectable
                        accessibilityRole="header"
                        style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}
                    >
                        {title}
                    </Text>
                    {state?.isLoading ? (
                        <ActivityIndicator style={{ marginTop: 16 }} color={colors.accent} />
                    ) : null}
                    <Text
                        selectable
                        accessibilityLiveRegion="polite"
                        style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}
                    >
                        {body}
                    </Text>
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}

function Guarded({ children }: { children: (identity: ImageInventoryIdentity) => ReactNode }) {
    return <InventoryAccessBoundary>{children}</InventoryAccessBoundary>;
}

export function InventoryHubFoundationScreen() {
    return <Guarded>{(identity) => <Hub identity={identity} />}</Guarded>;
}

function Hub({ identity }: { identity: ImageInventoryIdentity }) {
    return <StoreInventoryScreen scanHeader={<InventoryHubRecoveryCard identity={identity} />} />;
}

function ScanSetup({ identity }: { identity: ImageInventoryIdentity }) {
    const query = useOwnerInventoryDiscovery(identity);
    return (
        <FoundationCard
            title="Scan book spines"
            description="Session setup will be added in Unit 6C."
            state={query}
        />
    );
}

export function InventoryScanSetupFoundationScreen() {
    return <InventoryCaptureSetupScreen />;
}

function Reviews({ identity }: { identity: ImageInventoryIdentity }) {
    const query = useOwnerInventoryCandidates(identity, {
        scope: 'needs_review',
        attention: 'all',
    });
    return (
        <FoundationCard
            title="Books needing review"
            description="Candidate review cards will be added in Unit 6D."
            state={query}
        />
    );
}

export function InventoryReviewsFoundationScreen() {
    return <InventoryReviewsScreen />;
}

function Session({
    identity,
    sessionId,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
}) {
    const query = useOwnerInventorySession(identity, sessionId);
    return (
        <FoundationCard
            title="Scan session"
            description="Capture, progress, and recovery will be added in Unit 6C."
            state={query}
        />
    );
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

function Candidate({
    identity,
    sessionId,
    candidateId,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
    candidateId: string;
}) {
    const query = useOwnerInventoryCandidate(identity, sessionId, candidateId);
    return (
        <FoundationCard
            title="Book review"
            description="The strict review form will be added in Unit 6D."
            state={query}
        />
    );
}

export function InventoryCandidateFoundationScreen({
    sessionId,
    candidateId,
}: {
    sessionId: string;
    candidateId: string;
}) {
    return <InventoryCandidateReviewScreen sessionId={sessionId} candidateId={candidateId} />;
}

export function InventorySummaryFoundationScreen({ sessionId }: { sessionId: string }) {
    return <InventoryReadinessSummaryScreen sessionId={sessionId} />;
}

export function InvalidInventoryRouteScreen() {
    return (
        <Guarded>
            {() => (
                <FoundationCard
                    title="Inventory route unavailable"
                    description="This inventory link is invalid or incomplete. Return to Inventory."
                />
            )}
        </Guarded>
    );
}
