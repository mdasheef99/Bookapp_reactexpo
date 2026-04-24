import { TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';

interface WishlistButtonProps {
    isWishlisted: boolean;
    isLoading?: boolean;
    onToggle: () => void;
    size?: number;
    color?: string;
}

export const WishlistButton = ({
    isWishlisted,
    isLoading = false,
    onToggle,
    size = 20,
    color,
}: WishlistButtonProps) => {
    const { colors } = useTheme();
    const heartColor = color ?? colors.error;
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
            style={{
                padding: 8,
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
