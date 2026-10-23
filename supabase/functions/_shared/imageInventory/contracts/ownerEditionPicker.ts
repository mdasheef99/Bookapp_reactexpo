import { z } from 'zod';
import { OWNER_UX_CONTRACT_VERSION } from './versions.ts';
import { ownerMetadataSnapshotSchema as metadataSnapshotSchema } from './ownerMetadataSnapshot.ts';
import type { MetadataEdition } from './metadata.ts';

// Owner edition-picker SDD §§5–7/9: strict wire contracts, no lookup or persistence.
const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
const count = z.number().int().nonnegative().safe();
const timestamp = z.string().datetime({ offset: true });
const contractVersion = z.literal(OWNER_UX_CONTRACT_VERSION);
const command = {
  contractVersion, sessionId: uuid, candidateId: uuid,
  commandId: uuid, idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u),
};
const selectCommand = {
  ...command, action: z.literal('select_candidate_edition'),
  expectedCandidateVersion: version, expectedMetadataRevision: version,
  expectedReviewVersion: version.nullable(),
};

export const editionRequestSchemas = {
  read_candidate_edition_choices: z.object({
    action: z.literal('read_candidate_edition_choices'), contractVersion,
    sessionId: uuid, candidateId: uuid,
  }).strict(),
  request_candidate_edition_options: z.object({
    ...command, action: z.literal('request_candidate_edition_options'),
    expectedRequestGeneration: count,
  }).strict(),
  // Slice 5 SDD §§5.5/7: the server validates the check digit; this boundary checks shape.
  set_candidate_isbn: z.object({
    ...command, action: z.literal('set_candidate_isbn'),
    expectedCandidateVersion: version, isbn13: z.string().regex(/^97[89][0-9]{10}$/u).nullable(),
  }).strict(),
  select_candidate_edition: z.discriminatedUnion('source', [
    z.object({
      ...selectCommand, source: z.literal('edition_option'), optionsVersion: version, optionId: uuid,
    }).strict(),
    z.object({
      ...selectCommand, source: z.literal('current_suggestion'), selectionId: uuid,
    }).strict(),
  ]),
} as const;

// Legacy wire key: approved book link; provider attribution comes from its validated host.
const googleBooksUrl = z.string().min(1).max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname.toLowerCase() === 'books.google.com' || (url.hostname === 'openlibrary.org' && /^\/books\/OL[1-9][0-9]*M$/u.test(url.pathname) && !url.search && !url.hash))
      && !url.username && !url.password && !url.port
      && /^\/books(?:\/|$)/u.test(url.pathname);
  } catch { return false; }
}, 'book link is not approved');

// Owner decision2026-10-13 / picker §3.1/§9: display-only, opt-in compatible reasons.
export const EDITION_REASONS_CLIENT_INFO = 'bookconnect/edition-reasons-v1' as const;
export const EDITION_REASONS_V2_CLIENT_INFO = 'bookconnect/edition-reasons-v2' as const;
export const editionRejectionReasonSchema = z.enum([
  'title_differs', 'author_differs', 'language_unknown', 'language_differs',
  'volume_differs', 'identity_unverified', 'result_unavailable',
]);
export type EditionRejectionReason = z.infer<typeof editionRejectionReasonSchema>;

export const editionRowSchema = z.object({
  optionId: uuid, ordinal: z.number().int().min(0).max(9).safe(),
  googleBooksUrl: googleBooksUrl.nullable(),
  eligibility: z.enum(['eligible', 'ineligible', 'unavailable']),
  rejectionReason: editionRejectionReasonSchema.nullable().optional(),
  metadata: metadataSnapshotSchema.nullable(),
}).strict().superRefine((row, context) => {
  if (row.rejectionReason != null && (row.eligibility === 'eligible'
    || (row.rejectionReason === 'result_unavailable') !== (row.eligibility === 'unavailable'))) {
    context.addIssue({ code: 'custom', message: 'edition rejection reason is inconsistent' });
  }
  if ((row.eligibility === 'unavailable') !== (row.metadata === null)
    || (row.metadata !== null && row.googleBooksUrl === null)) {
    context.addIssue({ code: 'custom', message: 'edition row is inconsistent' });
  }
});

const editionSelection = z.discriminatedUnion('source', [
  z.object({
    selectionId: uuid, source: z.literal('edition_option'), optionId: uuid,
    snapshot: metadataSnapshotSchema, confirmedByOwner: z.boolean(),
  }).strict(),
  z.object({
    selectionId: uuid, source: z.literal('current_suggestion'), optionId: z.null(),
    snapshot: metadataSnapshotSchema, confirmedByOwner: z.boolean(),
  }).strict(),
]);
export const editionChoicesSchema = z.object({
  sessionId: uuid, candidateId: uuid, requestGeneration: count, optionsVersion: count,
  optionsExpiresAt: timestamp.nullable(), rows: z.array(editionRowSchema).max(10),
  selection: editionSelection.nullable(), lookupStatus: z.enum(['idle', 'pending', 'ready', 'failed']),
  candidateVersion: version, metadataRevision: version, reviewVersion: version.nullable(),
  ownerIsbn13: z.string().regex(/^97[89][0-9]{10}$/u).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.rows.some((row, index) => row.ordinal !== index)
    || new Set(value.rows.map((row) => row.optionId)).size !== value.rows.length
    || (value.rows.length > 0 && (value.optionsExpiresAt === null || value.optionsVersion === 0))) {
    context.addIssue({ code: 'custom', message: 'edition choices are inconsistent' });
  }
});
export const editionLookupReceiptSchema = z.object({
  operationId: uuid.nullable(), status: z.enum(['pending', 'ready', 'failed']),
  requestGeneration: count, optionsVersion: count, available: z.boolean(),
}).strict();
export const setCandidateIsbnResponseSchema = z.object({
  sessionId: uuid, candidateId: uuid, candidateVersion: version, metadataRevision: version,
  requestGeneration: count, ownerIsbn13: z.string().regex(/^97[89][0-9]{10}$/u).nullable(),
}).strict();

export const editionResponseSchemas = {
  read_candidate_edition_choices: editionChoicesSchema,
  request_candidate_edition_options: editionLookupReceiptSchema,
  select_candidate_edition: editionChoicesSchema,
  set_candidate_isbn: setCandidateIsbnResponseSchema,
} as const;

export type ReadEditionChoicesRequest = z.infer<typeof editionRequestSchemas.read_candidate_edition_choices>;
export type RequestEditionOptionsRequest = z.infer<typeof editionRequestSchemas.request_candidate_edition_options>;
export type SelectEditionRequest = z.infer<typeof editionRequestSchemas.select_candidate_edition>;
export type SetCandidateIsbnRequest = z.infer<typeof editionRequestSchemas.set_candidate_isbn>;
export type OwnerEditionPickerRequest = ReadEditionChoicesRequest | RequestEditionOptionsRequest | SelectEditionRequest | SetCandidateIsbnRequest;
export type OwnerEditionPickerAction = keyof typeof editionRequestSchemas;
export type EditionDisplayMetadata = z.infer<typeof metadataSnapshotSchema>;
export type EditionRow = z.infer<typeof editionRowSchema>;
export type EditionSelection = z.infer<typeof editionSelection>;
export type EditionChoices = z.infer<typeof editionChoicesSchema>;
export type EditionLookupReceipt = z.infer<typeof editionLookupReceiptSchema>;
export type SetCandidateIsbnResponse = z.infer<typeof setCandidateIsbnResponseSchema>;

export function parseOwnerEditionPickerRequest(value: unknown): OwnerEditionPickerRequest {
  const action = value && typeof value === 'object' ? (value as { action?: unknown }).action : undefined;
  const schema = typeof action === 'string' ? editionRequestSchemas[action as OwnerEditionPickerAction] : undefined;
  const result = schema?.safeParse(value);
  if (!result?.success) throw new Error('invalid Owner edition-picker request');
  return result.data;
}
export function parseOwnerEditionPickerResponse(
  action: OwnerEditionPickerAction, value: unknown,
): EditionChoices | EditionLookupReceipt | SetCandidateIsbnResponse {
  const result = editionResponseSchemas[action]?.safeParse(value);
  if (!result?.success) throw new Error('invalid Owner edition-picker response');
  return result.data;
}

// Private normalized metadata is never serialized directly to an Owner DTO (§§5/9).
export type StoredEditionRow = Readonly<{
  optionId: string; ordinal: number; googleBooksUrl: string | null;
  eligibility: EditionRow['eligibility']; metadata: MetadataEdition | null;
}>;
export type OptionsRetentionEvidence = Readonly<{
  storagePermissionVerified: boolean; permittedDeadlineAt: string | null;
}>;

export function projectStoredEditionRow(row: StoredEditionRow): EditionRow {
  const metadata = row.metadata;
  const snapshot = metadata === null ? null : metadataSnapshotSchema.parse(Object.fromEntries(
    Object.keys(metadataSnapshotSchema.shape).map((key) => [key, metadata[key as keyof MetadataEdition]]),
  ));
  return editionRowSchema.parse({
    optionId: row.optionId, ordinal: row.ordinal, googleBooksUrl: row.googleBooksUrl,
    eligibility: row.eligibility, metadata: snapshot,
  });
}
