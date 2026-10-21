export const NOTE_WORD_LIMIT = 500;
export const VAULT_EXCERPT_LIMIT = 800;
export const VAULT_FULL_TEXT_LIMIT = 4000;
export const VAULT_WORD_LIMIT = 800;

export function getWordCount(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
}

export function capWords(text: string, limit: number): string {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= limit) return trimmed;
    return words.slice(0, limit).join(' ');
}

export function isWithinNoteWordLimit(text: string): boolean {
    return getWordCount(text) <= NOTE_WORD_LIMIT;
}

export function isWithinVaultCharLimits(excerpt: string, fullText: string): boolean {
    return Array.from(excerpt).length <= VAULT_EXCERPT_LIMIT && Array.from(fullText).length <= VAULT_FULL_TEXT_LIMIT;
}

export function isWithinVaultWordLimit(text: string): boolean {
    return getWordCount(text) <= VAULT_WORD_LIMIT;
}

export function buildVaultExcerpt(fullText: string): string {
    const trimmed = fullText.trim();
    return Array.from(trimmed).slice(0, VAULT_EXCERPT_LIMIT).join('');
}

export type OcrCapResult = {
    capped: string;
    wasTruncated: boolean;
    originalWordCount: number;
    cappedWordCount: number;
};

export function capOcrToNoteLimit(rawText: string): OcrCapResult {
    const originalWordCount = getWordCount(rawText);
    const capped = capWords(rawText, NOTE_WORD_LIMIT);
    return {
        capped,
        wasTruncated: originalWordCount > NOTE_WORD_LIMIT,
        originalWordCount,
        cappedWordCount: getWordCount(capped),
    };
}

/**
 * Fit text into BOTH vault limits (800 words AND 4000 chars) — whichever binds first.
 * Cuts at word boundaries and never splits a surrogate pair.
 * The DB enforces char_length(full_text) <= 4000 as a hard CHECK, so ~700+ word pages
 * must be trimmed client-side instead of rejected (SDD-03 §3 limits note).
 */
export function capToVaultLimits(text: string): { capped: string; wasTrimmed: boolean } {
    const trimmed = text.trim();
    if (!trimmed) return { capped: '', wasTrimmed: false };

    const byWords = capWords(trimmed, VAULT_WORD_LIMIT);
    let result = byWords;
    if (Array.from(result).length > VAULT_FULL_TEXT_LIMIT) {
        result = Array.from(result).slice(0, VAULT_FULL_TEXT_LIMIT).join('');
        // Fall back to the last full word under the limit
        const lastSpace = result.lastIndexOf(' ');
        if (lastSpace >= 0 && Array.from(result.slice(0, lastSpace)).length >= Math.floor(VAULT_FULL_TEXT_LIMIT * 0.5)) {
            result = result.slice(0, lastSpace);
        }
        if (/[\uD800-\uDBFF]$/.test(result)) result = result.slice(0, -1);
    }
    return { capped: result, wasTrimmed: result !== trimmed };
}
