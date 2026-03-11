import { View, Text } from 'react-native';

interface PriceBadgeProps {
    price?: number;
    currency?: string;
    saleability?: string;
}

export const PriceBadge = ({ price, currency, saleability }: PriceBadgeProps) => {
    if (saleability === 'FREE') {
        return (
            <View style={{
                backgroundColor: '#10B981',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 20,
                alignSelf: 'flex-start',
                marginTop: 8,
            }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>FREE</Text>
            </View>
        );
    }

    if (price && currency) {
        return (
            <View style={{
                backgroundColor: '#059669',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 20,
                alignSelf: 'flex-start',
                marginTop: 8,
            }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    {currency === 'INR' ? '₹' : currency} {price}
                </Text>
            </View>
        );
    }

    return null;
};
