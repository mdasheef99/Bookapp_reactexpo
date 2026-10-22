import { PixelRatio, Platform } from 'react-native';

import {
    LIBRARY_TEXT,
    LIBRARY_TEXT_BASE,
    libraryFontScale,
    scaledLineHeight,
} from '../LibraryTypography';

const BASE_LINE_HEIGHTS = {
    display: 40,
    title: 32,
    heading: 27,
    bodySerif: 26,
    body: 24,
    label: 22,
    caption: 20,
} as const;

const BASE_FONT_SIZES = {
    display: 32,
    title: 26,
    heading: 21,
    bodySerif: 18,
    body: 16,
    label: 16,
    caption: 14,
} as const;

describe('scaledLineHeight (large-type fix)', () => {
    it('returns the base line height at fontScale 1', () => {
        expect(scaledLineHeight(24, 1)).toBe(24);
    });

    it('scales line heights for fontScale 1.5 and 2', () => {
        expect(scaledLineHeight(24, 1.5)).toBe(36);
        expect(scaledLineHeight(24, 2)).toBe(48);
        expect(scaledLineHeight(22, 2)).toBe(44);
        expect(scaledLineHeight(27, 1.5)).toBe(Math.round(27 * 1.5));
    });

    it('never shrinks below the base line height', () => {
        expect(scaledLineHeight(24, 0.5)).toBe(24);
        expect(scaledLineHeight(24, 0)).toBe(24);
        expect(scaledLineHeight(24, NaN)).toBe(24);
    });
});

describe('libraryFontScale', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('reads PixelRatio.getFontScale on native and clamps below 1 to 1', () => {
        if (Platform.OS === 'web') return;
        const spy = jest.spyOn(PixelRatio, 'getFontScale');
        spy.mockReturnValue(1);
        expect(libraryFontScale()).toBe(1);
        spy.mockReturnValue(2);
        expect(libraryFontScale()).toBe(2);
        spy.mockReturnValue(0.5);
        expect(libraryFontScale()).toBe(1);
    });
});

describe('LIBRARY_TEXT scales with the system font scale', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns base line heights at fontScale 1 with unchanged font sizes', () => {
        if (Platform.OS === 'web') return;
        jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
        for (const [name, base] of Object.entries(BASE_LINE_HEIGHTS)) {
            expect(LIBRARY_TEXT[name as keyof typeof LIBRARY_TEXT].lineHeight).toBe(base);
            expect(LIBRARY_TEXT[name as keyof typeof LIBRARY_TEXT].fontSize).toBe(
                BASE_FONT_SIZES[name as keyof typeof BASE_FONT_SIZES],
            );
        }
    });

    it('returns scaled line heights at fontScale 1.5 and 2, never below base', () => {
        if (Platform.OS === 'web') return;
        const spy = jest.spyOn(PixelRatio, 'getFontScale');
        spy.mockReturnValue(1.5);
        for (const [name, base] of Object.entries(BASE_LINE_HEIGHTS)) {
            expect(LIBRARY_TEXT[name as keyof typeof LIBRARY_TEXT].lineHeight).toBe(Math.round(base * 1.5));
        }
        spy.mockReturnValue(2);
        for (const [name, base] of Object.entries(BASE_LINE_HEIGHTS)) {
            expect(LIBRARY_TEXT[name as keyof typeof LIBRARY_TEXT].lineHeight).toBe(base * 2);
        }
        // Body 16/24 at scale 2 -> lineHeight 48 matches the rendered 32px glyphs,
        // preserving the base 1.5 ratio (fontSize stays 16 in the style; RN scales
        // the glyphs at render time).
        expect(LIBRARY_TEXT.body.lineHeight / (LIBRARY_TEXT.body.fontSize * 2)).toBe(1.5);
    });

    it('keeps the unscaled base scale frozen for fixed-geometry surfaces', () => {
        jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
        for (const [name, base] of Object.entries(BASE_LINE_HEIGHTS)) {
            expect(LIBRARY_TEXT_BASE[name as keyof typeof LIBRARY_TEXT_BASE].lineHeight).toBe(base);
        }
        if (Platform.OS === 'web') return;
        // The scaled export stays live while the base stays pinned.
        expect(LIBRARY_TEXT.body.lineHeight).toBe(BASE_LINE_HEIGHTS.body * 2);
    });
});
