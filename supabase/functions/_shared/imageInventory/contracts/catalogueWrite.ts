import { z } from 'zod';
import { requiredString, utf8ByteLength } from '../domain/validation';
import type { StoredEditionRow } from './ownerEditionPicker';

// 02b sections 3.1/3.2/9: private sibling facts; never extend metadata or option-row keys.
export const CATALOGUE_WRITE_VERSION = 'psr-catalogue-write-v1' as const;
const controls = /[\u0000-\u001F\u007F-\u009F]/u;
const safeId = z.string().min(1).max(256).refine(value => {
  try {
    return !controls.test(value) && !/^[\/\\]/u.test(value)
      && requiredString(value,'external_id',256) === value;
  } catch { return false; }
});
const version = z.string().min(1).max(128).refine(value => value.trim().length > 0 && !controls.test(value));
// 02b section 3.1: character grammar alone cannot reject every active-content string.
export function isCatalogueScalar(value: unknown, kind: 'oclc' | 'lccn'): value is string {
  if (typeof value !== 'string' || !value || value.length > 64 || value !== value.trim()
    || controls.test(value)) return false;
  const pattern = kind === 'oclc' ? /^[0-9]+$/u : /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/u;
  if (!pattern.test(value)) return false;
  try { requiredString(value,'catalogue_scalar',64); return true; } catch { return false; }
}
const scalar = (kind: 'oclc' | 'lccn') => z.string().refine(value => isCatalogueScalar(value,kind)).nullable().default(null);
const fetchedAtSchema = z.string().datetime({ offset: true });
const companionSchema = z.object({
  version: z.literal(CATALOGUE_WRITE_VERSION), optionId: z.string().uuid(),
  adapterKey: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/u),
  adapterVersion: version, normalizerVersion: version,
  lookupId: z.string().uuid(), attemptId: z.string().uuid(), providerRecordId: safeId,
  workExternalId: safeId.nullable().default(null),
  fetchedAt: fetchedAtSchema,
  oclc: scalar('oclc'), lccn: scalar('lccn'),
}).strict();
export type CatalogueWriteCompanion = Readonly<z.infer<typeof companionSchema>>;
export type CatalogueCompanionScope = Readonly<{
  rows: readonly StoredEditionRow[]; lookupId: string; attemptId: string; sourceFetchedAt: string;
}>;
const invalid = (): never => { throw new Error('P9_CATALOGUE_COMPANIONS_INVALID'); };

// 02b section 3.1: timestamptz equality must retain all six fractional digits.
// Refuse finer precision rather than approximate PostgreSQL's rounding at dispatch.
export function fetchedAtMicros(value: string): bigint {
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/u.exec(value);
  if (!parts || !fetchedAtSchema.safeParse(value).success) return invalid();
  const milliseconds = Date.parse(parts[1] + parts[3]);
  if (!Number.isFinite(milliseconds)) return invalid();
  return BigInt(milliseconds) * BigInt(1000) + BigInt((parts[2] ?? '').padEnd(6, '0'));
}

export function parseCatalogueWriteCompanion(value: unknown): CatalogueWriteCompanion {
  const parsed = companionSchema.safeParse(value);
  return parsed.success ? parsed.data : invalid();
}

export function parseCatalogueCompanions(value: unknown, scope: CatalogueCompanionScope)
  : readonly CatalogueWriteCompanion[] {
  // Old workers/adapters have no companion. A supplied malformed envelope is never omission.
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 10 || utf8ByteLength(value) > 32 * 1024) return invalid();
  const seen = new Set<string>();
  const companions = value.map(item => {
    const companion = parseCatalogueWriteCompanion(item);
    const row = scope.rows.find(row => row.optionId === companion.optionId);
    const metadata = row?.metadata;
    if (!metadata || row.eligibility === 'unavailable' || seen.has(companion.optionId)
      || companion.lookupId !== scope.lookupId || companion.attemptId !== scope.attemptId
      || companion.lookupId !== metadata.correlationId || companion.attemptId !== metadata.attemptId
      || companion.providerRecordId !== metadata.providerRecordId || companion.adapterKey !== metadata.adapterKey
      || companion.adapterVersion !== metadata.adapterVersion || companion.normalizerVersion !== metadata.normalizerVersion
      || fetchedAtMicros(companion.fetchedAt) !== fetchedAtMicros(metadata.fetchedAt)
      || fetchedAtMicros(companion.fetchedAt) !== fetchedAtMicros(scope.sourceFetchedAt)) return invalid();
    seen.add(companion.optionId);
    return companion;
  });
  if (utf8ByteLength(companions) > 32 * 1024) return invalid();
  return companions;
}

// JSON-ready, known keys in contract order; omitted nullable facts become explicit nulls.
export function serializeCatalogueCompanions(value: unknown, scope: CatalogueCompanionScope)
  : readonly CatalogueWriteCompanion[] {
  return parseCatalogueCompanions(value,scope);
}
