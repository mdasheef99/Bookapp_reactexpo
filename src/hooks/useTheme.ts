import { useState, useEffect } from 'react';

export type ThemePhase = 'daylight' | 'golden' | 'midnight';

export interface ThemeColors {
    bgPrimary: string;
    bgSecondary: string;
    bgCard: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    accentLight: string;
    error: string;
    errorLight: string;
    disabled: string;
    disabledLight: string;
    border: string;
    shadow: string;
}

const THEME_COLORS: Record<ThemePhase, ThemeColors> = {
    daylight: {
        bgPrimary: '#F8FAFC',
        bgSecondary: '#F1F5F9',
        bgCard: '#FFFFFF',
        textPrimary: '#0F172A',
        textSecondary: '#475569',
        textTertiary: '#94A3B8',
        accent: '#6366F1',
        accentLight: '#818CF8',
        error: '#EF4444',
        errorLight: '#F87171',
        disabled: '#E0E0E0',
        disabledLight: '#CCCCCC',
        border: '#E2E8F0',
        shadow: 'rgba(0, 0, 0, 0.1)',
    },
    golden: {
        bgPrimary: '#FFF7ED',
        bgSecondary: '#FFEDD5',
        bgCard: '#FEF3C7',
        textPrimary: '#78350F',
        textSecondary: '#92400E',
        textTertiary: '#B45309',
        accent: '#EA580C',
        accentLight: '#F97316',
        error: '#EF4444',
        errorLight: '#F87171',
        disabled: '#E0E0E0',
        disabledLight: '#CCCCCC',
        border: '#FED7AA',
        shadow: 'rgba(234, 88, 12, 0.2)',
    },
    midnight: {
        bgPrimary: '#020617',
        bgSecondary: '#0F172A',
        bgCard: '#1E293B',
        textPrimary: '#E2E8F0',
        textSecondary: '#94A3B8',
        textTertiary: '#64748B',
        accent: '#818CF8',
        accentLight: '#A5B4FC',
        error: '#F87171',
        errorLight: '#FCA5A5',
        disabled: '#475569',
        disabledLight: '#334155',
        border: '#334155',
        shadow: 'rgba(129, 140, 248, 0.3)',
    },
};

function getCurrentPhase(): ThemePhase {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 17) return 'daylight';
    if (hour >= 17 && hour < 20) return 'golden';
    return 'midnight';
}

export function useTheme() {
    const [phase, setPhase] = useState<ThemePhase>(getCurrentPhase());
    const [colors, setColors] = useState<ThemeColors>(THEME_COLORS[getCurrentPhase()]);

    useEffect(() => {
        // Update phase and colors based on time
        const updateTheme = () => {
            const newPhase = getCurrentPhase();
            setPhase(newPhase);
            setColors(THEME_COLORS[newPhase]);
        };

        // Check every 5 minutes
        const interval = setInterval(updateTheme, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    return {
        phase,
        colors,
    };
}
