import { z } from 'zod';
import { languageSchema, safeTextSchema } from '../contracts/ownerUxValidation';
import { ISBN_CHECK_ERROR_TEXT, normalizeIsbnClue } from './isbn';

export type MissedBookDraft = Readonly<{
    title: string;
    authors: string[];
    language: string;
    isbn: string;
}>;

const formSchema = z.object({
    title: safeTextSchema(1, 512),
    authors: z.array(safeTextSchema(1, 256)).max(20),
    language: languageSchema,
}).strict().superRefine((value, context) => {
    if (new Set(value.authors).size !== value.authors.length) {
        context.addIssue({ code: 'custom', path: ['authors'], message: 'Each author must be unique.' });
    }
});

export function createEmptyMissedBookDraft(languageHint = 'en'): MissedBookDraft {
    return { title: '', authors: [], language: languageHint, isbn: '' };
}

export type MissedBookBuildResult =
    | { success: true; value: z.infer<typeof formSchema>; isbn13: string | null }
    | { success: false; errors: Record<string, string> };

export function buildMissedBookRequest(draft: MissedBookDraft): MissedBookBuildResult {
    // SDD 01a §15.3 / PSR-R06: the add payload still has exactly three form fields.
    const result = formSchema.safeParse({ title: draft.title, authors: draft.authors, language: draft.language });
    const normalized = draft.isbn.trim() ? normalizeIsbnClue(draft.isbn) : null;
    const isbnError = normalized && (normalized.status !== 'valid' || !normalized.isbn13);
    if (result.success && !isbnError) return { success: true, value: result.data, isbn13: normalized?.isbn13 ?? null };
    const errors: Record<string, string> = {};
    if (isbnError) errors.isbn = ISBN_CHECK_ERROR_TEXT;
    for (const issue of result.error?.issues ?? []) {
        const field = String(issue.path[0] ?? 'form');
        errors[field] = field === 'title'
            ? 'Enter a title between 1 and 512 characters.'
            : field === 'language'
                ? 'Choose a valid language.'
                : 'Enter up to 20 unique authors, each 1 to 256 characters.';
    }
    return { success: false, errors };
}

export function missedBookFingerprint(draft: MissedBookDraft): string {
    return JSON.stringify(draft);
}
