import { z } from 'zod';
import { uuidSchema } from './ownerUxCommonSchemas';
import { languageSchema, safeTextSchema } from './ownerUxValidation';

const idempotencyKeySchema = z.string().min(16).max(128)
    .regex(/^[A-Za-z0-9._:-]+$/u);

export const addManualCandidateRequestSchema = z.object({
    sessionId: uuidSchema,
    title: safeTextSchema(1, 512),
    authors: z.array(safeTextSchema(1, 256)).max(20),
    language: languageSchema,
    idempotencyKey: idempotencyKeySchema,
    commandId: uuidSchema,
}).strict().superRefine((value, context) => {
    const normalized = value.authors.map((author) => author.normalize('NFC'));
    if (new Set(normalized).size !== normalized.length) {
        context.addIssue({ code: 'custom', path: ['authors'], message: 'authors must be unique' });
    }
});

export const candidateUuidSchema = uuidSchema;
