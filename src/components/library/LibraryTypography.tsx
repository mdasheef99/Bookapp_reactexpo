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
