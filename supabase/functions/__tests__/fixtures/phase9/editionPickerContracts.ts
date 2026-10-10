// Synthetic contract data. No network calls or configured provider permission evidence.
export const editionUuid = (n: number) => '93000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const editionContractVersion = 'phase9-owner-ux-v1' as const;
export const editionMetadata = {
  title: 'The Fixture Book', subtitle: null, authors: ['Fixture Author', 'Second Author'],
  description: null, isbn10: '0306406152', isbn13: '9780306406157',
  publisher: 'Fixture Press', publishedDate: '2020', language: 'en', script: 'Latn',
  editionStatement: 'Second edition', series: null, volume: null, format: null,
  pageCount: 240, categories: ['Fiction'],
  coverReference: 'https://books.google.com/books/content?id=fixture',
};
export const editionRow = {
  optionId: editionUuid(4), ordinal: 0,
  googleBooksUrl: 'https://books.google.com/books?id=fixture',
  eligibility: 'eligible' as const, metadata: editionMetadata,
};
export const editionChoices = {
  sessionId: editionUuid(1), candidateId: editionUuid(2),
  requestGeneration: 1, optionsVersion: 1, optionsExpiresAt: '2026-10-08T00:00:00.000Z',
  rows: [editionRow], selection: null, lookupStatus: 'ready' as const,
  candidateVersion: 4, metadataRevision: 7, reviewVersion: null,
};
export const editionLookupReceipt = {
  operationId: editionUuid(6), status: 'pending' as const,
  requestGeneration: 1, optionsVersion: 0, available: false,
};
const command = {
  contractVersion: editionContractVersion, sessionId: editionUuid(1), candidateId: editionUuid(2),
  commandId: editionUuid(3), idempotencyKey: 'edition-picker-command-0001',
};
export const editionReadRequest = {
  action: 'read_candidate_edition_choices' as const,
  contractVersion: editionContractVersion, sessionId: editionUuid(1), candidateId: editionUuid(2),
};
export const editionLookupRequest = {
  ...command, action: 'request_candidate_edition_options' as const, expectedRequestGeneration: 0,
};
const selectCommand = {
  ...command, action: 'select_candidate_edition' as const,
  expectedCandidateVersion: 4, expectedMetadataRevision: 7, expectedReviewVersion: null,
};
export const editionSelectRequest = {
  ...selectCommand, source: 'edition_option' as const, optionsVersion: 1, optionId: editionUuid(4),
};
export const editionConfirmRequest = {
  ...selectCommand, source: 'current_suggestion' as const, selectionId: editionUuid(5),
};
export const editionRequests = [
  editionReadRequest, editionLookupRequest, editionSelectRequest, editionConfirmRequest,
];
export const editionReview = {
  originalTitle: 'The Fixture Book', authors: ['Fixture Author'], originalLanguage: 'en', script: 'Latn',
  metadataChoice: { mode: 'edition_option', selectionId: editionUuid(5) },
  quantity: 2, priceMinor: 12000, baseCondition: 'good',
  damageDisclosure: {
    hasDamage: false, damageTypes: [], damageNote: null, isSellable: true, completeReadableSafe: true,
  },
  shelfLocation: 'Shelf A1', notes: { publicNote: null, internalNote: 'Keep this note' },
  publicationIntent: 'private', duplicateIntent: null,
  originalFieldConfirmation: { title: true, authors: [true] }, candidateDisposition: 'reviewed',
};
export const editionSaveReviewRequest = {
  ...command, action: 'update_candidate_review' as const,
  expectedCandidateVersion: 4, expectedMetadataRevision: 7, review: editionReview,
};
export const invalidEditionRequests: ReadonlyArray<readonly [string, unknown]> = [
  ['client tenant authority', { ...editionReadRequest, storeId: editionUuid(9) }],
  ['mutation on read', { ...editionReadRequest, commandId: editionUuid(3) }],
  ['unknown contract version', { ...editionLookupRequest, contractVersion: 'phase9-owner-ux-v2' }],
  ['negative generation', { ...editionLookupRequest, expectedRequestGeneration: -1 }],
  ['missing expected generation', { ...editionLookupRequest, expectedRequestGeneration: undefined }],
  ['invalid command ID', { ...editionLookupRequest, commandId: 'provider-volume-id' }],
  ['short idempotency key', { ...editionLookupRequest, idempotencyKey: 'short' }],
  ['missing review authority', { ...editionSelectRequest, expectedReviewVersion: undefined }],
  ['zero metadata revision', { ...editionSelectRequest, expectedMetadataRevision: 0 }],
  ['wrong revision spelling', { ...editionSelectRequest, expectedMetadataRevision: undefined, metadataVersion: 7 }],
  ['missing option ID', { ...editionSelectRequest, optionId: undefined }],
  ['provider ID instead of opaque option ID', { ...editionSelectRequest, optionId: 'fixture-google-id' }],
  ['zero option-set version', { ...editionSelectRequest, optionsVersion: 0 }],
  ['mixed sources', { ...editionSelectRequest, selectionId: editionUuid(5) }],
  ['suggestion with option identity', { ...editionConfirmRequest, optionId: editionUuid(4) }],
  ['forged snapshot', { ...editionSelectRequest, metadata: editionMetadata }],
  ['numeric override', { ...editionSelectRequest, editionNumberOverride: 3 }],
];
const choicesWithRow = (row: unknown) => ({ ...editionChoices, rows: [row] });
export const invalidEditionChoices: ReadonlyArray<readonly [string, unknown]> = [
  ['eleven results', { ...editionChoices, rows: Array.from({ length: 11 }, (_, ordinal) =>
    ({ ...editionRow, ordinal, optionId: editionUuid(10 + ordinal) })) }],
  ['selectable null metadata', choicesWithRow({ ...editionRow, metadata: null })],
  ['unavailable metadata payload', choicesWithRow({ ...editionRow, eligibility: 'unavailable' })],
  ['changed original position', choicesWithRow({ ...editionRow, ordinal: 3 })],
  ['reused opaque option identity', { ...editionChoices, rows: [editionRow, { ...editionRow, ordinal: 1 }] }],
  ['missing options expiry', { ...editionChoices, optionsExpiresAt: null }],
  ['unversioned options', { ...editionChoices, optionsVersion: 0 }],
  ['missing valid-result book link', choicesWithRow({ ...editionRow, googleBooksUrl: null })],
  ['foreign book link', choicesWithRow({ ...editionRow, googleBooksUrl: 'https://example.com/books?id=x' })],
  ['unsafe book link', choicesWithRow({ ...editionRow, googleBooksUrl: 'javascript:alert(1)' })],
  ['credential-bearing book link', choicesWithRow({
    ...editionRow, googleBooksUrl: 'https://user:pass@books.google.com/books?id=x',
  })],
  ['unsafe cover', choicesWithRow({ ...editionRow, metadata: {
    ...editionMetadata, coverReference: 'https://example.com/cover.jpg',
  } })],
  ['missing all authors', choicesWithRow({ ...editionRow, metadata: { ...editionMetadata, authors: [] } })],
  ['overlong title', choicesWithRow({ ...editionRow, metadata: { ...editionMetadata, title: 'x'.repeat(513) } })],
  ['unknown root field', { ...editionChoices, providerPayload: {} }],
  ...['confidence', 'correlationId', 'attemptId', 'providerRecordId', 'matchRationale',
    'authorization', 'workerSecret', 'storeId'].map((key) => [
      'private metadata field ' + key, choicesWithRow({
        ...editionRow, metadata: { ...editionMetadata, [key]: 'private' },
      }),
    ] as const),
];
