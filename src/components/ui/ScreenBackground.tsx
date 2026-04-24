import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemePhase } from '@/hooks/useTheme';

const GRADIENTS: Record<ThemePhase, [string, string]> = {
    daylight: ['#F8FAFC', '#F1F5F9'],
    golden: ['#FFF7ED', '#FFEDD5'],
    midnight: ['#020617', '#0F172A'],
};

interface ScreenBackgroundProps {
    children: React.ReactNode;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({ children }) => {
    const { phase, colors } = useTheme();
    const gradient = GRADIENTS[phase];

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            <LinearGradient
                colors={gradient}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
