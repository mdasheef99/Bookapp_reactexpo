import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { useImageInventoryIdentity } from '../identity/imageInventoryIdentity';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';

type Props = {
    children: (identity: ImageInventoryIdentity) => ReactNode;
};

export function InventoryAccessBoundary({ children }: Props) {
    const access = useImageInventoryIdentity();
    const { colors } = useTheme();

    if (access.status === 'loading') {
        return (
            <ScreenBackground>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <ActivityIndicator color={colors.accent} />
                    <Text selectable style={{ color: colors.textSecondary }}>
                        Checking inventory access…
                    </Text>
                </View>
            </ScreenBackground>
        );
    }

    if (access.status === 'unauthorized') {
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
                            Inventory unavailable
                        </Text>
                        <Text
                            selectable
                            style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}
                        >
                            Active Store Owner access is required. Your private scan data was not shown.
                        </Text>
                    </GlassCard>
                </ScrollView>
            </ScreenBackground>
        );
    }

    return <>{children(access.identity)}</>;
}
