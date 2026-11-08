// 02c sections 4.3/4.4/8; M93:485-519. Explicit admission has no automatic retry authority.
import { z } from 'zod';
import type { EditionOptionsFence } from './metadataEditionOptionsBoundary';
import type { MetadataRpcClient } from './metadataJobContext';
import type { RegistrySnapshot } from '../metadata/providerDescriptor';
import { metadataGatewayRpc } from './metadataGatewayContext';
import { parseProviderConfigurationSnapshot } from './providerConfiguration';

const reserveReceipt = z.discriminatedUnion('status', [
  z.object({ status: z.literal('reserved'), slots: z.union([z.literal(1), z.literal(6)]) }).strict(),
  z.object({ status: z.literal('capacity_wait'), dueAt: z.string().datetime({ offset: true }) }).strict(),
  z.object({ status: z.literal('recovery_only') }).strict(),
  z.object({ status: z.literal('configuration_required') }).strict(),
  z.object({ status: z.literal('drain_required') }).strict(),
]);
const releaseReceipt = z.discriminatedUnion('status', [
  z.object({ status: z.literal('released') }).strict(),
  z.object({ status: z.literal('recovery_only') }).strict(),
]);
export type ExplicitProvider = Readonly<{ adapterKey: string; adapterVersion: string; maxGets: 1 | 6 }>;
export type ExplicitAdmission = z.infer<typeof reserveReceipt>
  | Readonly<{ status: 'legacy' | 'uncertain' }>;

// C1: construct EXACTLY M93's explicit fence; never spread an AutoFence or a boundary DTO.
export function explicitRoundFence(fence: EditionOptionsFence) {
  return Object.freeze({ jobId: fence.jobId, worker: fence.claimWorker,
    leaseToken: fence.claimLeaseToken, claimAttempt: fence.claimAttempt,
    candidateId: fence.candidateId, storeId: fence.storeId, sessionId: fence.sessionId,
    requestId: fence.requestId, requestGeneration: fence.requestGeneration, queryIdentity: fence.queryIdentity });
}

export function createExplicitRound(client: MetadataRpcClient, fence: EditionOptionsFence,
  verifiedRegistry?: RegistrySnapshot) {
  const f = explicitRoundFence(fence);
  let registry = verifiedRegistry;
  let held: ExplicitProvider | null = null;
  let uncertain = false;
  // Exactly one replay of the identical submission after a lost transport response or a
  // malformed receipt. A returned SQL refusal is definitive: never replay it and never
  // treat it as permission to create lineage. In particular a committed capacity_wait has
  // already cleared the lease, so its replay refusal is uncertainty.
  async function submit<T>(name: string, p: Record<string, unknown>, schema: z.ZodType<T>) {
    for (let submission = 0; submission < 2; submission++) {
      let data: unknown;
      try {
        const result = await client.rpc(name, p);
        if (result === null || typeof result !== 'object'
          || (result.error !== null && result.error !== undefined)) return null;
        data = result.data;
      } catch { continue; /* Lost transport response: exact replay once. */ }
      const parsed = schema.safeParse(data);
      if (parsed.success) return parsed.data;
      /* Malformed receipt: exact replay once; persistent malformation is uncertainty. */
    }
    return null;
  }
  return {
    get uncertain() { return uncertain; },
    async reserve(provider: ExplicitProvider): Promise<ExplicitAdmission> {
      uncertain = true;
      try {
        registry ??= parseProviderConfigurationSnapshot(
          await metadataGatewayRpc(client, 'phase9_provider_configuration_v1', {}));
      } catch { return { status: 'uncertain' }; }
      const rows = registry.providers.filter(row => row.adapterKey === provider.adapterKey
        && row.adapterVersion === provider.adapterVersion);
      // C3: absence of explicitHttp, a missing row or a failed configuration RPC is NOT NULL evidence.
      if (rows.length === 1 && rows[0].protectionPolicy === null) {
        uncertain = false;
        return { status: 'legacy' };
      }
      const result = await submit('phase9_reserve_metadata_provider_round_v1', {
        f, p_key: provider.adapterKey, p_version: provider.adapterVersion,
      }, reserveReceipt);
      if (result === null) return { status: 'uncertain' };
      if (result.status === 'reserved') {
        held = provider;
        // A replay may report a partially spent hold. It does not authorize another fresh round.
        if (result.slots !== provider.maxGets) return { status: 'uncertain' };
      }
      uncertain = false;
      return result;
    },
    async release(): Promise<'released' | 'recovery_only' | 'uncertain'> {
      if (uncertain) return 'uncertain';
      if (held === null) return 'released';
      uncertain = true;
      const result = await submit('phase9_release_metadata_provider_round_v1', {
        f, p_key: held.adapterKey, p_version: held.adapterVersion,
      }, releaseReceipt);
      if (result === null) return 'uncertain';
      uncertain = false;
      if (result.status === 'released') held = null;
      return result.status;
    },
  };
}
export type ExplicitRound = ReturnType<typeof createExplicitRound>;
