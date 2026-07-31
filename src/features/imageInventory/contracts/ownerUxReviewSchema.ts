import { z } from 'zod';
import {
    languageSchema,
    isLanguageScriptCoherent,
    nullableSafeTextSchema,
    safeTextSchema,
} from './ownerUxValidation';

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();

const damageDisclosure = z.object({
    hasDamage: z.boolean(),
    damageTypes: z.array(z.enum([
        'cover',
        'binding',
        'pages',
        'water',
        'staining',
        'writing',
        'missing_parts',
        'mould_or_contamination',
        'other',
    ])).max(9),
    damageNote: nullableSafeTextSchema(1000),
    isSellable: z.boolean(),
    completeReadableSafe: z.boolean(),
}).strict();

const duplicateIntent = z.object({
    action: z.enum(['increment_quantity', 'create_separate', 'manual_match']),
    targetInventoryId: uuid.nullable(),
    adviceVersion: version,
}).strict();

export const ownerCandidateReviewSchema = z.object({
    originalTitle: safeTextSchema(1, 512),
    authors: z.array(safeTextSchema(1, 256)).max(20),
    originalLanguage: languageSchema,
    script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
    metadataChoice: z.object({
        mode: z.enum(['selected', 'manual']),
        selectionId: uuid.nullable(),
    }).strict(),
    quantity: z.number().int().min(1).max(10_000).safe(),
    priceMinor: z.number().int().min(0).max(2_147_483_647).safe(),
    baseCondition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
    damageDisclosure,
    shelfLocation: safeTextSchema(1, 120),
    notes: z.object({
        publicNote: nullableSafeTextSchema(1000),
        internalNote: nullableSafeTextSchema(1000),
    }).strict(),
    publicationIntent: z.enum(['private', 'publish']),
    duplicateIntent: duplicateIntent.nullable(),
    originalFieldConfirmation: z.object({
        title: z.boolean(),
        authors: z.array(z.boolean()).max(20),
    }).strict(),
    candidateDisposition: z.literal('reviewed'),
}).strict().superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    if (new Set(value.authors.map((author) => author.toLocaleLowerCase())).size
        !== value.authors.length) issue('authors must be unique');
    if (!value.originalFieldConfirmation.title) issue('title must be confirmed');
    if (
        value.originalFieldConfirmation.authors.length !== value.authors.length
        || value.originalFieldConfirmation.authors.some((confirmed) => !confirmed)
    ) issue('authors must be explicitly confirmed');
    if (
        (value.metadataChoice.mode === 'selected')
        !== (value.metadataChoice.selectionId !== null)
    ) issue('metadata selection is inconsistent');
    if (new Set(value.damageDisclosure.damageTypes).size
        !== value.damageDisclosure.damageTypes.length) issue('damage types must be unique');
    if (value.damageDisclosure.hasDamage) {
        if (
            value.damageDisclosure.damageTypes.length === 0
            || !value.damageDisclosure.damageNote
        ) issue('damage details are required');
    } else if (
        value.damageDisclosure.damageTypes.length > 0
        || value.damageDisclosure.damageNote
    ) issue('damage details require damage');
    if (
        value.damageDisclosure.isSellable
        && !value.damageDisclosure.completeReadableSafe
    ) issue('sellable books must be complete, readable and safe');
    if (
        value.damageDisclosure.damageTypes.includes('mould_or_contamination')
        && (
            value.damageDisclosure.isSellable
            || value.damageDisclosure.completeReadableSafe
            || value.publicationIntent !== 'private'
        )
    ) issue('mould or contamination must be unsellable, unsafe and private');
    if (
        (!value.damageDisclosure.isSellable || !value.damageDisclosure.completeReadableSafe)
        && value.publicationIntent !== 'private'
    ) issue('unsafe books must remain private');
    if (value.publicationIntent === 'publish' && value.priceMinor === 0) {
        issue('published books require a positive price');
    }
    if (
        value.script
        && !isLanguageScriptCoherent(
            [value.originalTitle, ...value.authors].join(' '),
            value.originalLanguage,
            value.script,
        )
    ) issue('language, script and text must be coherent');
    if (
        (value.duplicateIntent?.action === 'increment_quantity'
            || value.duplicateIntent?.action === 'manual_match')
        && !value.duplicateIntent.targetInventoryId
    ) issue('duplicate target is required');
    if (
        value.duplicateIntent?.action === 'create_separate'
        && value.duplicateIntent.targetInventoryId
    ) issue('separate copies cannot name a target');
});

export type OwnerCandidateReview = z.infer<typeof ownerCandidateReviewSchema>;
