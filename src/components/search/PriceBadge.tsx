import { View, Text } from 'react-native';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

interface PriceBadgeProps {
    price?: number;
    currency?: string;
    saleability?: string;
}

export const PriceBadge = ({ price, currency, saleability }: PriceBadgeProps) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    if (saleability === 'FREE') {
        return (
            <View style={{
                backgroundColor: colors.tagBackground,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                alignSelf: 'flex-start',
                marginTop: 8,
            }}>
                <Text style={{ color: colors.tagText, fontSize: 11, fontFamily: fonts.label }}>FREE</Text>
            </View>
        );
    }

    if (price && currency) {
        return (
            <View style={{
                backgroundColor: colors.tagBackground,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                alignSelf: 'flex-start',
                marginTop: 8,
            }}>
                <Text style={{ color: colors.tagText, fontSize: 12, fontFamily: fonts.label }}>
                    {currency === 'INR' ? '₹' : currency} {price}
                </Text>
            </View>
        );
    }

    return null;
};
