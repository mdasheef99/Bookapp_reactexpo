import { ThemePhase, useTheme } from '@/hooks/useTheme';

// Library surfaces share the app's existing time phase, with a reading-room palette.
// Book and cabinet materials retain their physical colors in every phase.
const appearances = {
    daylight: {
        bgPrimary: '#faf6ee', bgSecondary: '#eee5d6', bgCard: '#fffdf8',
        textPrimary: '#30291f', textSecondary: '#685d4d', textTertiary: '#746857',
        accent: '#3e3225', onAccent: '#fffaf1', border: '#ded3c1',
        tagBackground: '#ede7d7', tagText: '#514634', error: '#ad3f36', shadow: '#271c13',
    },
    golden: {
        bgPrimary: '#fbf2e4', bgSecondary: '#f0e0c8', bgCard: '#fff9ed',
        textPrimary: '#33271d', textSecondary: '#6a5845', textTertiary: '#79614c',
        accent: '#493627', onAccent: '#fff8ec', border: '#deceb6',
        tagBackground: '#efdfc9', tagText: '#58412b', error: '#9c382f', shadow: '#332315',
    },
    midnight: {
        bgPrimary: '#211e1a', bgSecondary: '#383229', bgCard: '#2d2923',
        textPrimary: '#f3eada', textSecondary: '#c4b8a4', textTertiary: '#b4a58c',
        accent: '#dfc496', onAccent: '#2c2318', border: '#504638',
        tagBackground: '#423a2e', tagText: '#e2cba7', error: '#ffb3a6', shadow: '#050402',
    },
};

export const LIBRARY_SPACING = { small: 8, medium: 16, large: 24 };
export const LIBRARY_RADIUS = { control: 12, card: 14, cabinet: 16 };
export const getLibraryAppearance = (phase: ThemePhase) => appearances[phase];

export function useLibraryAppearance() {
    const { phase } = useTheme();
    return getLibraryAppearance(phase ?? 'daylight');
}
