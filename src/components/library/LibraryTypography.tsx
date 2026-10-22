import React, { createContext, useContext, useEffect, useState } from 'react';
import { Dimensions, PixelRatio, Platform } from 'react-native';
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
// Sizes/line-heights mirror the finalized Book Details prototype scale (FA-P1,
// SDD-07 §10; prototype removed with the Flow A build) plus display 32/40. Each style
// references a font family name loaded by LibraryTypographyProvider above;
// allowFontScaling behaviour is unchanged (Text defaults still apply).
//
// Large-type behaviour (Android fontScale 2.0): React Native scales `fontSize`
// with the system font scale but leaves a fixed numeric `lineHeight` unscaled,
// so glyphs overflow their line box and clip vertically. Every `lineHeight`
// below is therefore computed as `Math.round(base * fontScale)` (clamped to
// >= base, never shrunk). `fontScale` is `PixelRatio.getFontScale()` on native
// and pinned to 1 on web (browser zoom handles web text).
//
// Live vs restart: `LIBRARY_TEXT` entries are getters that read the current
// scale on every access, so inline `style={[LIBRARY_TEXT.body, ...]}` usages
// pick up a new scale as soon as the provider re-renders (see the Dimensions
// listener below). Styles snapshotted once via `...spread` into a module-level
// `StyleSheet.create` keep the value from app start; those take effect on next
// app start. No call-site changes were needed.
const BASE_FONT_SIZE = {
    display: 32,
    title: 26,
    heading: 21,
    bodySerif: 18,
    body: 16,
    label: 16,
    caption: 14,
} as const;

const BASE_LINE_HEIGHT = {
    display: 40,
    title: 32,
    heading: 27,
    bodySerif: 26,
    body: 24,
    label: 22,
    caption: 20,
} as const;

/** Current system font scale on native (>= 1); always 1 on web. */
export function libraryFontScale(): number {
    if (Platform.OS === 'web') return 1;
    try {
        const raw = PixelRatio.getFontScale?.();
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return 1;
        return raw;
    } catch {
        return 1;
    }
}

/** Scale a base line height for the current (or given) font scale; never below base. */
export function scaledLineHeight(base: number, scale?: number): number {
    const s = scale ?? libraryFontScale();
    const clamped = typeof s !== 'number' || !Number.isFinite(s) || s < 1 ? 1 : s;
    return Math.round(base * clamped);
}

export type LibraryTextStyle = 'display' | 'title' | 'heading' | 'bodySerif' | 'body' | 'label' | 'caption';

export interface LibraryTextEntry {
    fontFamily: string | undefined;
    fontSize: number;
    lineHeight: number;
    fontWeight?: '700';
}

export const LIBRARY_TEXT: Record<LibraryTextStyle, LibraryTextEntry> = {
    get display(): LibraryTextEntry {
        return { fontFamily: libraryFonts.heading, fontSize: BASE_FONT_SIZE.display, lineHeight: scaledLineHeight(BASE_LINE_HEIGHT.display) };
    },
    get title(): LibraryTextEntry {
        return { fontFamily: libraryFonts.heading, fontSize: BASE_FONT_SIZE.title, lineHeight: scaledLineHeight(BASE_LINE_HEIGHT.title) };
    },
    get heading(): LibraryTextEntry {
        return { fontFamily: libraryFonts.serif, fontSize: BASE_FONT_SIZE.heading, lineHeight: scaledLineHeight(BASE_LINE_HEIGHT.heading) };
    },
    get bodySerif(): LibraryTextEntry {
        return { fontFamily: libraryFonts.serif, fontSize: BASE_FONT_SIZE.bodySerif, lineHeight: scaledLineHeight(BASE_LINE_HEIGHT.bodySerif) };
    },
    get body(): LibraryTextEntry {
        return { fontFamily: libraryFonts.body, fontSize: BASE_FONT_SIZE.body, lineHeight: scaledLineHeight(BASE_LINE_HEIGHT.body) };
    },
    get label(): LibraryTextEntry {
        return { fontFamily: libraryFonts.label, fontSize: BASE_FONT_SIZE.label, lineHeight: scaledLineHeight(BASE_LINE_HEIGHT.label), fontWeight: '700' };
    },
    get caption(): LibraryTextEntry {
        return { fontFamily: libraryFonts.body, fontSize: BASE_FONT_SIZE.caption, lineHeight: scaledLineHeight(BASE_LINE_HEIGHT.caption) };
    },
};

/**
 * Unscaled base scale (fontScale 1), frozen at import. For fixed-geometry
 * surfaces that opt out of system font scaling (`allowFontScaling={false}`),
 * such as the PNG export/share cards, whose aspect and capture layout must
 * stay deterministic at any system scale. All other library text must read
 * `LIBRARY_TEXT` so line heights grow with the font scale.
 */
export const LIBRARY_TEXT_BASE: Record<LibraryTextStyle, LibraryTextEntry> = {
    display: { fontFamily: libraryFonts.heading, fontSize: BASE_FONT_SIZE.display, lineHeight: BASE_LINE_HEIGHT.display },
    title: { fontFamily: libraryFonts.heading, fontSize: BASE_FONT_SIZE.title, lineHeight: BASE_LINE_HEIGHT.title },
    heading: { fontFamily: libraryFonts.serif, fontSize: BASE_FONT_SIZE.heading, lineHeight: BASE_LINE_HEIGHT.heading },
    bodySerif: { fontFamily: libraryFonts.serif, fontSize: BASE_FONT_SIZE.bodySerif, lineHeight: BASE_LINE_HEIGHT.bodySerif },
    body: { fontFamily: libraryFonts.body, fontSize: BASE_FONT_SIZE.body, lineHeight: BASE_LINE_HEIGHT.body },
    label: { fontFamily: libraryFonts.label, fontSize: BASE_FONT_SIZE.label, lineHeight: BASE_LINE_HEIGHT.label, fontWeight: '700' },
    caption: { fontFamily: libraryFonts.body, fontSize: BASE_FONT_SIZE.caption, lineHeight: BASE_LINE_HEIGHT.caption },
};

const TypographyContext = createContext(fallback);

export function LibraryTypographyProvider({ children }: { children: React.ReactNode }) {
    const [loaded] = useFonts({
        LibraryGaramondMedium: require('../../../assets/fonts/library/EBGaramond_500Medium.ttf'),
        LibraryGaramondSemiBold: require('../../../assets/fonts/library/EBGaramond_600SemiBold.ttf'),
        LibraryManrope: require('../../../assets/fonts/library/Manrope_400Regular.ttf'),
        LibraryManropeBold: require('../../../assets/fonts/library/Manrope_700Bold.ttf'),
    });
    // Re-render the subtree when the system font scale changes so inline
    // `LIBRARY_TEXT` getter reads pick up the new scale without touching the
    // ~67 call sites. Module-level `StyleSheet.create` snapshots still need an
    // app restart (documented above).
    const [, setFontTick] = useState(0);
    useEffect(() => {
        const add = (Dimensions as unknown as { addEventListener?: unknown }).addEventListener;
        if (typeof add !== 'function') return undefined;
        const subscription = (Dimensions as unknown as {
            addEventListener: (
                type: 'change',
                handler: (dims: { window: { fontScale: number } }) => void,
            ) => { remove: () => void };
        }).addEventListener('change', () => {
            setFontTick((tick) => tick + 1);
        });
        return () => {
            subscription?.remove?.();
        };
    }, []);
    return <TypographyContext.Provider value={loaded ? libraryFonts : fallback}>{children}</TypographyContext.Provider>;
}

export const useLibraryTypography = () => useContext(TypographyContext);
