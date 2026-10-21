import { ThemePhase, useTheme } from '@/hooks/useTheme';

// Library surfaces share the app's existing time phase, with a reading-room palette.
// Book and cabinet materials retain their physical colors in every phase.
//
// SDD-07 FU-1a: one semantic token set per phase (DP-06). Token names are fixed by
// SDD-07-FOUNDATION-PLAN §3; every phase must define every name, so a missing role is a
// compile error here instead of an undefined colour at runtime. Values marked PROPOSED
// are derived from each phase's own palette and await owner approval of the swatch
// table in .spec-out/swatches.md. Existing token values are frozen: the finished
// shelf and home already render with them.
export interface BookSectionColors {
    // Surfaces
    bgPrimary: string;
    bgSecondary: string;
    bgCard: string;
    /** PROPOSED - dialogs/sheets, lifted off bgCard without changing it. */
    bgRaised: string;
    /** PROPOSED - scrim behind modals; the phase's shadow hue at partial alpha. */
    overlay: string;
    // Text
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    /** Alias of onAccent. */
    textOnAccent: string;
    /** PROPOSED - disabled controls only (WCAG 1.4.3 exempt); never placeholder text. */
    textDisabled: string;
    onAccent: string;
    // Accent
    accent: string;
    /** PROPOSED - pressed fill, one step from accent. */
    accentPressed: string;
    /** PROPOSED - focus indicator, the one boundary that must clear 3:1 on every surface. */
    focusRing: string;
    // Lines
    /** Alias of border. Decorative: today's border sits at 1.37-1.80:1. */
    divider: string;
    border: string;
    /** PROPOSED - the only permitted boundary of inputs and secondary buttons (>= 3:1). */
    controlBorder: string;
    // Status
    error: string;
    /** PROPOSED - ink when error is used as a fill (the onAccent/error pattern). */
    onErrorSurface: string;
    /** PROPOSED - tinted banner/dialog surface; error is the ink on it. */
    errorSurface: string;
    /** PROPOSED - muted sage, desaturated to sit in the paper palette. */
    success: string;
    /** PROPOSED - tinted surface success is written on. */
    successSurface: string;
    /** PROPOSED - muted slate, informational only. */
    info: string;
    /** PROPOSED - tinted surface info is written on. */
    infoSurface: string;
    // Chips
    tagBackground: string;
    tagText: string;
    /** PROPOSED - selected chip fill: the accent fill, so contrast holds by construction. */
    chipSelectedBackground: string;
    /** PROPOSED - selected chip ink: onAccent. */
    chipSelectedText: string;
    // Placeholders
    /** PROPOSED - muted cloth/paper block; never white in a dark phase (audit #3). */
    coverPlaceholder: string;
    /** PROPOSED - ink read on coverPlaceholder. */
    coverPlaceholderInk: string;
    // Elevation
    shadow: string;
}

/** Derived names are computed, never restated, so they cannot drift from their source. */
type PaletteAliasKey = 'textOnAccent' | 'divider' | 'chipSelectedBackground' | 'chipSelectedText';
type PaletteBase = Omit<BookSectionColors, PaletteAliasKey>;

const daylightPalette: PaletteBase = {
    bgPrimary: '#faf6ee', bgSecondary: '#eee5d6', bgCard: '#fffdf8', bgRaised: '#fffaf0',
    overlay: 'rgba(39, 28, 19, 0.55)',
    textPrimary: '#30291f', textSecondary: '#685d4d', textTertiary: '#6f6350', textDisabled: '#a4987f',
    accent: '#3e3225', accentPressed: '#2b2219', focusRing: '#7a5c33', onAccent: '#fffaf1',
    border: '#ded3c1', controlBorder: '#8a7c60',
    error: '#ad3f36', errorSurface: '#f9ebe8', onErrorSurface: '#fff8f4',
    success: '#3f6b4a', successSurface: '#e6efe6', info: '#2f5670', infoSurface: '#e6eef3',
    tagBackground: '#ede7d7', tagText: '#514634',
    coverPlaceholder: '#e6dcc8', coverPlaceholderInk: '#5f5343',
    shadow: '#271c13',
};

const goldenPalette: PaletteBase = {
    bgPrimary: '#fbf2e4', bgSecondary: '#f0e0c8', bgCard: '#fff9ed', bgRaised: '#fff8e8',
    overlay: 'rgba(51, 35, 21, 0.55)',
    textPrimary: '#33271d', textSecondary: '#6a5845', textTertiary: '#755c48', textDisabled: '#a68f70',
    accent: '#493627', accentPressed: '#34261b', focusRing: '#86632f', onAccent: '#fff8ec',
    border: '#deceb6', controlBorder: '#93794f',
    error: '#9c382f', errorSurface: '#f9e7e2', onErrorSurface: '#fff7f0',
    success: '#43613f', successSurface: '#e8efdf', info: '#33566b', infoSurface: '#e7eef1',
    tagBackground: '#efdfc9', tagText: '#58412b',
    coverPlaceholder: '#e8d6b6', coverPlaceholderInk: '#64503e',
    shadow: '#332315',
};

const midnightPalette: PaletteBase = {
    bgPrimary: '#211e1a', bgSecondary: '#383229', bgCard: '#2d2923', bgRaised: '#37312a',
    overlay: 'rgba(5, 4, 2, 0.62)',
    textPrimary: '#f3eada', textSecondary: '#c4b8a4', textTertiary: '#b4a58c', textDisabled: '#6e6252',
    accent: '#dfc496', accentPressed: '#c9ab77', focusRing: '#f0d9ae', onAccent: '#2c2318',
    border: '#504638', controlBorder: '#8d7f66',
    error: '#ffb3a6', errorSurface: '#402723', onErrorSurface: '#2b1512',
    success: '#a9c69b', successSurface: '#2b3327', info: '#a8c6d6', infoSurface: '#232f36',
    tagBackground: '#423a2e', tagText: '#e2cba7',
    coverPlaceholder: '#3a332a', coverPlaceholderInk: '#b8a98f',
    shadow: '#050402',
};

const withAliases = (base: PaletteBase): BookSectionColors => ({
    ...base,
    textOnAccent: base.onAccent,
    divider: base.border,
    chipSelectedBackground: base.accent,
    chipSelectedText: base.onAccent,
});

const appearances: Record<ThemePhase, BookSectionColors> = {
    daylight: withAliases(daylightPalette),
    golden: withAliases(goldenPalette),
    midnight: withAliases(midnightPalette),
};

const CANONICAL_SPACING = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

// small/medium/large are the aliases existing screens already import; they point at the
// canonical steps so the two names can never disagree.
export const LIBRARY_SPACING = {
    ...CANONICAL_SPACING,
    small: CANONICAL_SPACING.xs,
    medium: CANONICAL_SPACING.md,
    large: CANONICAL_SPACING.lg,
} as const;

// control/card/cabinet are the shipped radii. chip: 20 and dialog: 18 are taken from
// radii already in use in the book section (StatusSelector option 20, the former TagSelector tag
// 20, ManualNoteUi dialog 18, LibraryBookQuickLook panel 18).
export const LIBRARY_RADIUS = { control: 12, card: 14, cabinet: 16, chip: 20, dialog: 18 } as const;

/** DP-06 project target minimum, stricter than WCAG 2.5.8's 24px. */
export const MIN_TARGET = 48;

export const getLibraryAppearance = (phase: ThemePhase) => appearances[phase];

export function useLibraryAppearance() {
    const { phase } = useTheme();
    return getLibraryAppearance(phase ?? 'daylight');
}