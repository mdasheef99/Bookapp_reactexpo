import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

interface OfflineBannerProps {
    visible: boolean;
    variant?: 'default' | 'library';
}

export const OfflineBanner = ({ visible, variant = 'default' }: OfflineBannerProps) => {
    const appTheme = useTheme();
    const libraryColors = useLibraryAppearance();
    const libraryFonts = useLibraryTypography();
    const colors = variant === 'library' ? libraryColors : appTheme.colors;
    const foreground = variant === 'library' ? libraryColors.onAccent : '#fff';
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
            accessible={visible}
            accessibilityRole={visible ? 'alert' : undefined}
            accessibilityLabel={visible ? "You're offline. New catalogue searches need an internet connection." : undefined}
            accessibilityElementsHidden={!visible}
            importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
            aria-hidden={!visible}
            pointerEvents={visible ? 'auto' : 'none'}
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
                <Ionicons name="cloud-offline" size={18} color={foreground} />
                <Text style={[styles.text, { color: foreground, fontFamily: variant === 'library' ? libraryFonts.body : undefined }]}>
                    You're offline. New catalogue searches need an internet connection.
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
