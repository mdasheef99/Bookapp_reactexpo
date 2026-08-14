import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useImageInventoryIdentity } from '@/features/imageInventory/identity/imageInventoryIdentity';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';

export function StoreViewAccessBoundary({
    children,
}: {
    children: (identity: ImageInventoryIdentity) => ReactNode;
}) {
    const access = useImageInventoryIdentity();
    const { colors } = useTheme();

    if (access.status === 'loading') {
        return (
            <ScreenBackground>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <ActivityIndicator color={colors.accent} />
                    <Text selectable style={{ color: colors.textSecondary }}>
                        Checking Store View access…
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
                        <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
                            Store View unavailable
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary, paddingTop: 8, lineHeight: 20 }}>
                            Active Store Owner access is required. No private inventory details were shown.
                        </Text>
                    </GlassCard>
                </ScrollView>
            </ScreenBackground>
        );
    }
    return <>{children(access.identity)}</>;
}
