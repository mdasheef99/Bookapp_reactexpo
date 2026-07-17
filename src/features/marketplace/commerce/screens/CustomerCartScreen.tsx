import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { useCommerceStore } from '../store/commerceStore';
import { customerCommerceService } from '../services/customerCommerceService';
import { formatInrMinor, mapCommerceError } from '../ui/presentation';
import { useState } from 'react';
import {
    useCartQuantityMutation, useCustomerCart, useRemoveCartItemMutation,
    useSubmitOrderRequestMutation,
} from '../hooks/useCustomerCommerce';

export default function CustomerCartScreen() {
    const { colors } = useTheme();
    const cart = useCustomerCart();
    const quantity = useCartQuantityMutation();
    const remove = useRemoveCartItemMutation();
    const submit = useSubmitOrderRequestMutation();
    const replacement = useCommerceStore((state) => state.replacement);
    const setReplacement = useCommerceStore((state) => state.setReplacement);
    const [replacementError, setReplacementError] = useState<string | null>(null);

    if (cart.isLoading) return <ScreenBackground><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></ScreenBackground>;
    if (cart.error) return <ScreenBackground><View style={styles.center}><Text style={{ color: colors.error }}>{mapCommerceError(cart.error).message}</Text><Pressable onPress={() => void cart.refetch()}><Text style={{ color: colors.accent }}>Retry</Text></Pressable></View></ScreenBackground>;
    if (!cart.data) return <ScreenBackground><View style={styles.center}><Text style={{ color: colors.textPrimary }}>Your marketplace cart is empty.</Text></View></ScreenBackground>;

    const total = cart.data.items.reduce((sum, item) => sum
        + (item.itemSubtotalMinor ?? item.quantity * (item.currentPriceMinor ?? item.priceSnapshotMinor)), 0);
    const busy = quantity.isPending || remove.isPending || submit.isPending;
    const submitCart = () => submit.mutate({
        cartId: cart.data!.cartId, expectedVersion: cart.data!.version,
        fulfillmentMethod: 'pickup', customerNote: null,
        contactSnapshot: null, deliveryAddressSnapshot: null,
    }, { onSuccess: (request) => router.push(customerCommerceService.customerRequestRoute(request.request_id) as never) });

    return (
        <ScreenBackground><ScrollView contentContainerStyle={styles.container}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Marketplace cart</Text>
            <Text style={{ color: colors.textSecondary }}>{cart.data.storeName ?? `Selected store ${cart.data.storeId.slice(0, 8)}`}</Text>
            {replacement ? <View style={[styles.prompt, { borderColor: colors.border }]}>
                <Text style={[styles.heading, { color: colors.textPrimary }]}>Replace your current cart?</Text>
                <Text style={{ color: colors.textSecondary }}>A cart can contain books from one store only. Your current items stay unchanged unless you confirm.</Text>
                <View style={styles.row}>
                    <Pressable accessibilityRole="button" onPress={() => setReplacement(null)}><Text style={{ color: colors.textSecondary }}>Keep existing cart</Text></Pressable>
                    <Pressable accessibilityRole="button" onPress={() => {
                        setReplacementError(null);
                        customerCommerceService.confirmCartReplacement(replacement.token, replacement.expectedVersion)
                            .then(() => { setReplacement(null); void cart.refetch(); })
                            .catch((cause) => { setReplacementError(mapCommerceError(cause).message); void cart.refetch(); });
                    }}><Text style={{ color: colors.accent }}>Replace cart</Text></Pressable>
                </View>
                {replacementError ? <Text style={{ color: colors.error }}>{replacementError}</Text> : null}
            </View> : null}
            {cart.data.items.map((item) => {
                const price = item.currentPriceMinor ?? item.priceSnapshotMinor;
                return <View key={item.itemId} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.heading, { color: colors.textPrimary }]}>{item.listing.title ?? 'Book'}</Text>
                    <Text style={{ color: colors.textSecondary }}>{formatInrMinor(price)} each</Text>
                    <View style={styles.row}>
                        <Pressable disabled={busy || item.quantity <= 1} accessibilityLabel={`Decrease ${item.listing.title} quantity`}
                            onPress={() => quantity.mutate({ itemId: item.itemId, quantity: item.quantity - 1, version: cart.data!.version })}>
                            <Text style={[styles.control, { color: colors.accent }]}>−</Text>
                        </Pressable>
                        <Text style={{ color: colors.textPrimary }}>{item.quantity}</Text>
                        <Pressable disabled={busy} accessibilityLabel={`Increase ${item.listing.title} quantity`}
                            onPress={() => quantity.mutate({ itemId: item.itemId, quantity: item.quantity + 1, version: cart.data!.version })}>
                            <Text style={[styles.control, { color: colors.accent }]}>+</Text>
                        </Pressable>
                        <Text style={[styles.subtotal, { color: colors.textPrimary }]}>{formatInrMinor(item.quantity * price)}</Text>
                    </View>
                    <Pressable disabled={busy} onPress={() => remove.mutate({ itemId: item.itemId, version: cart.data!.version })}>
                        <Text style={{ color: colors.error }}>Remove</Text>
                    </Pressable>
                </View>;
            })}
            <View style={styles.row}><Text style={[styles.heading, { color: colors.textPrimary }]}>Provisional subtotal</Text><Text style={[styles.subtotal, { color: colors.textPrimary }]}>{formatInrMinor(total)}</Text></View>
            <Text style={{ color: colors.textSecondary }}>BookConnect tariff and exact total are calculated securely by the server at submission.</Text>
            <Text style={{ color: colors.textSecondary }}>Items are not reserved until the store confirms availability.</Text>
            {quantity.error || remove.error || submit.error ? <Text style={{ color: colors.error }}>{mapCommerceError(quantity.error ?? remove.error ?? submit.error).message}</Text> : null}
            <Pressable disabled={busy || cart.data.items.length === 0} accessibilityRole="button" onPress={submitCart}
                style={[styles.primary, { backgroundColor: colors.accent }]}>
                <Text style={styles.primaryText}>{submit.isPending ? 'Submitting…' : 'Submit request'}</Text>
            </Pressable>
        </ScrollView></ScreenBackground>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { padding: 24, paddingBottom: 48, gap: 14 },
    title: { fontSize: 26, fontWeight: '800' }, heading: { fontSize: 16, fontWeight: '700' },
    card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
    prompt: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    subtotal: { marginLeft: 'auto', fontWeight: '800' }, control: { fontSize: 24, fontWeight: '700' },
    primary: { borderRadius: 10, padding: 14, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '800' },
});
