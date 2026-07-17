import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { useCustomerRequests } from '../hooks/useCustomerCommerce';
import { customerStatusCopy, formatInrMinor } from '../ui/presentation';
import { mapCommerceError } from '../ui/presentation';

export default function CustomerRequestsScreen() {
    const { colors } = useTheme();
    const query = useCustomerRequests();
    if (query.isLoading) return <ScreenBackground><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></ScreenBackground>;
    if (query.error) return <ScreenBackground><View style={styles.center}><Text style={{ color: colors.error }}>{mapCommerceError(query.error).message}</Text><Pressable onPress={() => void query.refetch()}><Text style={{ color: colors.accent }}>Retry</Text></Pressable></View></ScreenBackground>;
    return <ScreenBackground><View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Order requests</Text>
        <FlatList data={query.data ?? []} keyExtractor={(item) => item.request_id}
            refreshing={query.isFetching} onRefresh={() => void query.refetch()}
            ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No marketplace requests yet.</Text>}
            renderItem={({ item }) => <Pressable accessibilityRole="button"
                onPress={() => router.push(`/(tabs)/marketplace/requests/${item.request_id}` as never)}
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.heading, { color: colors.textPrimary }]}>{item.store_name ?? 'Bookstore'}</Text>
                <Text style={{ color: colors.accent }}>{customerStatusCopy[item.status]}</Text>
                <Text style={{ color: colors.textSecondary }}>{formatInrMinor(item.final_total_minor ?? item.requested_subtotal_minor)}</Text>
            </Pressable>} />
    </View></ScreenBackground>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, container: { flex: 1, padding: 24, gap: 14 }, title: { fontSize: 26, fontWeight: '800', marginBottom: 12 }, heading: { fontSize: 16, fontWeight: '700' }, card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, marginBottom: 10 } });
