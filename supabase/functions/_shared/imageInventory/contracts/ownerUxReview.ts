import { z } from 'zod';
import { canonicalBcp47, requiredString } from '../domain/validation.ts';
import {
  assertSourceLanguageScript,
  parseSupportedSearchVariantScript,
} from './searchVariantScripts.ts';

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
export const ownerUxSafeTextSchema = (minimum: number, maximum: number) =>
  z.string().superRefine((value, context) => {
    try {
      if (requiredString(value, 'text', maximum).length < minimum) throw new Error();
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid safe text' });
    }
  }).transform((value) => requiredString(value, 'text', maximum));
export const ownerUxNullableSafeTextSchema = (maximum: number) =>
  z.string().nullable().superRefine((value, context) => {
    if (value === null || value.trim().length === 0) return;
    try {
      requiredString(value, 'text', maximum);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid safe text' });
    }
  }).transform((value) => {
    if (value === null) return null;
    return value.trim().length === 0 ? null : requiredString(value, 'text', maximum);
  });

export const ownerUxLanguageSchema = z.string().superRefine((value, context) => {
  try {
    canonicalBcp47(value);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid language tag' });
  }
}).transform((value) => canonicalBcp47(value));

const metadataChoice = z.object({
  mode: z.enum(['manual', 'selected']), selectionId: uuid.nullable(),
}).strict();
const damageDisclosure = z.object({
  hasDamage: z.boolean(),
  damageTypes: z.array(z.enum([
    'cover', 'binding', 'pages', 'water', 'staining', 'writing',
    'missing_parts', 'mould_or_contamination', 'other',
  ])).max(9),
  damageNote: ownerUxNullableSafeTextSchema(1000),
  isSellable: z.boolean(),
  completeReadableSafe: z.boolean(),
}).strict();
const duplicateIntent = z.object({
  action: z.enum(['increment_quantity', 'create_separate', 'manual_match']),
  targetInventoryId: uuid.nullable(),
  adviceVersion: version,
}).strict().nullable();

export const ownerUxReviewSchema = z.object({
  originalTitle: ownerUxSafeTextSchema(1, 512),
  authors: z.array(ownerUxSafeTextSchema(1, 256)).max(20),
  originalLanguage: ownerUxLanguageSchema,
  script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
  metadataChoice,
  quantity: z.number().int().min(1).max(10_000).safe(),
  priceMinor: z.number().int().min(0).max(2_147_483_647).safe(),
  baseCondition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
  damageDisclosure,
  shelfLocation: ownerUxSafeTextSchema(1, 120),
  notes: z.object({
    publicNote: ownerUxNullableSafeTextSchema(1000),
    internalNote: ownerUxNullableSafeTextSchema(1000),
  }).strict(),
  publicationIntent: z.enum(['private', 'publish']),
  duplicateIntent,
  originalFieldConfirmation: z.object({
    title: z.boolean(), authors: z.array(z.boolean()).max(20),
  }).strict(),
  candidateDisposition: z.literal('reviewed'),
}).strict().superRefine((value, context) => {
  const issue = (message: string) =>
    context.addIssue({ code: z.ZodIssueCode.custom, message });
  if (new Set(value.authors.map((author) => author.toLocaleLowerCase())).size !==
      value.authors.length) issue('authors must be unique');
  if (!value.originalFieldConfirmation.title) issue('title must be confirmed');
  if (value.originalFieldConfirmation.authors.length !== value.authors.length ||
      value.originalFieldConfirmation.authors.some((confirmed) => !confirmed)) {
    issue('authors must be explicitly confirmed');
  }
  if ((value.metadataChoice.mode === 'selected') !==
      (value.metadataChoice.selectionId !== null)) issue('metadata selection is inconsistent');
  if (new Set(value.damageDisclosure.damageTypes).size !==
      value.damageDisclosure.damageTypes.length) issue('damage types must be unique');
  if (value.damageDisclosure.hasDamage) {
    if (value.damageDisclosure.damageTypes.length === 0 ||
        !value.damageDisclosure.damageNote) issue('damage details are required');
  } else if (value.damageDisclosure.damageTypes.length > 0 ||
      value.damageDisclosure.damageNote) issue('damage details require damage');
  if (value.damageDisclosure.isSellable &&
      !value.damageDisclosure.completeReadableSafe) {
    issue('sellable books must be complete, readable and safe');
  }
  if ((!value.damageDisclosure.isSellable ||
      !value.damageDisclosure.completeReadableSafe) &&
      value.publicationIntent !== 'private') issue('unsafe books must remain private');
  if (value.publicationIntent === 'publish' && value.priceMinor === 0) {
    issue('published books require a positive price');
  }
  if (value.script) {
    try {
      const parsed = parseSupportedSearchVariantScript(value.script, 'script');
      assertSourceLanguageScript(
        [value.originalTitle, ...value.authors].join(' '),
        value.originalLanguage,
        parsed,
        'review text',
      );
    } catch {
      issue('language, script and text must be coherent');
    }
  }
  if (value.duplicateIntent?.action === 'increment_quantity' ||
      value.duplicateIntent?.action === 'manual_match') {
    if (!value.duplicateIntent.targetInventoryId) issue('duplicate target is required');
  }
  if (value.duplicateIntent?.action === 'create_separate' &&
      value.duplicateIntent.targetInventoryId) issue('separate copies cannot name a target');
});
