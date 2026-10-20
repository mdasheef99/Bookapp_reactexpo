import { Text } from 'react-native';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';

interface PriceBadgeProps {
    price?: number;
    currency?: string;
    saleability?: string;
}

export const PriceBadge = ({ price, currency, saleability }: PriceBadgeProps) => {
    const colors = useLibraryAppearance();
    const label = saleability === 'FREE' ? 'FREE' : price && currency ? `${currency === 'INR' ? '₹' : currency} ${price}` : null;
    return label ? <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{label}</Text> : null;
};
