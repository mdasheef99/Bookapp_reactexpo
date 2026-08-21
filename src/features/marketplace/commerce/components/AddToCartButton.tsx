import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { customerCommerceService } from '../services/customerCommerceService';
import { useCommerceStore } from '../store/commerceStore';
import { mapCommerceError } from '../ui/presentation';

export function AddToCartButton({ listingId, title }: { listingId: string; title: string }) {
    const { colors } = useTheme();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const setReplacement = useCommerceStore((state) => state.setReplacement);
    const add = async () => {
        if (pending) return;
        setPending(true);
        setError(null);
        try {
            const result = await customerCommerceService.addCartItem(listingId);
            if (result.replacement) setReplacement(result.replacement);
            router.push('/(tabs)/marketplace/cart' as never);
        } catch (cause) {
            setError(mapCommerceError(cause).message);
        } finally {
            setPending(false);
        }
    };
    return <Pressable accessibilityRole="button" accessibilityLabel={`Add ${title} to marketplace cart`}
        disabled={pending} onPress={(event) => { event.stopPropagation(); void add(); }}
        style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
        <Text style={{ color: colors.accent, fontWeight: '800' }}>{pending ? 'Adding…' : 'Add to cart'}</Text>
        {error ? <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text> : null}
    </Pressable>;
}
