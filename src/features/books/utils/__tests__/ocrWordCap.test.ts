import {
    getWordCount,
    capWords,
    capOcrToNoteLimit,
    buildVaultExcerpt,
    capToVaultLimits,
    NOTE_WORD_LIMIT,
    VAULT_EXCERPT_LIMIT,
    VAULT_FULL_TEXT_LIMIT,
    VAULT_WORD_LIMIT,
    isWithinVaultCharLimits,
} from '../ocrWordCap';

describe('ocrWordCap', () => {
    it('matches PostgreSQL code-point limits for emoji', () => {
        expect(isWithinVaultCharLimits('😀'.repeat(800), '😀'.repeat(4000))).toBe(true);
        expect(isWithinVaultCharLimits('😀'.repeat(801), 'ok')).toBe(false);
    });
    it('builds an 800-code-point excerpt without splitting Unicode', () => {
        expect(buildVaultExcerpt('😀'.repeat(801))).toBe('😀'.repeat(800));
    });
    it('getWordCount counts correctly', () => {
        expect(getWordCount('')).toBe(0);
        expect(getWordCount('  hello   world  ')).toBe(2);
        expect(getWordCount('one')).toBe(1);
        expect(getWordCount('a b c d e')).toBe(5);
    });

    it('capWords truncates at limit', () => {
        const text = Array.from({ length: 600 }, (_, i) => `w${i}`).join(' ');
        expect(getWordCount(capWords(text, 500))).toBe(500);
        expect(capWords('hello world', 500)).toBe('hello world');
        expect(getWordCount(capWords('', 500))).toBe(0);
    });

    it('capOcrToNoteLimit returns truncated flag and capped 500', () => {
        const under = Array.from({ length: 400 }, () => 'word').join(' ');
        const over = Array.from({ length: 501 }, () => 'word').join(' ');
        expect(capOcrToNoteLimit(under).wasTruncated).toBe(false);
        expect(capOcrToNoteLimit(under).cappedWordCount).toBe(400);
        const res = capOcrToNoteLimit(over);
        expect(res.wasTruncated).toBe(true);
        expect(res.cappedWordCount).toBe(NOTE_WORD_LIMIT);
        expect(res.originalWordCount).toBe(501);
    });

    it('buildVaultExcerpt slices at 800', () => {
        const long = 'a'.repeat(1000);
        expect(buildVaultExcerpt(long).length).toBe(VAULT_EXCERPT_LIMIT);
        expect(buildVaultExcerpt('short').length).toBe(5);
    });

    it('vault limits constants are 800/4000/800', () => {
        expect(VAULT_EXCERPT_LIMIT).toBe(800);
        expect(VAULT_FULL_TEXT_LIMIT).toBe(4000);
        expect(VAULT_WORD_LIMIT).toBe(800);
        expect(NOTE_WORD_LIMIT).toBe(500);
    });

    describe('capToVaultLimits', () => {
        it('returns text unchanged when within both limits', () => {
            const r = capToVaultLimits('hello world');
            expect(r.capped).toBe('hello world');
            expect(r.wasTrimmed).toBe(false);
        });

        it('caps by words when word limit binds first', () => {
            const over = Array.from({ length: 801 }, (_, i) => `w${i}`).join(' ');
            const r = capToVaultLimits(over);
            expect(getWordCount(r.capped)).toBe(VAULT_WORD_LIMIT);
            expect(r.wasTrimmed).toBe(true);
        });

        it('caps at 4000 chars on a word boundary when char limit binds first', () => {
            // 700 words x 6 chars = 4200 chars > 4000 but only 700 words < 800
            const long = Array.from({ length: 700 }, () => 'xxxxx').join(' ');
            expect(getWordCount(long)).toBe(700);
            expect(long.length).toBeGreaterThan(4000);
            const r = capToVaultLimits(long);
            expect(r.capped.length).toBeLessThanOrEqual(4000);
            expect(r.wasTrimmed).toBe(true);
            expect(r.capped.endsWith(' ')).toBe(false);
        });

        it('handles single word longer than 4000 chars', () => {
            const r = capToVaultLimits('a'.repeat(4001));
            expect(r.capped.length).toBe(4000);
            expect(r.wasTrimmed).toBe(true);
        });

        it('never splits a surrogate pair at the cut', () => {
            // Emoji are surrogate pairs; place one right at the 4000 boundary
            const base = 'x'.repeat(3999);
            const r = capToVaultLimits(base + '😀 more text');
            expect(/[\uD800-\uDBFF]$/.test(r.capped)).toBe(false);
        });
    });
});
