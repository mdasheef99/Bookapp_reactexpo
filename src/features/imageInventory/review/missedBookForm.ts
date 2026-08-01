import { z } from 'zod';
import { languageSchema, safeTextSchema } from '../contracts/ownerUxValidation';

export type MissedBookDraft = Readonly<{
    title: string;
    authors: string[];
    language: string;
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

export function createEmptyMissedBookDraft(): MissedBookDraft {
    return { title: '', authors: [], language: 'en' };
}

export type MissedBookBuildResult =
    | { success: true; value: z.infer<typeof formSchema> }
    | { success: false; errors: Record<string, string> };

export function buildMissedBookRequest(draft: MissedBookDraft): MissedBookBuildResult {
    const result = formSchema.safeParse(draft);
    if (result.success) return { success: true, value: result.data };
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? 'form');
        errors[field] = field === 'title'
            ? 'Enter a title between 1 and 512 characters.'
            : field === 'language'
                ? 'Enter a valid BCP-47 language tag.'
                : 'Enter up to 20 unique authors, each 1 to 256 characters.';
    }
    return { success: false, errors };
}

export function missedBookFingerprint(draft: MissedBookDraft): string {
    return JSON.stringify(draft);
}
