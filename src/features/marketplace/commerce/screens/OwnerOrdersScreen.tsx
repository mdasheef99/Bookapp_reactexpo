import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useStoreOwnerGate } from '@/features/stores/hooks/useStoreOwnerGate';
import { useTheme } from '@/hooks/useTheme';
import { useOwnerRequests } from '../hooks/useOwnerCommerce';
import { ownerStatusCopy } from '../ui/ownerPresentation';
import { mapCommerceError } from '../ui/presentation';

export default function OwnerOrdersScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gate = useStoreOwnerGate(user?.id ?? null);
    const requests = useOwnerRequests();
    if (gate.isLoading || requests.isLoading) return <ScreenBackground><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></ScreenBackground>;
    if (gate.data?.state !== 'active_owner') return <ScreenBackground><View style={styles.center}><Text style={{ color: colors.textPrimary }}>Owner order access is unavailable.</Text></View></ScreenBackground>;
    if (requests.error) return <ScreenBackground><View style={styles.center}><Text style={{ color: colors.error }}>{mapCommerceError(requests.error).message}</Text></View></ScreenBackground>;
    return <ScreenBackground><View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Order requests</Text>
        <FlatList data={requests.data ?? []} keyExtractor={(item) => item.request_id}
            refreshing={requests.isFetching} onRefresh={() => void requests.refetch()}
            ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No active requests.</Text>}
            renderItem={({ item }) => <Pressable accessibilityRole="button"
                onPress={() => router.push(`/(store-owner)/orders/${item.request_id}` as never)}
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <View style={styles.row}><Text style={[styles.heading, { color: colors.textPrimary }]}>{item.customer_label}</Text><Text style={{ color: colors.accent }}>{ownerStatusCopy[item.status]}</Text></View>
                <Text style={{ color: colors.textSecondary }}>{item.item_count ?? 0} items · {item.fulfillment_method}</Text>
                <Text style={{ color: colors.textSecondary }}>Due {new Date(item.confirmation_due_at).toLocaleString()}</Text>
            </Pressable>} />
    </View></ScreenBackground>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, container: { flex: 1, padding: 24 }, title: { fontSize: 26, fontWeight: '800', marginBottom: 16 }, heading: { fontSize: 16, fontWeight: '700' }, card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 7, marginBottom: 10 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 } });
