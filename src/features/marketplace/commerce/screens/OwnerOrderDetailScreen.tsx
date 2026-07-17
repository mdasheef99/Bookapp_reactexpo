import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { formatInrMinor } from '../ui/presentation';
import { mapCommerceError } from '../ui/presentation';
import { canOwnerAct, ownerStatusCopy } from '../ui/ownerPresentation';
import { useConfirmFullMutation, useConfirmPartialMutation, useMarkUnavailableMutation,
    useOwnerClarification, useOwnerRequest, useRejectRequestMutation, useRequestClarificationMutation,
    useRequestSupportMutation, useStartStoreReviewMutation } from '../hooks/useOwnerCommerce';
import { useState } from 'react';

export default function OwnerOrderDetailScreen({ requestId }: { requestId: string }) {
    const { colors } = useTheme();
    const query = useOwnerRequest(requestId);
    useOwnerClarification(requestId);
    const start = useStartStoreReviewMutation(requestId);
    const full = useConfirmFullMutation(); const partial = useConfirmPartialMutation();
    const unavailable = useMarkUnavailableMutation(); const reject = useRejectRequestMutation();
    const clarify = useRequestClarificationMutation(); const support = useRequestSupportMutation();
    const [prompt, setPrompt] = useState(''); const [supportText, setSupportText] = useState('');
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    if (query.isLoading) return <ScreenBackground><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></ScreenBackground>;
    const request = query.data;
    if (!request) return <ScreenBackground><View style={styles.center}><Text style={{ color: colors.textPrimary }}>Request unavailable.</Text></View></ScreenBackground>;
    const items = request.items ?? [];
    const outcomes = items.map((item) => ({ itemId: item.item_id,
        quantity: quantities[item.item_id] ?? item.requested_quantity,
        requestedQuantity: item.requested_quantity, priceMinor: item.unit_price_bound_minor,
        boundMinor: item.unit_price_bound_minor, reason: 'out_of_stock' }));
    const busy = start.isPending || full.isPending || partial.isPending || unavailable.isPending
        || reject.isPending || clarify.isPending || support.isPending;
    return <ScreenBackground><ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{request.customer_label}</Text>
        <Text style={[styles.status, { color: colors.accent }]}>{ownerStatusCopy[request.status]}</Text>
        <Text style={{ color: colors.textSecondary }}>Confirmation deadline {new Date(request.confirmation_due_at).toLocaleString()}</Text>
        {request.status === 'paused_for_emergency_closure' ? <Text style={{ color: colors.error }}>Progression is blocked during this emergency pause. Existing payment-ready holds are not shown as released.</Text> : null}
        {items.map((item) => <View key={item.item_id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={{ color: colors.textSecondary }}>{item.condition} · requested {item.requested_quantity} · available {item.quantity_available}</Text>
            <Text style={{ color: colors.textSecondary }}>Price bound {formatInrMinor(item.unit_price_bound_minor)}</Text>
            {request.status === 'store_reviewing' ? <View style={styles.row}>
                <Pressable disabled={busy || (quantities[item.item_id] ?? item.requested_quantity) <= 0}
                    onPress={() => setQuantities((old) => ({ ...old, [item.item_id]: Math.max(0, (old[item.item_id] ?? item.requested_quantity) - 1) }))}>
                    <Text style={{ color: colors.accent }}>−</Text></Pressable>
                <Text style={{ color: colors.textPrimary }}>{quantities[item.item_id] ?? item.requested_quantity}</Text>
                <Pressable disabled={busy || (quantities[item.item_id] ?? item.requested_quantity) >= item.requested_quantity}
                    onPress={() => setQuantities((old) => ({ ...old, [item.item_id]: Math.min(item.requested_quantity, (old[item.item_id] ?? item.requested_quantity) + 1) }))}>
                    <Text style={{ color: colors.accent }}>+</Text></Pressable>
            </View> : null}
        </View>)}
        {canOwnerAct('start_store_review', request.status) ? <Action label="Begin review" color={colors.accent} disabled={busy} onPress={() => start.mutate({ version: request.version })} /> : null}
        {canOwnerAct('confirm_full', request.status) ? <>
            <Action label="Confirm all available" color={colors.accent} disabled={busy} onPress={() => full.mutate({ requestId, version: request.version, items: outcomes })} />
            <Action label="Confirm partial quantities" color={colors.accent} disabled={busy || outcomes.every((item) => item.quantity === item.requestedQuantity)} onPress={() => partial.mutate({ requestId, version: request.version, items: outcomes })} />
            <Action label="Mark unavailable" color={colors.error} disabled={busy} onPress={() => unavailable.mutate({ requestId, version: request.version, items: items.map((item) => ({ itemId: item.item_id, reason: 'out_of_stock' })) })} />
        </> : null}
        {canOwnerAct('reject_order_request', request.status) ? <Action label="Reject request" color={colors.error} disabled={busy} onPress={() => reject.mutate({ requestId, version: request.version, reason: 'store_capacity' })} /> : null}
        {canOwnerAct('request_clarification', request.status) ? <View style={styles.section}>
            <TextInput placeholder="Customer-safe question" value={prompt} onChangeText={(v) => setPrompt(v.slice(0, 1000))} style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} />
            <Action label="Ask customer" color={colors.accent} disabled={busy || !prompt.trim()} onPress={() => clarify.mutate({ requestId, version: request.version, reason: 'condition', prompt: prompt.trim() })} />
        </View> : null}
        {canOwnerAct('request_platform_support', request.status) ? <View style={styles.section}>
            <TextInput placeholder="Private support details" value={supportText} onChangeText={(v) => setSupportText(v.slice(0, 2000))} style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} />
            <Action label="Request platform support" color={colors.accent} disabled={busy || !supportText.trim()} onPress={() => support.mutate({ requestId, version: request.version, category: 'technical_error', description: supportText.trim() })} />
            <Text style={{ color: colors.textSecondary }}>Support requests do not change request state, prices, quantities, holds, or deadlines.</Text>
        </View> : null}
        {start.error || full.error || partial.error || unavailable.error || reject.error || clarify.error || support.error
            ? <Text style={{ color: colors.error }}>{mapCommerceError(start.error ?? full.error ?? partial.error ?? unavailable.error ?? reject.error ?? clarify.error ?? support.error).message}</Text> : null}
    </ScrollView></ScreenBackground>;
}

function Action({ label, color, disabled, onPress }: { label: string; color: string; disabled: boolean; onPress: () => void }) {
    return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.action}><Text style={{ color, fontWeight: '700' }}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, container: { padding: 24, paddingBottom: 48, gap: 12 }, title: { fontSize: 26, fontWeight: '800' }, status: { fontSize: 16, fontWeight: '700' }, heading: { fontSize: 16, fontWeight: '700' }, card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 7 }, row: { flexDirection: 'row', gap: 18, alignItems: 'center' }, section: { gap: 8, paddingVertical: 6 }, input: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48 }, action: { paddingVertical: 10 } });
