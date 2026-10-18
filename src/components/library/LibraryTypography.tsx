import React, { createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';

const fallbackSerif = Platform.select({ ios: 'Georgia', web: 'Georgia', default: 'serif' });
const fallback = {
    serif: fallbackSerif,
    heading: fallbackSerif,
    body: undefined as string | undefined,
    label: undefined as string | undefined,
};
const libraryFonts = {
    serif: 'LibraryGaramondMedium',
    heading: 'LibraryGaramondSemiBold',
    body: 'LibraryManrope',
    label: 'LibraryManropeBold',
};

// SDD-07 FU-2: named type scale for all six library routes (DP-02 type part).
// Sizes/line-heights mirror the finalized Book Details prototype scale in
// src/prototypes/flowA/prototypeTokens.ts (plus display 32/40). Each style
// references a font family name loaded by LibraryTypographyProvider above;
// allowFontScaling behaviour is unchanged (Text defaults still apply).
export const LIBRARY_TEXT = {
    display: { fontFamily: libraryFonts.heading, fontSize: 32, lineHeight: 40 },
    title: { fontFamily: libraryFonts.heading, fontSize: 26, lineHeight: 32 },
    heading: { fontFamily: libraryFonts.serif, fontSize: 21, lineHeight: 27 },
    bodySerif: { fontFamily: libraryFonts.serif, fontSize: 18, lineHeight: 26 },
    body: { fontFamily: libraryFonts.body, fontSize: 16, lineHeight: 24 },
    label: { fontFamily: libraryFonts.label, fontSize: 16, lineHeight: 22, fontWeight: '700' as const },
    caption: { fontFamily: libraryFonts.body, fontSize: 14, lineHeight: 20 },
} as const;

export type LibraryTextStyle = keyof typeof LIBRARY_TEXT;

const TypographyContext = createContext(fallback);

export function LibraryTypographyProvider({ children }: { children: React.ReactNode }) {
    const [loaded] = useFonts({
        LibraryGaramondMedium: require('../../../assets/fonts/library/EBGaramond_500Medium.ttf'),
        LibraryGaramondSemiBold: require('../../../assets/fonts/library/EBGaramond_600SemiBold.ttf'),
        LibraryManrope: require('../../../assets/fonts/library/Manrope_400Regular.ttf'),
        LibraryManropeBold: require('../../../assets/fonts/library/Manrope_700Bold.ttf'),
    });
    return <TypographyContext.Provider value={loaded ? libraryFonts : fallback}>{children}</TypographyContext.Provider>;
}

export const useLibraryTypography = () => useContext(TypographyContext);
