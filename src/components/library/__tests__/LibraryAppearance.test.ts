import * as fs from 'fs';
import * as path from 'path';

import {
    LIBRARY_RADIUS,
    LIBRARY_SPACING,
    MIN_TARGET,
    getLibraryAppearance,
} from '../LibraryAppearance';
import type { BookSectionColors } from '../LibraryAppearance';

const PHASES = ['daylight', 'golden', 'midnight'] as const;
type Phase = (typeof PHASES)[number];
type Token = keyof BookSectionColors;
type TokenRole = 'text' | 'largeText' | 'uiBoundary' | 'decorative';

interface TokenPair {
    /** Foreground token. */
    readonly token: Token;
    /** Surface the token is measured against. */
    readonly background: Token;
    /** Role that sets the minimum: WCAG 1.4.3 text, 1.4.11 boundary, or exempt. */
    readonly role: TokenRole;
}

/** DP-06 minimums. null = decorative, measured and declared but not gated. */
const MIN_CONTRAST: Record<TokenRole, number | null> = {
    text: 4.5,
    largeText: 3,
    uiBoundary: 3,
    decorative: null,
};

/**
 * The DP-06 pair registry (SDD-07 FU-1a). Every token in BookSectionColors must appear
 * here with the surface it is read on and the role that sets its minimum, so a new token
 * cannot ship unmeasured and a new surface cannot be measured against nothing.
 */
const BOOK_TOKEN_PAIRS: readonly TokenPair[] = [
    { token: 'textPrimary', background: 'bgPrimary', role: 'text' },
    { token: 'textPrimary', background: 'bgSecondary', role: 'text' },
    { token: 'textPrimary', background: 'bgCard', role: 'text' },
    { token: 'textPrimary', background: 'bgRaised', role: 'text' },
    { token: 'textSecondary', background: 'bgPrimary', role: 'text' },
    { token: 'textSecondary', background: 'bgSecondary', role: 'text' },
    { token: 'textSecondary', background: 'bgCard', role: 'text' },
    { token: 'textSecondary', background: 'bgRaised', role: 'text' },
    { token: 'textTertiary', background: 'bgPrimary', role: 'text' },
    { token: 'textTertiary', background: 'bgSecondary', role: 'text' },
    { token: 'textTertiary', background: 'bgCard', role: 'text' },
    { token: 'textTertiary', background: 'bgRaised', role: 'text' },
    { token: 'onAccent', background: 'accent', role: 'text' },
    { token: 'textOnAccent', background: 'accent', role: 'text' },
    { token: 'tagText', background: 'tagBackground', role: 'text' },
    { token: 'chipSelectedText', background: 'chipSelectedBackground', role: 'text' },
    { token: 'error', background: 'bgPrimary', role: 'text' },
    { token: 'error', background: 'bgCard', role: 'text' },
    { token: 'error', background: 'errorSurface', role: 'text' },
    { token: 'onErrorSurface', background: 'error', role: 'text' },
    { token: 'success', background: 'bgPrimary', role: 'text' },
    { token: 'success', background: 'bgCard', role: 'text' },
    { token: 'success', background: 'successSurface', role: 'text' },
    { token: 'info', background: 'bgPrimary', role: 'text' },
    { token: 'info', background: 'bgCard', role: 'text' },
    { token: 'info', background: 'infoSurface', role: 'text' },
    { token: 'coverPlaceholderInk', background: 'coverPlaceholder', role: 'text' },
    { token: 'accent', background: 'bgPrimary', role: 'uiBoundary' },
    { token: 'accent', background: 'bgCard', role: 'uiBoundary' },
    { token: 'accentPressed', background: 'bgPrimary', role: 'uiBoundary' },
    { token: 'accentPressed', background: 'bgCard', role: 'uiBoundary' },
    { token: 'chipSelectedBackground', background: 'bgPrimary', role: 'uiBoundary' },
    { token: 'controlBorder', background: 'bgPrimary', role: 'uiBoundary' },
    { token: 'controlBorder', background: 'bgSecondary', role: 'uiBoundary' },
    { token: 'controlBorder', background: 'bgCard', role: 'uiBoundary' },
    { token: 'focusRing', background: 'bgPrimary', role: 'uiBoundary' },
    { token: 'focusRing', background: 'bgCard', role: 'uiBoundary' },
    { token: 'divider', background: 'bgPrimary', role: 'decorative' },
    { token: 'divider', background: 'bgCard', role: 'decorative' },
    { token: 'border', background: 'bgPrimary', role: 'decorative' },
    { token: 'bgSecondary', background: 'bgPrimary', role: 'decorative' },
    { token: 'bgCard', background: 'bgPrimary', role: 'decorative' },
    { token: 'bgRaised', background: 'bgPrimary', role: 'decorative' },
    { token: 'tagBackground', background: 'bgPrimary', role: 'decorative' },
    { token: 'errorSurface', background: 'bgPrimary', role: 'decorative' },
    { token: 'successSurface', background: 'bgPrimary', role: 'decorative' },
    { token: 'infoSurface', background: 'bgPrimary', role: 'decorative' },
    { token: 'overlay', background: 'bgPrimary', role: 'decorative' },
    { token: 'coverPlaceholder', background: 'bgPrimary', role: 'decorative' },
    { token: 'coverPlaceholder', background: 'bgCard', role: 'decorative' },
    { token: 'shadow', background: 'bgCard', role: 'decorative' },
    { token: 'textDisabled', background: 'bgPrimary', role: 'decorative' },
    { token: 'textDisabled', background: 'bgCard', role: 'decorative' },
];

/** Tokens introduced by FU-1a; golden must not be a copy of daylight for any of them. */
const NEW_TOKENS: readonly Token[] = [
    'bgRaised', 'overlay', 'textOnAccent', 'textDisabled', 'accentPressed', 'focusRing',
    'divider', 'controlBorder', 'onErrorSurface', 'errorSurface', 'success', 'successSurface',
    'info', 'infoSurface', 'chipSelectedBackground', 'chipSelectedText',
    'coverPlaceholder', 'coverPlaceholderInk',
];

interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

const PAPER: Rgba = { r: 255, g: 255, b: 255, a: 1 };

const parseColor = (color: string): Rgba => {
    const value = color.trim();
    if (value.startsWith('rgba')) {
        const parts = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'))
            .split(',')
            .map((part) => Number.parseFloat(part.trim()));
        return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] };
    }
    return {
        r: Number.parseInt(value.slice(1, 3), 16),
        g: Number.parseInt(value.slice(3, 5), 16),
        b: Number.parseInt(value.slice(5, 7), 16),
        a: 1,
    };
};

/** Flatten a translucent colour onto what it is painted over before measuring it. */
const composite = (top: Rgba, bottom: Rgba): Rgba => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
});

const luminance = ({ r, g, b }: Rgba) => [r, g, b]
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrastRatio = (foreground: string, background: string) => {
    const back = composite(parseColor(background), PAPER);
    const front = composite(parseColor(foreground), back);
    const light = Math.max(luminance(front), luminance(back));
    const dark = Math.min(luminance(front), luminance(back));
    return (light + 0.05) / (dark + 0.05);
};

const measure = (phase: Phase, pair: TokenPair) => {
    const colors = getLibraryAppearance(phase);
    return contrastRatio(colors[pair.token], colors[pair.background]);
};

// Flattened so the it.each title can name each case on its own.
const registryCases = PHASES.flatMap((phase) => BOOK_TOKEN_PAIRS.map(({ token, background, role }) => ({
    phase,
    token,
    background,
    role,
    title: `${phase}: ${token} on ${background} (${role})`,
})));

describe('Book-section colour tokens', () => {
    it('declares a minimum for every role in the registry vocabulary', () => {
        expect(Object.keys(MIN_CONTRAST).sort()).toEqual(['decorative', 'largeText', 'text', 'uiBoundary']);
    });

    it.each(registryCases)('$title', ({ phase, token, background, role }) => {
        const ratio = measure(phase, { token, background, role });
        const minimum = MIN_CONTRAST[role];
        if (minimum === null) {
            // Decorative pairs carry no WCAG floor; they are still measured so a
            // malformed value (unparseable colour, zero-luminance surface) cannot slip past.
            expect(Number.isFinite(ratio)).toBe(true);
            expect(ratio).toBeGreaterThan(1);
            return;
        }
        const failures = ratio >= minimum
            ? []
            : [`${phase} ${token} on ${background} is ${ratio.toFixed(2)}:1, ${role} needs ${minimum}:1`];
        expect(failures).toEqual([]);
    });

    it('measures every registered pair in all three phases', () => {
        expect(registryCases).toHaveLength(PHASES.length * BOOK_TOKEN_PAIRS.length);
    });

    it('registers every token in the palette, with no unknown token in the registry', () => {
        const declared = new Set<Token>([
            ...BOOK_TOKEN_PAIRS.map((pair) => pair.token),
            ...BOOK_TOKEN_PAIRS.map((pair) => pair.background),
        ]);
        const actual = new Set<string>(Object.keys(getLibraryAppearance('daylight')));
        expect([...actual].filter((key) => !declared.has(key as Token))).toEqual([]);
        expect([...declared].filter((key) => !actual.has(key)).sort()).toEqual([]);
    });

    it('never measures a token against itself', () => {
        expect(BOOK_TOKEN_PAIRS.filter((pair) => pair.token === pair.background).map((pair) => pair.token))
            .toEqual([]);
    });

    it('defines the same keys in every phase', () => {
        const [first, ...rest] = PHASES.map((phase) => Object.keys(getLibraryAppearance(phase)).sort());
        for (const keys of rest) {
            expect(keys).toEqual(first);
        }
    });

    it.each(NEW_TOKENS)('derives %s separately for golden rather than reusing daylight', (token) => {
        const daylight = getLibraryAppearance('daylight');
        const golden = getLibraryAppearance('golden');
        expect(golden[token]).not.toEqual(daylight[token]);
    });

    it('keeps derived aliases equal to the token they alias, in every phase', () => {
        for (const phase of PHASES) {
            const colors = getLibraryAppearance(phase);
            expect(colors.textOnAccent).toEqual(colors.onAccent);
            expect(colors.divider).toEqual(colors.border);
            expect(colors.chipSelectedBackground).toEqual(colors.accent);
            expect(colors.chipSelectedText).toEqual(colors.onAccent);
        }
    });

    it('keeps the six pairs the first contrast test covered', () => {
        const legacy: readonly [Token, Token][] = [
            ['textPrimary', 'bgPrimary'],
            ['textSecondary', 'bgPrimary'],
            ['textPrimary', 'bgCard'],
            ['textSecondary', 'bgCard'],
            ['onAccent', 'accent'],
            ['tagText', 'tagBackground'],
        ];
        for (const [token, background] of legacy) {
            const registered = BOOK_TOKEN_PAIRS.filter((pair) => pair.token === token && pair.background === background);
            expect(registered.length).toBe(1);
            expect(registered[0].role).toBe('text');
        }
    });
});

describe('Spacing, radius and target scale', () => {
    const CANONICAL_KEYS = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;

    it('keeps the canonical spacing steps strictly increasing at the documented values', () => {
        const steps = CANONICAL_KEYS.map((key) => LIBRARY_SPACING[key]);
        expect(steps).toEqual([4, 8, 12, 16, 24, 32, 48]);
        for (let index = 1; index < steps.length; index += 1) {
            expect(steps[index]).toBeGreaterThan(steps[index - 1]);
        }
    });

    it('keeps small/medium/large aliases equal to their canonical steps', () => {
        expect(LIBRARY_SPACING.small).toBe(LIBRARY_SPACING.xs);
        expect(LIBRARY_SPACING.medium).toBe(LIBRARY_SPACING.md);
        expect(LIBRARY_SPACING.large).toBe(LIBRARY_SPACING.lg);
    });

    it('does not change the spacing values existing screens already render with', () => {
        expect(LIBRARY_SPACING.small).toBe(8);
        expect(LIBRARY_SPACING.medium).toBe(16);
        expect(LIBRARY_SPACING.large).toBe(24);
    });

    it('keeps the shipped radii and adds chip and dialog', () => {
        expect(LIBRARY_RADIUS).toEqual({ control: 12, card: 14, cabinet: 16, chip: 20, dialog: 18 });
    });

    it('takes chip and dialog from radii the book section already uses', () => {
        const read = (relative: string) => fs.readFileSync(path.join(__dirname, relative), 'utf8');
        // chip 20 came from the former status chips, which Flow A replaced with a radio group on `control`;
        // the LIBRARY_RADIUS assertion above still pins it. dialog 18: the quick-look sheet, and the shared
        // note dialog, which Flow B moved onto the token itself.
        expect(read('../../notes/ManualNoteUi.tsx')).toContain('borderRadius: LIBRARY_RADIUS.dialog');
        expect(read('../LibraryBookQuickLook.tsx')).toContain('borderRadius: 18');
    });

    it('exports a 48dp minimum target', () => {
        expect(MIN_TARGET).toBe(48);
    });
});
