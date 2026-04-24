import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemePhase } from '@/hooks/useTheme';

const GLASS_COLORS: Record<
    ThemePhase,
    { start: string; end: string; border: string; shadow: string }
> = {
    daylight: {
        start: 'rgba(255, 255, 255, 0.92)',
        end: 'rgba(248, 250, 252, 0.78)',
        border: 'rgba(226, 232, 240, 0.50)',
        shadow: 'rgba(0, 0, 0, 0.10)',
    },
    golden: {
        start: 'rgba(255, 252, 245, 0.90)',
        end: 'rgba(255, 237, 213, 0.75)',
        border: 'rgba(254, 215, 170, 0.40)',
        shadow: 'rgba(120, 53, 15, 0.12)',
    },
    midnight: {
        start: 'rgba(30, 41, 59, 0.88)',
        end: 'rgba(15, 23, 42, 0.72)',
        border: 'rgba(148, 163, 184, 0.30)',
        shadow: 'rgba(129, 140, 248, 0.20)',
    },
};

interface GlassCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    padding?: number;
    borderRadius?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    style,
    padding = 16,
    borderRadius = 20,
}) => {
    const { phase } = useTheme();
    const glass = GLASS_COLORS[phase];

    return (
        <View
            style={[
                styles.container,
                {
                    borderRadius,
                    shadowColor: glass.shadow,
                },
                style,
            ]}
        >
            <LinearGradient
                colors={[glass.start, glass.end]}
                style={[styles.gradient, { borderRadius }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <View
                style={[
                    styles.border,
                    {
                        borderRadius,
                        borderColor: glass.border,
                    },
                ]}
            />
            <View style={[styles.content, { padding, borderRadius }]}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    border: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1.5,
    },
    content: {
        position: 'relative',
    },
});
