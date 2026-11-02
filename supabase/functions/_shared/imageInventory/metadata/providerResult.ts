import { z } from 'zod';
import { fetchedAtMicros, parseCatalogueWriteCompanion } from '../contracts/catalogueWrite';
import type { CatalogueWriteCompanion } from '../contracts/catalogueWrite';
import type { MetadataEdition } from '../contracts/metadata';
import { parseNormalizedMetadataEdition } from '../contracts/metadata';
import type { StoredEditionRow } from '../contracts/ownerEditionPicker';
import { failClosedMetadataProviderOutcome } from './providerAdapter';
import type { MetadataProviderOutcome } from './providerAdapter';
import { PROVIDER_RESULT_VERSION, providerManifestKey } from './providerDescriptor';
import type {
  MetadataResultV2,
  ProviderDescriptor,
  Purpose,
  RetentionContractId,
  VerifiedRetention,
} from './providerDescriptor';
import type { ProviderOwnedValidation } from './providerValidation';

export const P9_PROVIDER_RESULT_INVALID = 'P9_PROVIDER_RESULT_INVALID';
export const P9_PROVIDER_RESULT_VERSION_INVALID = 'P9_PROVIDER_RESULT_VERSION_INVALID';

const RETENTION_CONTRACT = /^[a-z][a-z0-9-]{0,63}$/u;
const EVIDENCE_TOKEN = /^[a-z][a-z0-9_]{0,63}$/u;
const PROVIDER_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const DAY_MS = 24 * 60 * 60 * 1000;
const uuid = z.string().uuid();

export type MetadataResultValidationContext = Readonly<{
  purpose: Purpose;
  descriptor: ProviderDescriptor;
  installed: ReadonlyMap<string, ProviderDescriptor>;
  providerValidation: ProviderOwnedValidation;
  lookupId: string;
  attemptId: string;
  now: string;
  retentionEvidence: VerifiedRetention | null;
}>;

const rowSchema = z.object({
  optionId: z.string().uuid(),
  ordinal: z.number().int().min(0).max(9).safe(),
  googleBooksUrl: z.string().min(1).max(2048).nullable(),
  eligibility: z.enum(['eligible', 'ineligible', 'unavailable']),
  metadata: z.unknown().nullable(),
}).strict();

const retentionSchema = z.object({
  sourceFetchedAt: z.string().datetime({ offset: true }),
  permittedDeadlineAt: z.string().datetime({ offset: true }),
  policyVersion: z.number().int().positive().safe(),
  storagePermissionVerified: z.literal(true),
  retentionContract: z.string().regex(RETENTION_CONTRACT),
}).strict();

const envelopeSchema = z.object({
  version: z.literal(PROVIDER_RESULT_VERSION),
  purpose: z.enum(['automatic', 'edition_options']),
  outcome: z.unknown(),
  rows: z.array(rowSchema).max(10).nullable(),
  catalogueCompanions: z.array(z.unknown()).max(10).nullable(),
  retention: z.union([z.null(), retentionSchema]),
}).strict();

type ParsedRow = z.infer<typeof rowSchema>;
type ParsedRetention = z.infer<typeof retentionSchema>;
type RowSet = Readonly<{
  rows: readonly StoredEditionRow[] | null;
  byOptionId: ReadonlyMap<string, StoredEditionRow>;
}>;

function invalid(): never {
  throw new Error(P9_PROVIDER_RESULT_INVALID);
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const OUTCOME_KEYS = new Set([
  'outcome', 'candidates', 'selected', 'evidence', 'retryable',
  'secondaryEligible', 'providerRequestId', 'representativeCover',
]);

// The legacy parser returns the same sentinel for a malformed outcome and for
// a well-formed schema_invalid outcome. This check independently proves the
// supplied body is the latter without changing the legacy parser's schema.
const isWellFormedSchemaInvalidOutcome = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !OUTCOME_KEYS.has(key))) return false;
  if (value.outcome !== 'schema_invalid') return false;
  if (!Array.isArray(value.candidates) || value.candidates.length !== 0) return false;
  if (!Array.isArray(value.evidence) || value.evidence.length > 32
    || value.evidence.some((item) =>
      typeof item !== 'string' || !EVIDENCE_TOKEN.test(item))) return false;
  if (value.retryable !== false || value.secondaryEligible !== true) return false;
  if (!(value.providerRequestId === null
    || (typeof value.providerRequestId === 'string'
      && PROVIDER_REQUEST_ID.test(value.providerRequestId)))) return false;
  if (value.selected !== null) return false;
  return value.representativeCover === null || value.representativeCover === undefined;
};

const isDescriptor = (value: unknown): value is ProviderDescriptor => isRecord(value)
  && typeof value.adapterKey === 'string' && value.adapterKey.length > 0
  && typeof value.adapterVersion === 'string' && value.adapterVersion.length > 0
  && typeof value.normalizerVersion === 'string' && value.normalizerVersion.length > 0
  && typeof value.validationContract === 'string' && value.validationContract.length > 0
  && typeof value.hostPolicyVersion === 'string' && value.hostPolicyVersion.length > 0
  && (value.retentionContract === null
    || (typeof value.retentionContract === 'string'
      && RETENTION_CONTRACT.test(value.retentionContract)))
  && Array.isArray(value.purposes)
  && value.purposes.every((purpose) =>
    purpose === 'automatic' || purpose === 'edition_options')
  && typeof value.credentialsReady === 'function'
  && typeof value.retentionReady === 'function'
  && typeof value.invoke === 'function';

const isVerifiedRetention = (value: unknown): value is VerifiedRetention => {
  if (!isRecord(value)) return false;
  return typeof value.sourceFetchedAt === 'string'
    && Number.isFinite(Date.parse(value.sourceFetchedAt))
    && typeof value.permittedDeadlineAt === 'string'
    && Number.isFinite(Date.parse(value.permittedDeadlineAt))
    && typeof value.policyVersion === 'number'
    && Number.isSafeInteger(value.policyVersion) && value.policyVersion > 0
    && typeof value.retentionContract === 'string'
    && RETENTION_CONTRACT.test(value.retentionContract);
};

const validateContext = (context: MetadataResultValidationContext): void => {
  if (context === null || typeof context !== 'object') invalid();
  if (context.purpose !== 'automatic' && context.purpose !== 'edition_options') invalid();
  if (!isDescriptor(context.descriptor)) invalid();
  if (!(context.installed instanceof Map)) invalid();
  const descriptor = context.descriptor;
  if (context.installed.get(providerManifestKey(
    descriptor.adapterKey, descriptor.adapterVersion,
  )) !== descriptor) invalid();
  if (!descriptor.purposes.includes(context.purpose)) invalid();
  const validation = context.providerValidation;
  if (!isRecord(validation)
    || validation.adapterKey !== descriptor.adapterKey
    || validation.adapterVersion !== descriptor.adapterVersion
    || validation.validationContract !== descriptor.validationContract
    || validation.hostPolicyVersion !== descriptor.hostPolicyVersion
    || !isRecord(validation.hostPolicy)
    || validation.hostPolicy.adapterKey !== descriptor.adapterKey
    || validation.hostPolicy.policyVersion !== descriptor.hostPolicyVersion
    || typeof validation.validProviderRecordId !== 'function'
    || typeof validation.validBookUrl !== 'function'
    || typeof validation.validCoverReference !== 'function'
    || typeof validation.validCompanionRecord !== 'function') invalid();
  if (!uuid.safeParse(context.lookupId).success
    || !uuid.safeParse(context.attemptId).success) invalid();
  if (typeof context.now !== 'string' || !Number.isFinite(Date.parse(context.now))) invalid();
  const evidence = context.retentionEvidence ?? null;
  if (evidence !== null && !isVerifiedRetention(evidence)) invalid();
};

const validateRetention = (
  retention: ParsedRetention,
  context: MetadataResultValidationContext,
): void => {
  const descriptor = context.descriptor;
  const evidence = context.retentionEvidence ?? null;
  if (evidence === null
    || descriptor.retentionContract === null
    || descriptor.retentionContract !== retention.retentionContract
    || descriptor.retentionReady(context.purpose) !== true
    || evidence.retentionContract !== retention.retentionContract) invalid();
  if (fetchedAtMicros(evidence.sourceFetchedAt)
      !== fetchedAtMicros(retention.sourceFetchedAt)
    || fetchedAtMicros(evidence.permittedDeadlineAt)
      !== fetchedAtMicros(retention.permittedDeadlineAt)
    || evidence.policyVersion !== retention.policyVersion) invalid();
  const fetched = Date.parse(retention.sourceFetchedAt);
  const deadline = Date.parse(retention.permittedDeadlineAt);
  const now = Date.parse(context.now);
  if (!Number.isFinite(fetched) || !Number.isFinite(deadline) || !Number.isFinite(now)) invalid();
  if (fetched > now || deadline <= fetched || deadline > fetched + DAY_MS
    || deadline <= now) invalid();
};

const validateOutcome = (
  packet: z.infer<typeof envelopeSchema>,
  context: MetadataResultValidationContext,
): MetadataProviderOutcome => {
  const descriptor = context.descriptor;
  const outcome = failClosedMetadataProviderOutcome(packet.outcome, {
    correlationId: context.lookupId,
    attemptId: context.attemptId,
    adapterKey: descriptor.adapterKey,
    adapterVersion: descriptor.adapterVersion,
    hostPolicy: context.providerValidation.hostPolicy,
  });
  if (outcome.outcome === 'schema_invalid'
    && !isWellFormedSchemaInvalidOutcome(packet.outcome)) invalid();
  for (const candidate of outcome.candidates) {
    if (candidate.normalizerVersion !== descriptor.normalizerVersion
      || !context.providerValidation.validProviderRecordId(
        candidate.providerRecordId,
      )) invalid();
  }
  const representativeCover = outcome.representativeCover;
  if (representativeCover !== null) {
    const sources = outcome.candidates.filter((candidate) =>
      candidate.providerRecordId === representativeCover.sourceProviderRecordId
      && candidate.coverReference === representativeCover.coverReference);
    if (sources.length !== 1) invalid();
  }
  return outcome;
};

const validateRows = (
  rows: readonly ParsedRow[],
  context: MetadataResultValidationContext,
  retention: ParsedRetention | null,
): RowSet => {
  const descriptor = context.descriptor;
  const validation = context.providerValidation;
  const validated: StoredEditionRow[] = [];
  const byOptionId = new Map<string, StoredEditionRow>();
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (row.ordinal !== index || seen.has(row.optionId)) invalid();
    seen.add(row.optionId);
    if (row.eligibility === 'unavailable') {
      if (row.metadata !== null || row.googleBooksUrl !== null) invalid();
      validated.push({
        optionId: row.optionId, ordinal: row.ordinal, googleBooksUrl: null,
        eligibility: 'unavailable', metadata: null,
      });
      return;
    }
    if (row.metadata === null || row.googleBooksUrl === null) invalid();
    const metadata = parseNormalizedMetadataEdition(row.metadata, validation.hostPolicy);
    if (metadata.adapterKey !== descriptor.adapterKey
      || metadata.adapterVersion !== descriptor.adapterVersion
      || metadata.normalizerVersion !== descriptor.normalizerVersion
      || metadata.correlationId !== context.lookupId
      || metadata.attemptId !== context.attemptId) invalid();
    if (retention !== null
      && fetchedAtMicros(metadata.fetchedAt)
        !== fetchedAtMicros(retention.sourceFetchedAt)) invalid();
    if (!validation.validProviderRecordId(metadata.providerRecordId)
      || !validation.validBookUrl(
        row.googleBooksUrl, metadata.providerRecordId,
      )
      || !validation.validCoverReference(
        metadata.coverReference, metadata.providerRecordId,
      )) invalid();
    const stored: StoredEditionRow = {
      optionId: row.optionId, ordinal: row.ordinal,
      googleBooksUrl: row.googleBooksUrl, eligibility: row.eligibility, metadata,
    };
    validated.push(stored);
    byOptionId.set(row.optionId, stored);
  });
  return { rows: validated, byOptionId };
};

const validateCompanions = (
  companions: readonly unknown[],
  rows: ReadonlyMap<string, StoredEditionRow>,
  context: MetadataResultValidationContext,
  retention: ParsedRetention | null,
): readonly CatalogueWriteCompanion[] => {
  const descriptor = context.descriptor;
  const validation = context.providerValidation;
  const validated: CatalogueWriteCompanion[] = [];
  const seen = new Set<string>();
  for (const value of companions) {
    const companion: CatalogueWriteCompanion = parseCatalogueWriteCompanion(value);
    const row = rows.get(companion.optionId);
    const metadata: MetadataEdition | undefined = row?.metadata ?? undefined;
    if (seen.has(companion.optionId) || row === undefined || metadata === undefined) invalid();
    seen.add(companion.optionId);
    if (companion.adapterKey !== descriptor.adapterKey
      || companion.adapterVersion !== descriptor.adapterVersion
      || companion.normalizerVersion !== descriptor.normalizerVersion
      || companion.lookupId !== context.lookupId
      || companion.attemptId !== context.attemptId) invalid();
    if (companion.providerRecordId !== metadata.providerRecordId
      || companion.adapterKey !== metadata.adapterKey
      || companion.adapterVersion !== metadata.adapterVersion
      || companion.normalizerVersion !== metadata.normalizerVersion) invalid();
    if (!validation.validProviderRecordId(companion.providerRecordId)
      || !validation.validCompanionRecord(
        companion.providerRecordId, companion.workExternalId,
      )) invalid();
    if (fetchedAtMicros(companion.fetchedAt) !== fetchedAtMicros(metadata.fetchedAt)) invalid();
    if (retention !== null
      && fetchedAtMicros(companion.fetchedAt)
        !== fetchedAtMicros(retention.sourceFetchedAt)) invalid();
    validated.push(companion);
  }
  return validated;
};

export function validateMetadataResultV2(
  value: unknown,
  context: MetadataResultValidationContext,
): MetadataResultV2 {
  if (!isRecord(value)) invalid();
  if (value.version !== PROVIDER_RESULT_VERSION) {
    throw new Error(P9_PROVIDER_RESULT_VERSION_INVALID);
  }
  try {
    validateContext(context);
    const parsed = envelopeSchema.safeParse(value);
    if (!parsed.success) invalid();
    const packet = parsed.data;
    if (packet.purpose !== context.purpose) invalid();

    const outcome = validateOutcome(packet, context);
    if (packet.retention === null) {
      if (packet.rows !== null || packet.catalogueCompanions !== null) invalid();
    } else {
      if (packet.rows === null || packet.catalogueCompanions === null) invalid();
      validateRetention(packet.retention, context);
    }

    const rowSet: RowSet = packet.rows === null
      ? { rows: null, byOptionId: new Map() }
      : validateRows(packet.rows, context, packet.retention);
    const companions = packet.catalogueCompanions === null ? null
      : validateCompanions(
        packet.catalogueCompanions, rowSet.byOptionId, context, packet.retention,
      );
    return Object.freeze({
      version: packet.version,
      purpose: packet.purpose,
      outcome,
      rows: rowSet.rows,
      catalogueCompanions: companions,
      retention: packet.retention,
    });
  } catch (error) {
    if (error instanceof Error
      && (error.message === P9_PROVIDER_RESULT_INVALID
        || error.message === P9_PROVIDER_RESULT_VERSION_INVALID)) throw error;
    throw new Error(P9_PROVIDER_RESULT_INVALID);
  }
}
