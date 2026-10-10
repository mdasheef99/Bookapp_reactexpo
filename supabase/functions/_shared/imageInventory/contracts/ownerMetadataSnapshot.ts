import { z } from 'zod';
import {
  ownerUxLanguageSchema as language,
  ownerUxNullableSafeTextSchema as nullableSafeText,
  ownerUxSafeTextSchema as safeText,
} from './ownerUxReview.ts';

// Shared Owner-safe metadata fields: edition-picker SDD §§5–7/9.
const coverReference = z.string().min(1).max(512).superRefine((value, context) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.hostname.toLowerCase() !== 'books.google.com') throw new Error();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'cover host is not approved' });
  }
});
export const representativeCover = z.object({
  coverReference,
  sourceRelation: z.literal('representative_edition'),
  sourceAdapter: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/u),
  sourceAdapterVersion: z.string().min(1).max(64),
  sourceRecordId: z.string().min(1).max(256),
  selectionPolicyVersion: z.literal('p9-representative-cover-v1'),
}).strict();
export const ownerMetadataSnapshotSchema = z.object({
  title: safeText(1, 512),
  authors: z.array(safeText(1, 256)).min(1).max(20), language,
  subtitle: nullableSafeText(512),
  description: nullableSafeText(5000),
  isbn10: z.string().min(10).max(32).nullable(), isbn13: z.string().min(10).max(32).nullable(),
  publisher: nullableSafeText(256),
  publishedDate: nullableSafeText(32),
  script: nullableSafeText(16),
  editionStatement: nullableSafeText(256),
  series: nullableSafeText(256), volume: nullableSafeText(64),
  format: nullableSafeText(128),
  pageCount: z.number().int().min(1).max(100_000).nullable(),
  categories: z.array(safeText(1, 128)).max(20),
  coverReference: coverReference.nullable(),
}).strict();
