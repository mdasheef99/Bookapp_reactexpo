import { TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';
import { MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';

interface WishlistButtonProps {
    isWishlisted: boolean;
    isLoading?: boolean;
    onToggle: () => void;
    size?: number;
    color?: string;
    accessibilityLabel?: string;
}

export const WishlistButton = ({
    isWishlisted,
    isLoading = false,
    onToggle,
    size = ICON_SIZE,
    color,
    accessibilityLabel,
}: WishlistButtonProps) => {
    const colors = useLibraryAppearance();
    const heartColor = color ?? colors.accent;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Animate on wishlist state change
    useEffect(() => {
        if (isWishlisted) {
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.3,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isWishlisted]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onToggle();
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? (isWishlisted ? 'Remove from wishlist' : 'Add to wishlist')}
            accessibilityState={{ disabled: isLoading, busy: isLoading, selected: isWishlisted }}
            accessibilityHint={isWishlisted ? 'Removes this book from your wishlist' : 'Adds this book to your wishlist'}
            style={{
                minWidth: MIN_TARGET,
                minHeight: MIN_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isLoading ? 0.5 : 1,
            }}
        >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Ionicons
                    name={isWishlisted ? 'heart' : 'heart-outline'}
                    size={size}
                    color={heartColor}
                />
            </Animated.View>
        </TouchableOpacity>
    );
};
