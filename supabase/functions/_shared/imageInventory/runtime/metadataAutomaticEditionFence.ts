// 02c §4.3; M94:6–109. This read supplies identity, never retry authority.
import { z } from 'zod';
import { requiredString } from '../domain/validation';
import type { MetadataJobContext, MetadataRpcClient } from './metadataJobContext';

const integer = z.number().int().safe().min(0).max(2147483647);
const uuid = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu);
const claimAttempt = integer.min(1).max(5);
const lineageSchema = z.object({
  adapterKey: z.string().min(1), adapterVersion: z.string().min(1),
  purpose: z.literal('automatic'), role: z.literal('primary'), sequence: z.literal(1),
  lookupId: uuid, attemptId: uuid, claimAttempt, policyVersion: integer.min(1),
}).strict();
const readSchema = z.object({ candidateVersion: integer.min(1), requestGeneration: integer,
  capturedRequestId: uuid.nullable(), lineage: lineageSchema.nullable() }).strict();
const fenceSchema = z.object({
  jobId: uuid, worker: z.string().min(1), leaseToken: z.string().regex(/^[0-9a-f]{64}$/u),
  claimAttempt, candidateId: uuid, storeId: uuid, sessionId: uuid, candidateVersion: integer.min(1),
  queryIdentity: z.string().min(1).max(2048).refine(value => {
    try { return requiredString(value, 'queryIdentity', 2048) === value; } catch { return false; }
  }), capturedRequestId: uuid.nullable(), requestGeneration: integer,
}).strict();
export type AutoFence = Readonly<z.infer<typeof fenceSchema>>;
export type AutomaticEditionFenceRead = Readonly<Omit<z.infer<typeof readSchema>, 'lineage'> & {
  lineage: Readonly<z.infer<typeof lineageSchema>> | null;
}>;
export type AutomaticClaim = Readonly<{ jobId: string; worker: string; leaseToken: string; attempt: number }>;

// Only validated JSON reaches here. Copy before freezing so callers cannot mutate an in-flight command.
export function snapshotAutomaticValue<T>(value: T): T {
  const copy: T = JSON.parse(JSON.stringify(value));
  const freeze = (item: unknown): void => {
    if (item !== null && typeof item === 'object') {
      Object.values(item).forEach(freeze); Object.freeze(item);
    }
  };
  freeze(copy); return copy;
}
const invalid = (): never => { throw new Error('P9_AUTOMATIC_FENCE_INVALID'); };
export function decodeAutomaticEditionFence(value: unknown): AutomaticEditionFenceRead {
  const parsed = readSchema.safeParse(value);
  return parsed.success ? snapshotAutomaticValue(parsed.data) : invalid();
}
export function validateAutomaticFence(value: unknown): AutoFence {
  const parsed = fenceSchema.safeParse(value);
  return parsed.success ? snapshotAutomaticValue(parsed.data) : invalid();
}
export function buildAutomaticFence(
  context: MetadataJobContext, worker: string, value: unknown,
): AutoFence {
  const read = decodeAutomaticEditionFence(value), history = read.lineage;
  if (context.purpose !== 'automatic' || context.candidateVersion !== read.candidateVersion) invalid();
  if (history !== null && (history.lookupId !== context.currentLookupId
    || history.attemptId !== context.currentAttemptId || history.claimAttempt > context.attempt
    || (context.currentLookupAdapterKey != null && context.currentLookupAdapterKey !== history.adapterKey)
    || (context.currentLookupAdapterVersion != null && context.currentLookupAdapterVersion !== history.adapterVersion)
    || (context.currentAttemptAdapterKey != null && context.currentAttemptAdapterKey !== history.adapterKey))) invalid();
  return validateAutomaticFence({ jobId: context.jobId, worker, leaseToken: context.claimToken,
    claimAttempt: context.attempt, candidateId: context.candidateId, storeId: context.storeId,
    sessionId: context.sessionId, candidateVersion: context.candidateVersion, queryIdentity: context.queryIdentity,
    capturedRequestId: read.capturedRequestId, requestGeneration: read.requestGeneration });
}

// Preserve only known server refusals; raw RPC/transport errors may contain credentials.
const refusals = new Set(['P9_STATE_CONFLICT', 'P9_REQUEST_INVALID', 'P9_OWNER_NOT_AUTHORIZED',
  'P9_EXTERNAL_ADMISSION_PAUSED', 'P9_PROVIDER_CONFIGURATION_INVALID', 'P9_PROVIDER_RUN_NOT_ADMITTED',
  'P9_AUTO_COMMAND_INVALID', 'P9_EDITION_ROWS_INVALID', 'P9_CATALOGUE_COMPANION_INVALID',
  'P9_AUTO_SOURCE_INVALID', 'P9_IDEMPOTENCY_MISMATCH']);
export class MetadataAutomaticRpcError extends Error {
  readonly uncertain: boolean;
  readonly code: string | null;
  constructor(readonly rpc: string, error: unknown) {
    const row = error !== null && typeof error === 'object' ? error as Record<string, unknown> : {};
    // M93/M94 plain RAISE EXCEPTION uses P0001; a copied message alone proves no rollback.
    const known = row.code === 'P0001' && typeof row.message === 'string' && refusals.has(row.message);
    super(known ? row.message as string : 'P9_AUTOMATIC_RPC_UNCERTAIN');
    this.name = 'MetadataAutomaticRpcError'; this.uncertain = !known;
    this.code = typeof row.code === 'string' && /^[A-Z0-9]{5}$/u.test(row.code) ? row.code : null;
  }
}
export async function automaticRpc(
  client: MetadataRpcClient, name: string, parameters: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  let result;
  try { result = await client.rpc(name, parameters); }
  catch (error) { throw new MetadataAutomaticRpcError(name, error); }
  if (result === null || typeof result !== 'object' || result.error !== null) {
    throw new MetadataAutomaticRpcError(name, result?.error);
  }
  return result.data;
}
export async function loadAutomaticEditionFence(
  client: MetadataRpcClient, claim: AutomaticClaim,
): Promise<AutomaticEditionFenceRead> {
  if (!uuid.safeParse(claim.jobId).success || !claimAttempt.safeParse(claim.attempt).success
    || typeof claim.worker !== 'string' || claim.worker.length === 0
    || !fenceSchema.shape.leaseToken.safeParse(claim.leaseToken).success) invalid();
  return decodeAutomaticEditionFence(await automaticRpc(client, 'phase9_automatic_edition_fence_v1', {
    p_job_id: claim.jobId, p_worker: claim.worker, p_lease_token: claim.leaseToken, p_attempt_count: claim.attempt,
  }));
}
