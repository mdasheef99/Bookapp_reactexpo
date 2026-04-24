import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface OfflineBannerProps {
    visible: boolean;
}

export const OfflineBanner = ({ visible }: OfflineBannerProps) => {
    const { colors } = useTheme();
    const translateY = useRef(new Animated.Value(-60)).current;

    useEffect(() => {
        Animated.spring(translateY, {
            toValue: visible ? 0 : -60,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
        }).start();
    }, [visible]);

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY }] },
            ]}
        >
            <View
                style={[
                    styles.banner,
                    { backgroundColor: colors.accent },
                ]}
            >
                <Ionicons name="cloud-offline" size={18} color="#fff" />
                <Text style={[styles.text, { color: '#fff' }]}>
                    You're offline. Search requires internet.
                </Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    banner: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
});
