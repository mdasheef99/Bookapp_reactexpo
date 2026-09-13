import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';

export function BookCoverThumbnail({
    ordinal, metadataSummary,
}: Pick<OwnerBatchReviewCard, 'ordinal' | 'metadataSummary'>) {
    const { colors } = useTheme();
    const representative = metadataSummary?.coverReference
        ? null : metadataSummary?.representativeCover ?? null;
    const reference = metadataSummary?.coverReference ?? representative?.coverReference ?? null;
    if (reference) return (
        <View style={{ gap: 4 }}>
            <Image source={{ uri: reference }} contentFit="cover"
                accessibilityLabel={representative
                    ? `Book ${ordinal} representative edition cover` : `Book ${ordinal} cover`}
                style={{ width: 72, height: 104, borderRadius: 9 }} />
            {representative ? (
                <Text selectable style={{ color: colors.textSecondary, fontSize: 11, maxWidth: 90 }}>
                    Representative edition cover
                </Text>
            ) : null}
        </View>
    );
    return (
        <View accessibilityLabel={`Book ${ordinal} cover placeholder`} style={{
            width: 72, height: 104, borderRadius: 9, borderWidth: 1,
            borderColor: colors.border, backgroundColor: colors.bgSecondary,
            alignItems: 'center', justifyContent: 'center',
        }}>
            <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>No cover</Text>
        </View>
    );
}
