// 02c §§4.3/5.1/9: SQL owns admission, retry authority and atomic completion.
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { MetadataGatewayConfiguration } from './metadataGatewayContext';
import { canonicalMetadataJson, metadataClaimParameters } from './metadataGatewayContext';
import { finalizeMetadataProductionAttempt } from './metadataAttemptFinalization';
import { loadMetadataJobContext } from './metadataJobContext';
import type { MetadataRpcClient } from './metadataJobContext';
import { automaticRpc, buildAutomaticFence, loadAutomaticEditionFence, MetadataAutomaticRpcError,
  snapshotAutomaticValue } from './metadataAutomaticEditionFence';
import { buildAutomaticLookupSpec, decodeAutomaticPreparation, prepareAutomaticMetadata } from './metadataAutomaticPreparation';
import { AutomaticCompletionUncertainError, buildAutomaticCompletion,
  createMetadataAutomaticCompletionBoundary } from './metadataAutomaticCompletion';
import type { AutoReceipt, AutomaticRecovery } from './metadataAutomaticCompletion';
import { decideMetadataProductionPolicy, resultForManualCompletion } from './metadataProductionComposition';
import type { MetadataCompositionResult, MetadataProductionGateway, MetadataProductionRequest } from './metadataProductionComposition';
import { resultForReuseCompletion, isCacheableOutcome } from './metadataProductionPolicy';
import type { MetadataResultV2, VerifiedRetention, ProviderHttpPort } from '../metadata/providerDescriptor';
import { canonicalizeMetadataOutcome } from '../metadata/providerAdapter';
import { failureOutcome } from '../metadata/openLibrary/automatic';
import { installedProviderValidation } from '../metadata/providerValidation';
import { boundOptionsRetentionEvidence } from '../metadata/googleBooks/editionOptions';
import { createProviderHttpPort, ProviderHttpError } from '../metadata/providerHttp';
import { createEditionProviderCalls } from './metadataEditionProviderCalls';
import { acquireStartPermit, checkBreaker, parseProtectionPolicyOrNull, parseRetryAfterMs,
  recordBreakerFailure, releaseHalfOpenProbe, settleHalfOpenProbe, useSharedProtectionState } from './providerProtection';

const round = z.union([z.literal(0), z.literal(1)]);
const finishSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('finalized'), round, dueAt: z.null().optional() }).strict(),
  z.object({ status: z.literal('retry_scheduled'), round, dueAt: z.string().datetime({ offset: true }) }).strict(),
  z.object({ status: z.literal('recovery_only') }).strict(),
  z.object({ status: z.literal('drain_required') }).strict(),
]);
const manual = (): MetadataCompositionResult => ({ outcome: 'manual_metadata_required' });
function receiptResult(receipt: AutomaticRecovery): MetadataCompositionResult {
  if (receipt.status === 'stale_rejected') return { outcome: 'stale_claim' };
  return receipt.status !== 'missing' && receipt.outcome === 'accepted_metadata_match'
    ? { outcome: 'accepted_metadata_match' } : manual();
}
export async function recoverAutomaticMetadata(client: MetadataRpcClient, fence: unknown): Promise<MetadataCompositionResult | null> {
  const receipt = await createMetadataAutomaticCompletionBoundary(client).recover(fence);
  return receipt.status === 'missing' ? null : receiptResult(receipt);
}
function safeFloor(value: number | null): string | null {
  return value !== null && Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime())
    ? new Date(value).toISOString() : null;
}
async function settleRun(client: MetadataRpcClient, name: string, parameters: Readonly<Record<string, unknown>>) {
  let result;
  try { result = await automaticRpc(client, name, parameters); }
  catch (error) {
    if (!(error instanceof MetadataAutomaticRpcError) || !error.uncertain) throw error;
    // M93 receipt-first replay, with the ORIGINAL floor; never another provider invocation.
    result = await automaticRpc(client, name, parameters);
  }
  return finishSchema.parse(result);
}
export async function registerAutomaticSingleCall(client: MetadataRpcClient, configuration: MetadataGatewayConfiguration,
  input: MetadataProductionRequest & { lookupId: string; attemptId: string }): Promise<string> {
  const parameters = { ...metadataClaimParameters(input), p_attempt_id: input.attemptId, p_physical_call_identity: randomUUID() };
  const name = 'phase9_register_metadata_provider_call';
  const schema = z.object({ provider_call_id: z.string().uuid(), status: z.literal('registered') }).passthrough();
  try { return schema.parse(await automaticRpc(client, name, parameters)).provider_call_id; }
  catch (error) {
    if (error instanceof MetadataAutomaticRpcError && !error.uncertain) throw error;
    // A grant may have committed: exact replay proves its identity, never permission to send.
    const receipt = schema.parse(await automaticRpc(client, name, parameters));
    await finalizeMetadataProductionAttempt(client, configuration, receipt.provider_call_id, {
      lookupId: input.lookupId, attemptId: input.attemptId, normalizedOutcome: 'cancelled',
      disposition: 'stale_rejected', providerRequestId: null, normalizedCandidate: null, retryable: false,
    }, 'automatic_transaction');
    throw error;
  }
}

export async function executeAutomaticMetadata(
  client: MetadataRpcClient, configuration: MetadataGatewayConfiguration,
  gateway: MetadataProductionGateway, request: MetadataProductionRequest, signal: AbortSignal,
): Promise<MetadataCompositionResult> {
  const binding = configuration.automatic;
  if (!binding || configuration.context.purpose !== 'automatic') return manual();
  const { fence, descriptor } = binding, original = configuration.context;
  const policy = decideMetadataProductionPolicy(request.providerPolicy);
  const protection = parseProtectionPolicyOrNull(binding.policy);
  const state = useSharedProtectionState(binding.sharedProtection);
  const key = { f: fence, p_key: descriptor.adapterKey, p_version: descriptor.adapterVersion };
  const boundary = createMetadataAutomaticCompletionBoundary(client);
  const historical = original.currentLookupId !== null || original.currentAttemptId !== null
    || original.currentPhysicalStatus !== null || original.currentAttemptDisposition !== null;
  const fresh = async () => {
    const claim = { jobId: fence.jobId, worker: fence.worker, leaseToken: fence.leaseToken, attempt: fence.claimAttempt };
    const context = await loadMetadataJobContext(client, claim);
    const read = await loadAutomaticEditionFence(client, claim);
    if (canonicalMetadataJson(buildAutomaticFence(context, fence.worker, read)) !== canonicalMetadataJson(fence)) {
      throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
    }
    const provider = context.providerPolicies.find(row => row.adapterKey === descriptor.adapterKey
      && row.adapterVersion === descriptor.adapterVersion);
    if (!provider?.enabled || !provider.matchingAllowed
      || request.providerPolicy.storageAllowed && !provider.storageAllowed) throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
  };
  const terminal = async (outcome: string): Promise<MetadataCompositionResult> =>
    resultForManualCompletion(await gateway.completeManual({ outcome, retryable: false }));
  // F3/M1: a begun run with no physical call must reach a recheck or a terminal job.
  const recheckAfterBegin = async (): Promise<MetadataCompositionResult> => {
    try {
      const settled = await settleRun(client, 'phase9_schedule_automatic_provider_recheck_v1', key);
      if (settled.status === 'retry_scheduled') return { outcome: 'retry_scheduled' };
      if (settled.status !== 'finalized') return terminal('policy_denied');
      const history = binding.read.lineage;
      const historicalValidation = history === null ? undefined : installedProviderValidation(
        descriptor.adapterKey, descriptor.adapterVersion, descriptor.validationContract, descriptor.hostPolicyVersion);
      if (history !== null && !historicalValidation) return terminal('policy_denied');
      const validationContext = history !== null && historicalValidation ? {
        purpose: 'automatic' as const, descriptor, installed: binding.installed, providerValidation: historicalValidation,
        lookupId: history.lookupId, attemptId: history.attemptId, now: new Date().toISOString(), retentionEvidence: null,
      } : undefined;
      const recheckBoundary = createMetadataAutomaticCompletionBoundary(client, validationContext);
      const command = buildAutomaticCompletion({ fence, lookupId: history?.lookupId ?? randomUUID(),
        attemptId: history?.attemptId ?? null, source: history === null ? 'local' : 'external',
        result: { version: 'p9-metadata-result-v2', purpose: 'automatic', rows: null,
          catalogueCompanions: null, retention: null, outcome: failureOutcome('circuit_breaker_open', true) } }, validationContext);
      try { return receiptResult(await recheckBoundary.complete(command)); }
      catch (error) {
        if (!(error instanceof AutomaticCompletionUncertainError)) throw error;
        return receiptResult(await boundary.recover(fence));
      }
    } catch (error) {
      // Uncertain SQL is recovery-only; never a generic fail/requeue.
      if (error instanceof MetadataAutomaticRpcError && error.uncertain) return manual();
      return terminal('policy_denied');
    }
  };
  let runStarted = false;
  try {
    // Same invocation may recover its original token; restart never rebuilds a lost command.
    if (historical) {
      const recovered = await boundary.recover(fence);
      if (recovered.status !== 'missing') return receiptResult(recovered);
      if (binding.read.lineage === null) return manual();
    }
    if (!historical && policy.allowCacheRead) {
      const cached = await gateway.readCache(request);
      if (cached.outcome === 'hit' && (cached.normalizedOutcome !== 'coherent_match' || policy.allowPositiveRetention)) {
        return resultForReuseCompletion(await gateway.completeCacheHit(request, cached.normalizedOutcome, policy), policy);
      }
    }
    if (!policy.allowFreshProviderCall || signal.aborted) {
      return terminal('policy_denied');
    }
    // F3: prove the fan-out transport/protection is usable before any new lineage.
    if (descriptor.protocol.kind !== 'single'
      && (protection === null || configuration.explicitHttp === undefined)) {
      return terminal('policy_denied');
    }
    const recheck = protection !== null && state.breakerOpenedAtMs !== null
      && (Date.now() < state.breakerOpenedAtMs + protection.breakerCooldownMs || state.halfOpenProbeInFlight);
    let lookupId: string | null = null;
    if (protection !== null) {
      const prepared = policy.allowFollowerReuse
        ? await prepareAutomaticMetadata(client, fence, buildAutomaticLookupSpec(request, configuration), recheck)
        : decodeAutomaticPreparation({ admission: await automaticRpc(client,
          'phase9_begin_automatic_provider_run_v1', key), coalescing: null });
      if (prepared.admission !== null
        && (prepared.admission.status === 'started' || prepared.admission.status === 'replayed')) runStarted = true;
      if (prepared.admission === null) {
        return prepared.coalescing.mode === 'follower'
          ? resultForReuseCompletion(await gateway.registerFollower(request, prepared.coalescing.leaderLookupId, policy), policy)
          : resultForManualCompletion(await gateway.deferFollower(request, prepared.coalescing.leaderLookupId));
      }
      if (prepared.admission.status === 'capacity_wait') return { outcome: 'retry_scheduled' };
      if (prepared.admission.status !== 'started') {
        if (prepared.admission.status === 'replayed') {
          const recovered = receiptResult(await boundary.recover(fence));
          return recovered.outcome === 'manual_metadata_required' ? await terminal('policy_denied') : recovered;
        }
        return await terminal('policy_denied');
      }
      if (recheck) return await recheckAfterBegin();
      lookupId = prepared.coalescing?.lookupId ?? null;
    } else if (policy.allowFollowerReuse && !historical) {
      const election = await gateway.decideCoalescing(request);
      if (election.mode === 'follower') return resultForReuseCompletion(
        await gateway.registerFollower(request, election.leaderLookupId, policy), policy);
      if (election.mode === 'follower_pending') return resultForManualCompletion(
        await gateway.deferFollower(request, election.leaderLookupId));
      lookupId = election.lookupId ?? null;
    }
    const lineage = binding.read.lineage;
    const startedAt = new Date().toISOString();
    const headers: Headers[] = [];
    let firstGetAt: number | null = null, retryFloor: number | null = null;
    let attemptId = '';
    let deniedRetention = false;
    let result: MetadataResultV2;
    let sent = false, responded = false, invocationFailed = false;
    let permit: Awaited<ReturnType<typeof acquireStartPermit>> | null = null;
    let probe = false;
    const noteHeaders = (value: Headers) => {
      headers.push(value);
      const floor = parseRetryAfterMs(value.get('retry-after'), Date.now());
      if (safeFloor(floor) !== null) retryFloor = Math.max(retryFloor ?? Number.NEGATIVE_INFINITY, floor!);
    };
    try {
      // F1: acquire the single-call start permit BEFORE the breaker check, exactly
      // like providerHttp.ts. A refusal here happens before logical lineage; if
      // begin already committed, recheck the no-call run instead of dead-ending it.
      if (descriptor.protocol.kind === 'single' && protection !== null) {
        try {
          permit = await acquireStartPermit(protection, state, Date.now,
            ms => new Promise(resolve => setTimeout(resolve, ms)), signal);
          probe = checkBreaker(protection, state, Date.now());
        } catch {
          permit?.done(false);
          return await recheckAfterBegin();
        }
      }
      lookupId = lineage?.lookupId ?? lookupId ?? (await gateway.registerLookup(request)).lookupId;
      // Retry uses the original logical reservation/attempt. M93 alone authorized this round.
      attemptId = lineage?.attemptId ?? (await gateway.registerAttempt({ ...request, lookupId,
        reservationId: (await gateway.reserveUsage({ ...request, lookupId })).reservationId, providerRole: 'primary' })).attemptId;
      if (descriptor.protocol.kind === 'single') {
        await fresh();
        if (!await gateway.validateEgress({ ...request, lookupId, attemptId })) {
          try { await gateway.finalizeAttempt({ lookupId, attemptId, normalizedOutcome: 'policy_denied',
            disposition: 'stale_rejected', providerRequestId: null, normalizedCandidate: null, retryable: false }); }
          catch { /* A pre-registration refusal has no physical row to settle. */ }
          return { outcome: 'stale_claim' };
        }
        try { await fresh(); } catch (error) {
          await gateway.finalizeAttempt({ lookupId, attemptId, normalizedOutcome: 'policy_denied',
            disposition: 'stale_rejected', providerRequestId: null, normalizedCandidate: null, retryable: false });
          throw error;
        }
        const forbidden: ProviderHttpPort = { get: async () => { throw new Error('P9_AUTOMATIC_PROTOCOL_INVALID'); } };
        try { result = await descriptor.invoke({ query: request.query, correlationId: lookupId, attemptId,
          signal, purpose: 'automatic', http: forbidden, observeAutomaticHttp: event => {
            if (event.kind === 'send_started') { sent = true; permit?.done(true); }
            else {
              responded = true;
              const floor = parseRetryAfterMs(event.retryAfter, event.at);
              if (safeFloor(floor) !== null) retryFloor = floor;
            }
          } }); } catch {
          invocationFailed = true;
          result = { version: 'p9-metadata-result-v2', purpose: 'automatic', rows: null,
            catalogueCompanions: null, retention: null, outcome: failureOutcome('provider_unavailable', true) };
        }
        const outcome = result.outcome;
        deniedRetention = outcome.selected !== null && !policy.allowPositiveRetention;
        // A normalized network error does not prove a received provider response.
        const unknown = invocationFailed || sent && !responded;
        await gateway.finalizeAttempt({ lookupId, attemptId, normalizedOutcome: outcome.outcome,
          disposition: sent || unknown ? 'rejected' : 'stale_rejected', providerRequestId: outcome.providerRequestId,
          normalizedCandidate: deniedRetention ? null : outcome.selected, evidence: deniedRetention ? [] : outcome.evidence,
          logicalOutcome: deniedRetention ? 'policy_denied' : undefined, retryable: outcome.retryable,
          physicalStatus: unknown ? 'outcome_unknown' : 'finalized' });
        if (protection !== null && sent) {
          const failed = outcome.retryable;
          if (probe) settleHalfOpenProbe(state, !failed, Date.now());
          else if (failed) recordBreakerFailure(protection, state, Date.now());
        }
        // F2: a proven-unsent, known outcome must terminalize, never recovery-loop.
        if (!sent && !unknown) return await terminal(outcome.outcome);
        // F5: NULL-policy unknown send keeps HEAD's retryable manual completion.
        if (unknown && protection === null) return resultForManualCompletion(await gateway.completeManual({
          lookupId, attemptId, outcome: 'provider_unavailable', retryable: true }));
        if (deniedRetention) result = { version: 'p9-metadata-result-v2', purpose: 'automatic',
          outcome: failureOutcome('policy_denied', false), rows: null, catalogueCompanions: null, retention: null };
      } else {
        const http = configuration.explicitHttp;
        if (!http || protection === null) return await terminal('policy_denied');
        const hooks = createEditionProviderCalls(client, configuration).createPortHooks(lookupId, attemptId);
        const port = createProviderHttpPort({ ...http, adapterKey: descriptor.adapterKey,
          adapterVersion: descriptor.adapterVersion, maxGets: descriptor.protocol.maxGets,
          lookupId, attemptId, claim: { jobId: fence.jobId, worker: fence.worker,
            leaseToken: fence.leaseToken, claimAttempt: fence.claimAttempt },
          beforeRequest: call => hooks.beforeRequest(call),
          afterRequest: (id, settled) => hooks.afterRequest(id, { ...settled, physicalStatus: settled.status }) });
        try {
          result = await descriptor.invoke({ query: request.query, correlationId: lookupId, attemptId,
            signal, purpose: 'automatic', http: { get: async call => {
              if (firstGetAt === null) firstGetAt = Date.now();
              try { const response = await port.get(call); noteHeaders(response.headers); return response; }
              catch (error) { if (error instanceof ProviderHttpError && error.headers) noteHeaders(error.headers); throw error; }
            } } });
        } catch {
          // M1: fan-out settles like the single path and always reaches finish.
          invocationFailed = true;
          result = { version: 'p9-metadata-result-v2', purpose: 'automatic', rows: null,
            catalogueCompanions: null, retention: null, outcome: failureOutcome('provider_unavailable', true) };
        }
        // F4: a fan-out winner without a retained list is a policy denial, not a command.
        deniedRetention = result.outcome.selected !== null
          && (!policy.allowPositiveRetention || result.rows === null || result.retention === null);
        if (deniedRetention) result = { version: 'p9-metadata-result-v2', purpose: 'automatic',
          outcome: failureOutcome('policy_denied', false), rows: null, catalogueCompanions: null, retention: null };
      }
    } finally {
      permit?.done(false);
      if (probe && !sent) releaseHalfOpenProbe(state);
    }
    const notBefore = safeFloor(retryFloor);
    if (protection !== null) {
      const finished = await settleRun(client, 'phase9_finish_automatic_provider_run_v1', { ...key, p_not_before: notBefore });
      if (finished.status === 'retry_scheduled') return { outcome: 'retry_scheduled' };
      if (finished.status !== 'finalized') return await terminal(
        deniedRetention ? 'policy_denied' : 'provider_unavailable');
      if (invocationFailed) return await terminal('provider_unavailable');
      if (deniedRetention && descriptor.protocol.kind !== 'single') return await terminal('policy_denied');
    } else if (result.outcome.retryable) {
      return resultForManualCompletion(await gateway.completeManual({ lookupId, attemptId,
        outcome: result.outcome.outcome, retryable: true }));
    }
    const validation = installedProviderValidation(descriptor.adapterKey, descriptor.adapterVersion,
      descriptor.validationContract, descriptor.hostPolicyVersion);
    if (!validation) return await terminal('policy_denied');
    let retentionEvidence: VerifiedRetention | null = null;
    if (result.retention !== null) {
      // Verify duration against every ACTUAL response, including isolated author failures.
      const fetched = result.retention.sourceFetchedAt;
      if (firstGetAt === null || Date.parse(fetched) < Date.parse(startedAt)
        || Date.parse(fetched) > firstGetAt) return await terminal('policy_denied');
      let evidence = { storagePermissionVerified: true, permittedDeadlineAt:
        new Date(Date.parse(fetched) + 24 * 60 * 60 * 1000).toISOString() as string | null };
      for (const header of headers) evidence = boundOptionsRetentionEvidence(fetched, evidence, header);
      if (evidence.storagePermissionVerified && evidence.permittedDeadlineAt && descriptor.retentionContract) {
        retentionEvidence = { sourceFetchedAt: fetched, permittedDeadlineAt: evidence.permittedDeadlineAt,
          policyVersion: configuration.selectedPolicyVersion!, retentionContract: descriptor.retentionContract };
      }
    }
    const context = { purpose: 'automatic' as const, descriptor, installed: binding.installed,
      providerValidation: validation, lookupId, attemptId, now: new Date().toISOString(), retentionEvidence };
    const command = buildAutomaticCompletion({ fence, lookupId, attemptId, source: 'external', result }, context);
    const completion = createMetadataAutomaticCompletionBoundary(client, context);
    const receiptBinding = { lookupId, selectedOptionId: command.selectedOptionId,
      outcome: canonicalizeMetadataOutcome(command.result.outcome.outcome) };
    // Freeze optional cache arguments before completion. Never regenerate timestamps during recovery.
    const cache = snapshotAutomaticValue({ p_lookup_id: lookupId, p_worker: fence.worker,
      p_lease_token: fence.leaseToken, p_attempt_count: fence.claimAttempt,
      p_outcome: result.outcome.selected !== null ? 'positive'
        : ['ambiguous_match', 'material_conflict'].includes(result.outcome.outcome) ? 'ambiguous' : 'negative',
      p_normalized_snapshot: result.outcome.selected, p_provider_record_id: null, p_source_fetched_at: startedAt,
      p_expires_at: new Date(Date.parse(startedAt) + configuration.revalidationSeconds * 1000).toISOString() });
    let receipt: AutoReceipt | Readonly<{ status: 'stale_rejected' }>;
    try { receipt = await completion.complete(command); }
    catch (error) {
      if (!(error instanceof AutomaticCompletionUncertainError)) throw error;
      const recovered = await completion.recover(fence, receiptBinding);
      if (recovered.status === 'missing') return manual();
      receipt = recovered;
    }
    if (receipt.status !== 'stale_rejected' && policy.allowCacheWrite && !result.outcome.retryable
      && isCacheableOutcome(result.outcome.outcome)) {
      try { await automaticRpc(client, 'phase9_store_metadata_cache', cache); } catch { /* optional after terminal receipt */ }
    }
    return receiptResult(receipt);
  } catch (error) {
    // No generic fail/requeue may follow an uncertain admission/send/completion.
    if (error instanceof MetadataAutomaticRpcError && !error.uncertain && error.message === 'P9_STATE_CONFLICT'
      || error instanceof Error && error.message === 'P9_METADATA_STALE_PHYSICAL_CALL') {
      return { outcome: 'stale_claim' };
    }
    if (error instanceof MetadataAutomaticRpcError && error.uncertain
      || error instanceof AutomaticCompletionUncertainError) return manual();
    // A known refusal after begin must not leave the job permanently in_progress.
    if (runStarted) {
      try { return await terminal('policy_denied'); } catch { return manual(); }
    }
    return manual();
  }
}
