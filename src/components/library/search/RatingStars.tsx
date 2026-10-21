import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';

interface RatingStarsProps {
    rating?: number;
    count?: number;
}

export const RatingStars = ({ rating, count }: RatingStarsProps) => {
    const colors = useLibraryAppearance();
    if (!rating) return null;

    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: LIBRARY_SPACING.xxs }}>
            <View accessible={false} aria-hidden style={{ flexDirection: 'row' }}>
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
                            size={ICON_SIZE}
                            color={colors.textSecondary}
                        />
                    );
                })}
            </View>
            <Text style={{ ...LIBRARY_TEXT.caption, color: colors.textSecondary, marginLeft: LIBRARY_SPACING.xs }}>
                {rating.toFixed(1)}{count !== undefined ? ` (${count.toLocaleString()})` : ''}
            </Text>
        </View>
    );
};
