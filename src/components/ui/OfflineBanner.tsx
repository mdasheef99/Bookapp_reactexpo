import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';

interface OfflineBannerProps {
    visible: boolean;
}

export const OfflineBanner = ({ visible }: OfflineBannerProps) => {
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
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                transform: [{ translateY }],
            }}
        >
            <View
                style={{
                    backgroundColor: '#EF4444',
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
                }}
            >
                <Ionicons name="cloud-offline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                    You're offline. Search requires internet.
                </Text>
            </View>
        </Animated.View>
    );
};
