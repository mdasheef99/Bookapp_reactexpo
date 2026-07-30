import { z } from 'zod';

const controlOrBidi = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const activeContent = /(?:https?:\/\/|file:\/\/|javascript:|data:text\/html|<\/?[a-z][^>]*>|\[[^\]]+\]\([^)]*\)|(?:^|\s)(?:\.\.?[/\\]|[A-Za-z]:\\|\\\\[^\s\\]+\\[^\s\\]+|\/(?:[^/\s]+\/)+[^/\s]+)|\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM|DROP\s+(?:TABLE|SCHEMA|DATABASE)|ALTER\s+(?:TABLE|SCHEMA)|TRUNCATE\s+TABLE)\b|\b(?:curl|wget|powershell|cmd\.exe|bash|sh)\s+[-/]|\brm\s+-rf\b)/iu;

export function normalizeSafeText(value: string, maximum: number): string {
    const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!normalized || normalized.length > maximum || controlOrBidi.test(normalized)
        || activeContent.test(normalized)) {
        throw new Error('invalid safe text');
    }
    return normalized;
}

export const safeTextSchema = (minimum: number, maximum: number) => z.string()
    .superRefine((value, context) => {
        try {
            if (normalizeSafeText(value, maximum).length < minimum) throw new Error();
        } catch {
            context.addIssue({ code: 'custom', message: 'invalid safe text' });
        }
    })
    .transform((value) => normalizeSafeText(value, maximum));

export const nullableSafeTextSchema = (maximum: number) => z.string().nullable()
    .superRefine((value, context) => {
        if (value === null || value.trim().length === 0) return;
        try {
            normalizeSafeText(value, maximum);
        } catch {
            context.addIssue({ code: 'custom', message: 'invalid safe text' });
        }
    })
    .transform((value) => {
        if (value === null || value.trim().length === 0) return null;
        return normalizeSafeText(value, maximum);
    });

export function canonicalBcp47(value: string): string {
    const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
    const parts = normalized.split('-');
    if (
        normalized.length > 35
        || controlOrBidi.test(normalized)
        || !/^[A-Za-z]{2,3}$/u.test(parts[0])
        || parts.some((part) => !/^[A-Za-z0-9]{2,8}$/u.test(part))
    ) {
        throw new Error('invalid language tag');
    }
    return parts.map((part, index) => {
        if (index === 0) return part.toLowerCase();
        if (part.length === 4 && /^[A-Za-z]+$/u.test(part)) {
            return `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`;
        }
        if ((part.length === 2 && /^[A-Za-z]+$/u.test(part)) || /^\d{3}$/u.test(part)) {
            return part.toUpperCase();
        }
        return part.toLowerCase();
    }).join('-');
}

export const languageSchema = z.string()
    .superRefine((value, context) => {
        try {
            canonicalBcp47(value);
        } catch {
            context.addIssue({ code: 'custom', message: 'invalid language tag' });
        }
    })
    .transform(canonicalBcp47);

const scriptPatterns = {
    Latn: /\p{Script=Latin}/gu,
    Knda: /\p{Script=Kannada}/gu,
    Taml: /\p{Script=Tamil}/gu,
    Telu: /\p{Script=Telugu}/gu,
    Mlym: /\p{Script=Malayalam}/gu,
    Deva: /\p{Script=Devanagari}/gu,
    Arab: /\p{Script=Arabic}/gu,
    Mtei: /\p{Script=Meetei_Mayek}/gu,
} as const;
const languageScripts: Record<string, keyof typeof scriptPatterns> = {
    en: 'Latn',
    kn: 'Knda',
    ta: 'Taml',
    te: 'Telu',
    ml: 'Mlym',
    hi: 'Deva',
    ur: 'Arab',
    mni: 'Mtei',
};

export function isLanguageScriptCoherent(
    text: string,
    language: string,
    script: string,
): boolean {
    if (!(script in scriptPatterns)) return false;
    const parsedScript = script as keyof typeof scriptPatterns;
    const explicit = language.split('-').slice(1).find((part) => /^[A-Z][a-z]{3}$/u.test(part));
    if (explicit && explicit !== parsedScript) return false;
    const expected = languageScripts[language.split('-')[0]];
    if (expected && parsedScript !== expected && parsedScript !== 'Latn') return false;
    const letters = text.match(/\p{L}/gu) ?? [];
    const matching = text.match(scriptPatterns[parsedScript]) ?? [];
    return letters.length > 0 && matching.length / letters.length >= 0.6;
}
