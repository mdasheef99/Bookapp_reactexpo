// 02c §4.3; M92 recovery and effective M93 completion. SQL alone owns digests and retry proof.
import { z } from 'zod';
import { canonicalMetadataJson } from './metadataGatewayContext';
import type { MetadataRpcClient } from './metadataJobContext';
import { canonicalizeMetadataOutcome, failClosedMetadataProviderOutcome } from '../metadata/providerAdapter';
import type { MetadataCanonicalOutcome } from '../metadata/providerAdapter';
import { validateMetadataResultV2 } from '../metadata/providerResult';
import type { MetadataResultValidationContext } from '../metadata/providerResult';
import type { MetadataResultV2 } from '../metadata/providerDescriptor';
import { automaticRpc, MetadataAutomaticRpcError, snapshotAutomaticValue, validateAutomaticFence } from './metadataAutomaticEditionFence';
import type { AutoFence } from './metadataAutomaticEditionFence';

const uuid = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu);
const commandSchema = z.object({ fence: z.unknown(), lookupId: uuid, attemptId: uuid.nullable(),
  result: z.unknown(), selectedOptionId: uuid.nullable(), source: z.enum(['external', 'local']) }).strict();
const buildSchema = commandSchema.omit({ selectedOptionId: true });
const canonical = z.enum(['accepted_metadata_match', 'ambiguous', 'material_conflict', 'no_match',
  'technical_failure', 'policy_denied', 'cost_quota_denied', 'manual_metadata_required']);
// 02d SDD §3: pre-install receipts remain valid; saved receipts carry only a binding.
const prefillSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), requestId: uuid,
    requestGeneration: z.number().int().nonnegative().safe(), optionsVersion: z.number().int().positive().safe(),
    optionsExpiresAt: z.string().datetime({ offset: true }) }).strict(),
  z.object({ status: z.literal('skipped'), reason: z.enum(['not_installed', 'not_reviewable',
    'selected', 'superseded', 'identity_mismatch', 'no_retention', 'source_not_allowed', 'empty_unproven']) }).strict(),
]);
const receiptSchema = z.object({ version: z.literal('p9-auto-completion-v1'),
  status: z.enum(['completed', 'replayed']), lookupId: uuid, snapshotId: uuid,
  outcome: canonical, selectedOptionId: uuid.nullable(),
  prefill: prefillSchema }).strict();
const terminalSchema = z.object({ status: z.enum(['missing', 'stale_rejected']) }).strict();
const resultSchema = z.object({ version: z.literal('p9-metadata-result-v2'), purpose: z.literal('automatic'),
  outcome: z.unknown(), rows: z.unknown().nullable(), catalogueCompanions: z.unknown().nullable(),
  retention: z.unknown().nullable() }).strict();
const outcomeKeys = ['outcome', 'candidates', 'selected', 'evidence', 'retryable',
  'secondaryEligible', 'providerRequestId', 'representativeCover'];
export type AutoCompletion = Readonly<{ fence: AutoFence; lookupId: string; attemptId: string | null;
  result: MetadataResultV2; selectedOptionId: string | null; source: 'external' | 'local' }>;
export type AutoReceipt = Readonly<Omit<z.infer<typeof receiptSchema>, 'prefill'> & {
  prefill: Readonly<z.infer<typeof prefillSchema>>;
}>;
export type AutomaticRecovery = AutoReceipt | Readonly<{ status: 'missing' }> | Readonly<{ status: 'stale_rejected' }>;
type AutomaticPrefillBinding = Readonly<{ jobId?: string; requestGeneration?: number }>;
export type AutomaticReceiptBinding = Readonly<{
  lookupId: string; selectedOptionId: string | null; outcome: MetadataCanonicalOutcome;
}> & AutomaticPrefillBinding;
const invalid = (): never => { throw new Error('P9_AUTOMATIC_COMPLETION_INVALID'); };
function exactOutcome(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const keys = Object.keys(value);
  if (keys.length !== outcomeKeys.length || !outcomeKeys.every(key => keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}
function validateResult(
  value: unknown, source: 'external' | 'local', lookupId: string, attemptId: string | null,
  validation?: MetadataResultValidationContext,
): MetadataResultV2 {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) return invalid();
  const outcome = exactOutcome(parsed.data.outcome);
  if (source === 'external') {
    if (attemptId === null || validation === undefined || validation.purpose !== 'automatic'
      || validation.lookupId !== lookupId || validation.attemptId !== attemptId) return invalid();
    const result = validateMetadataResultV2(parsed.data, validation);
    if (result.retention !== null && (!Number.isSafeInteger(result.retention.policyVersion)
      || result.retention.policyVersion > 2147483647)) return invalid();
    return result;
  }
  // Local has no provider candidate/attempt to validate; the parser's lineage context is unused.
  if (attemptId !== null || parsed.data.rows !== null || parsed.data.catalogueCompanions !== null
    || parsed.data.retention !== null || !Array.isArray(outcome.candidates) || outcome.candidates.length !== 0
    || outcome.selected !== null || outcome.representativeCover !== null) return invalid();
  const normalized = failClosedMetadataProviderOutcome(outcome, { correlationId: lookupId, attemptId: '' });
  if (canonicalMetadataJson(normalized) !== canonicalMetadataJson(outcome)) return invalid();
  return { version: 'p9-metadata-result-v2', purpose: 'automatic', outcome: normalized,
    rows: null, catalogueCompanions: null, retention: null };
}
function selectedOption(result: MetadataResultV2): string | null {
  if (result.rows === null || result.outcome.selected === null) return null;
  const selected = canonicalMetadataJson(result.outcome.selected);
  const matches = result.rows.filter(row => row.eligibility === 'eligible'
    && canonicalMetadataJson(row.metadata) === selected);
  if (matches.length !== 1) return invalid();
  const option = matches[0].optionId;
  // The shared validator proves each companion's tuple; this proves the winner HAS one.
  if (result.catalogueCompanions?.filter(companion => companion.optionId === option).length !== 1) return invalid();
  return option;
}
export function buildAutomaticCompletion(value: unknown, validation?: MetadataResultValidationContext): AutoCompletion {
  const parsed = buildSchema.safeParse(value);
  if (!parsed.success) return invalid();
  const { lookupId, attemptId, source } = parsed.data;
  const fence = validateAutomaticFence(parsed.data.fence);
  const result = validateResult(parsed.data.result, source, lookupId, attemptId, validation);
  return snapshotAutomaticValue({ fence, lookupId, attemptId, result, selectedOptionId: selectedOption(result), source });
}
export function validateAutomaticCompletion(value: unknown, validation?: MetadataResultValidationContext): AutoCompletion {
  const parsed = commandSchema.safeParse(value);
  if (!parsed.success) return invalid();
  const { selectedOptionId, ...input } = parsed.data;
  const command = buildAutomaticCompletion(input, validation);
  if (selectedOptionId !== command.selectedOptionId) return invalid();
  return command;
}
export function decodeAutomaticReceipt(
  value: unknown, binding?: AutomaticReceiptBinding | AutomaticPrefillBinding,
): AutomaticRecovery {
  const terminal = terminalSchema.safeParse(value);
  if (terminal.success) return terminal.data.status === 'missing'
    ? Object.freeze({ status: 'missing' }) : Object.freeze({ status: 'stale_rejected' });
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success) return invalid();
  const receipt = parsed.data;
  if (receipt.selectedOptionId !== null && receipt.outcome !== 'accepted_metadata_match') return invalid();
  if (receipt.prefill.status === 'saved' && (receipt.prefill.requestId !== binding?.jobId
    || receipt.prefill.requestGeneration !== binding?.requestGeneration)) return invalid();
  if (binding !== undefined && 'lookupId' in binding
    && (receipt.lookupId !== binding.lookupId || receipt.selectedOptionId !== binding.selectedOptionId
    || receipt.outcome !== binding.outcome)) return invalid();
  return snapshotAutomaticValue(receipt);
}
export class AutomaticCompletionUncertainError extends Error {
  readonly uncertain = true;
  constructor() { super('P9_AUTOMATIC_COMPLETION_UNCERTAIN'); this.name = 'AutomaticCompletionUncertainError'; }
}
export function createMetadataAutomaticCompletionBoundary(
  client: MetadataRpcClient, validation?: MetadataResultValidationContext,
) {
  return Object.freeze({
    async complete(value: unknown): Promise<AutoReceipt | Readonly<{ status: 'stale_rejected' }>> {
      // Invalid local inputs never become uncertain SQL submissions.
      const command = validateAutomaticCompletion(value, validation);
      const binding = { lookupId: command.lookupId, selectedOptionId: command.selectedOptionId,
        outcome: canonicalizeMetadataOutcome(command.result.outcome.outcome),
        jobId: command.fence.jobId, requestGeneration: command.fence.requestGeneration };
      try {
        const receipt = decodeAutomaticReceipt(await automaticRpc(client, 'phase9_complete_automatic_metadata_v1', {
          p_command: command,
        }), binding);
        if (receipt.status === 'missing') return invalid();
        return receipt;
      } catch (error) {
        if (error instanceof MetadataAutomaticRpcError && !error.uncertain) throw error;
        throw new AutomaticCompletionUncertainError();
      }
    },
    async recover(originalFence: unknown, binding?: AutomaticReceiptBinding): Promise<AutomaticRecovery> {
      const fence = validateAutomaticFence(originalFence);
      try {
        const receipt = decodeAutomaticReceipt(await automaticRpc(client, 'phase9_recover_automatic_metadata_v1', {
          p_fence: fence,
        }), { ...binding, jobId: fence.jobId, requestGeneration: fence.requestGeneration });
        if (receipt.status === 'completed') return invalid();
        return receipt;
      } catch (error) {
        if (error instanceof MetadataAutomaticRpcError && !error.uncertain) throw error;
        throw new AutomaticCompletionUncertainError();
      }
    },
  });
}
