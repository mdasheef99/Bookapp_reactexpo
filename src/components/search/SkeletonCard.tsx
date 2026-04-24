import { View, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';

// Shimmer Animation Hook
const useShimmer = () => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return animatedValue;
};

export const SkeletonCard = () => {
    const { colors } = useTheme();
    const shimmer = useShimmer();
    const opacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={{ marginBottom: 16, marginHorizontal: 4 }}>
            <View
                style={{
                    backgroundColor: colors.bgCard,
                    borderRadius: 20,
                    padding: 14,
                    flexDirection: 'row',
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <Animated.View
                    style={{
                        width: 95,
                        height: 145,
                        backgroundColor: colors.bgSecondary,
                        borderRadius: 12,
                        opacity,
                    }}
                />
                <View style={{ flex: 1, marginLeft: 16, justifyContent: 'space-between', paddingVertical: 4 }}>
                    <View>
                        <Animated.View style={{ height: 22, backgroundColor: colors.bgSecondary, borderRadius: 6, width: '95%', marginBottom: 10, opacity }} />
                        <Animated.View style={{ height: 16, backgroundColor: colors.bgSecondary, borderRadius: 4, width: '65%', marginBottom: 10, opacity }} />
                        <Animated.View style={{ height: 14, backgroundColor: colors.bgSecondary, borderRadius: 4, width: '80%', marginBottom: 8, opacity }} />
                        <Animated.View style={{ height: 14, backgroundColor: colors.bgSecondary, borderRadius: 4, width: '45%', opacity }} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Animated.View style={{ height: 40, backgroundColor: colors.bgSecondary, borderRadius: 12, width: 100, opacity }} />
                        <Animated.View style={{ height: 40, backgroundColor: colors.bgSecondary, borderRadius: 12, width: 40, opacity }} />
                    </View>
                </View>
            </View>
        </View>
    );
};
