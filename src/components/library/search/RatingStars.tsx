import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

interface RatingStarsProps {
    rating?: number;
    count?: number;
}

export const RatingStars = ({ rating, count }: RatingStarsProps) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    if (!rating) return null;

    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <View style={{ flexDirection: 'row', gap: 2 }}>
                {[...Array(5)].map((_, i) => {
                    let iconName: 'star' | 'star-half' | 'star-outline' = 'star-outline';
                    if (i < fullStars) {
                        iconName = 'star';
                    } else if (i === fullStars && hasHalfStar) {
                        iconName = 'star-half';
                    }
                    return (
                        <Ionicons
                            key={i}
                            name={iconName}
                            size={16}
                            color="#F59E0B"
                        />
                    );
                })}
            </View>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 8, fontFamily: fonts.body }}>
                {rating.toFixed(1)} ({count?.toLocaleString() || 0})
            </Text>
        </View>
    );
};
