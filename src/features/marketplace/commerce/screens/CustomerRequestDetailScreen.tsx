import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { useCommerceStore } from '../store/commerceStore';
import { canCustomerCancel, customerStatusCopy, formatInrMinor, getCustomerDecision, mapCommerceError } from '../ui/presentation';
import { useAcceptConfirmedChangesMutation, useCancelOrderRequestMutation, useCustomerClarification,
    useCustomerRequest, useProvideClarificationMutation } from '../hooks/useCustomerCommerce';

export default function CustomerRequestDetailScreen({ requestId }: { requestId: string }) {
    const { colors } = useTheme();
    const query = useCustomerRequest(requestId);
    const clarification = useCustomerClarification(requestId);
    const clarify = useProvideClarificationMutation(requestId);
    const accept = useAcceptConfirmedChangesMutation(requestId);
    const cancel = useCancelOrderRequestMutation();
    const draft = useCommerceStore((state) => state.clarificationDrafts[requestId] ?? '');
    const setDraft = useCommerceStore((state) => state.setClarificationDraft);
    if (query.isLoading) return <ScreenBackground><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></ScreenBackground>;
    const request = query.data;
    if (!request) return <ScreenBackground><View style={styles.center}><Text style={{ color: colors.textPrimary }}>Request unavailable.</Text></View></ScreenBackground>;
    const decision = getCustomerDecision(request);
    const busy = clarify.isPending || accept.isPending || cancel.isPending;
    return <ScreenBackground><ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{request.store_name ?? 'Order request'}</Text>
        <Text style={[styles.status, { color: colors.accent }]}>{customerStatusCopy[request.status]}</Text>
        {(request.items ?? []).map((item) => <View key={item.item_id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={{ color: colors.textSecondary }}>{item.condition} · requested {item.requested_quantity}</Text>
            {item.confirmed_quantity !== null ? <Text style={{ color: colors.textSecondary }}>Confirmed {item.confirmed_quantity} × {formatInrMinor(item.confirmed_unit_price_minor)}</Text> : null}
        </View>)}
        {request.status === 'awaiting_clarification' && clarification.data ? <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>{clarification.data.customerPrompt}</Text>
            <TextInput value={draft} onChangeText={(value) => setDraft(requestId, value.slice(0, 1000))}
                multiline placeholder="Your response" style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} />
            <Pressable disabled={busy || draft.trim().length === 0} onPress={() => clarify.mutate({ version: request.version, response: draft.trim() })}><Text style={{ color: colors.accent }}>Send clarification</Text></Pressable>
        </View> : null}
        {request.status === 'awaiting_customer_decision' ? <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Review the store’s confirmed quantities and prices</Text>
            {decision.requiresPickup ? <Text style={{ color: colors.textSecondary }}>Delivery minimum is not met. Choose pickup or cancel.</Text> : null}
            <Pressable disabled={busy} onPress={() => accept.mutate({ version: request.version, fulfillment: decision.requiresPickup ? 'pickup' : null })}><Text style={{ color: colors.accent }}>{decision.requiresPickup ? 'Accept with pickup' : 'Accept confirmed changes'}</Text></Pressable>
        </View> : null}
        {request.status === 'payment_ready' ? <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Final total</Text>
            <Text style={[styles.total, { color: colors.textPrimary }]}>{formatInrMinor(request.final_total_minor)}</Text>
            <Text style={{ color: colors.textSecondary }}>Subtotal {formatInrMinor(request.final_subtotal_minor)} · BookConnect tariff {formatInrMinor(request.final_delivery_tariff_minor)}</Text>
            <Text style={{ color: colors.textSecondary }}>Your payment window ends {request.payment_expires_at ? new Date(request.payment_expires_at).toLocaleString() : 'soon'}.</Text>
            <Text style={{ color: colors.textSecondary }}>Payment integration becomes available in Phase 7. No payment is collected in this phase.</Text>
        </View> : null}
        {clarify.error || accept.error || cancel.error ? <Text style={{ color: colors.error }}>{mapCommerceError(clarify.error ?? accept.error ?? cancel.error).message}</Text> : null}
        {canCustomerCancel(request.status) ? <Pressable disabled={busy} onPress={() => cancel.mutate({ requestId, version: request.version })}><Text style={{ color: colors.error }}>Cancel request</Text></Pressable> : null}
    </ScrollView></ScreenBackground>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, container: { padding: 24, paddingBottom: 48, gap: 14 }, title: { fontSize: 26, fontWeight: '800' }, status: { fontSize: 16, fontWeight: '700' }, heading: { fontSize: 16, fontWeight: '700' }, total: { fontSize: 24, fontWeight: '800' }, card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 }, section: { gap: 10, paddingVertical: 8 }, input: { borderWidth: 1, borderRadius: 10, minHeight: 90, padding: 12, textAlignVertical: 'top' } });
