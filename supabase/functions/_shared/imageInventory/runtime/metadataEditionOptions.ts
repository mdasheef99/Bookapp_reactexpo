import type { MetadataProviderAdapter } from '../metadata/providerAdapter';
import { OpenLibraryEditionOptionsAdapter } from '../metadata/openLibrary';
import type { EditionHttpHooks } from '../metadata/openLibrary/transport';
import { OpenLibraryFailure, getOpenLibraryJson } from '../metadata/openLibrary/transport';
import type { OpenLibraryRequestPermit } from '../metadata/openLibrary/transport';
import type { ProviderHttpPort, ProviderDescriptor, MetadataResultV2 } from '../metadata/providerDescriptor';
import { createProviderHttpPort, ProviderHttpError } from '../metadata/providerHttp';
import type { MetadataGatewayConfiguration } from './metadataGatewayContext';
export type EditionOptionsAdapter = MetadataProviderAdapter & {
  lookupEditionOptions(input: Parameters<MetadataProviderAdapter['lookup']>[0] & {
    httpHooks?: EditionHttpHooks;
    // S3 bridge (U6): a fenced ProviderHttpPort for descriptor-driven calls.
    // Adapters that predate it (Google) ignore the field; OL v1 routes every
    // GET through it when present. Never supplied together with httpHooks.
    httpPort?: ProviderHttpPort;
  }): Promise<EditionOptionsProviderResult>;
};
import { resolveOptionsDeadline } from '../metadata/googleBooks/editionOptions';
import { parseNormalizedMetadataEdition } from '../contracts/metadata';
import { fetchedAtMicros } from '../contracts/catalogueWrite';
import { projectStoredEditionRow } from '../contracts/ownerEditionPicker';
import { GOOGLE_BOOKS_EDITION_HOST_POLICY } from '../metadata/googleBooks/decoder';
import type { EditionOptionsProviderResult } from '../metadata/contracts';
import type { MetadataJobContext } from './metadataJobContext';
import { decideMetadataProductionPolicy } from './metadataProductionComposition';
import type { MetadataProductionGateway } from './metadataProductionComposition';
import type { EditionOptionsFence, EditionOptionsCompletion } from './metadataEditionOptionsBoundary';
import { EditionOptionsCompletionUncertainError, editionOptionsFence } from './metadataEditionOptionsBoundary';

export type MetadataEditionOptionsJobResult = Readonly<{
  outcome: 'edition_options_available' | 'manual_metadata_required' | 'stale_claim' | 'retry_scheduled';
}>;

// S7: admission pause, policy/auth/quota/configuration denials and breaker
// refusals keep their identity. Thrown denials must terminate without
// secondary egress or technical retry instead of collapsing into retryable
// provider_unavailable.
const EXPLICIT_DENIAL_OUTCOMES: readonly string[] = [
  'policy_denied', 'provider_disabled', 'authentication_configuration_failure',
  'cost_quota_denied', 'legal_launch_denied', 'cancelled', 'insufficient_query',
  'circuit_breaker_open',
];

export function explicitDenialOutcome(error: unknown): string | null {
  const outcome = error instanceof OpenLibraryFailure ? error.outcome
    : error instanceof ProviderHttpError ? error.outcome : null;
  if (outcome !== null && EXPLICIT_DENIAL_OUTCOMES.includes(outcome)) return outcome;
  if (error instanceof Error && EXPLICIT_DENIAL_OUTCOMES.includes(error.message)) return error.message;
  return null;
}

// S7: an admission pause is an operator/policy refusal, not a technical retry
// allowance: no fabricated finalization, no GET, manual fallback.
export function isAdmissionPaused(error: unknown): boolean {
  return error instanceof Error && error.message === 'P9_EXTERNAL_ADMISSION_PAUSED';
}

// U6 fix1 (F7): shared denial mapping for every explicit-path catch. Thrown
// denials and admission pauses keep identity (nonretryable, no secondary,
// no new-claim retry). Unknown P9_-coded errors (configuration/state) also
// terminate without fallback or retry — they are never collapsed into
// retryable provider_unavailable. Non-P9_ unknowns (genuine transport/
// programming failures) keep the existing retryable outcome. Returns null
// when the caller must apply its default (retryable) mapping.
export function denialFail(error: unknown): { outcome: string; retryable: boolean } | null {
  if (isAdmissionPaused(error)) return { outcome: 'provider_unavailable', retryable: false };
  const denial = explicitDenialOutcome(error);
  if (denial !== null) return { outcome: denial, retryable: false };
  if (error instanceof Error && error.message.startsWith('P9_')) {
    return { outcome: 'provider_unavailable', retryable: false };
  }
  return null;
}

// Narrow variant for the OUTER catch: completion/recovery-phase P9_ errors
// (e.g. a mismatched completion receipt, P9_EDITION_COMPLETION_INVALID) keep
// their pinned recovery (retryable) semantics; only pauses, typed denials
// and configuration failures terminate. Lookup-phase catches use the full
// denialFail above.
export function outerDenialFail(error: unknown): { outcome: string; retryable: boolean } | null {
  if (isAdmissionPaused(error)) return { outcome: 'provider_unavailable', retryable: false };
  const denial = explicitDenialOutcome(error);
  if (denial !== null) return { outcome: denial, retryable: false };
  if (error instanceof Error && error.message === 'P9_PROVIDER_CONFIGURATION_INVALID') {
    return { outcome: 'provider_disabled', retryable: false };
  }
  return null;
}

// Picker §§4.1-4.3/5/9: automatic winner reuse/selection are never called by this operation.
export async function executeEditionOptionsLookup(
  context: MetadataJobContext, gateway: MetadataProductionGateway,
  adapter: EditionOptionsAdapter, signal: AbortSignal, fallback?: OpenLibraryEditionOptionsAdapter,
): Promise<MetadataEditionOptionsJobResult> {
  if (context.purpose !== 'edition_options' || context.requestGeneration === null) {
    throw new Error('P9_EDITION_CONTEXT_INVALID');
  }
  const port = gateway.editionOptions;
  if (!port) return { outcome: 'manual_metadata_required' };
  const { request, boundary } = port;
  if (request.jobId !== context.jobId || request.candidateId !== context.candidateId
    || request.storeId !== context.storeId || request.claimAttempt !== context.attempt
    || request.claimLeaseToken !== context.claimToken || request.query.key !== context.queryIdentity
    || request.claimWorker.length === 0) throw new Error('P9_EDITION_CONTEXT_INVALID');
  const fence: EditionOptionsFence = editionOptionsFence(context,request.claimWorker);
  const fail = async (outcome: EditionOptionsProviderResult['outcome'], retryable: boolean)
    : Promise<MetadataEditionOptionsJobResult> => {
    const completion = await boundary.fail({ ...fence, outcome, retryable });
    const status = completion.status === 'replayed' ? completion.jobStatus : completion.status;
    return { outcome: status === 'retry_scheduled' ? 'retry_scheduled' : 'manual_metadata_required' };
  };
  const completionResult = (completion: EditionOptionsCompletion): MetadataEditionOptionsJobResult | null => {
    if (completion.status === 'stale_rejected') return { outcome: 'stale_claim' };
    if (completion.status === 'missing') return null;
    if (completion.requestId !== fence.requestId || completion.requestGeneration !== fence.requestGeneration
      || !Number.isSafeInteger(completion.optionsVersion) || completion.optionsVersion < 1
      || !Number.isFinite(Date.parse(completion.optionsExpiresAt))) {
      throw new Error('P9_EDITION_COMPLETION_INVALID');
    }
    return Date.parse(completion.optionsExpiresAt) > Date.now()
      ? { outcome: 'edition_options_available' } : { outcome: 'manual_metadata_required' };
  };
  const recoveryOnly = context.currentPhysicalStatus === 'finalized' && context.currentPhysicalRetryable === false
    && context.currentPhysicalClaimAttempt !== context.attempt;
  // U6: descriptor-driven entry. A descriptor third argument (elected by the
  // verified route) executes through the fenced port flow below; the adapter
  // binding comes from the gateway's explicitDescriptor (worker route or R1
  // test seam). Discrimination is structural (invoke/protocol/purposes), never
  // instanceof. Legacy adapter callers are unaffected.
  if (isProviderDescriptor(adapter)) {
    const binding = (gateway as { explicitDescriptor?: {
      descriptor: ProviderDescriptor; adapter?: EditionOptionsAdapter | null;
      fallbackAdapter?: EditionOptionsAdapter | null;
    } }).explicitDescriptor;
    if (binding === undefined || binding.descriptor !== (adapter as unknown as ProviderDescriptor)) {
      return await fail('provider_disabled', false);
    }
    return executeDescriptorEditionOptions(context, gateway, {
      descriptor: binding.descriptor,
      adapter: binding.adapter ?? null,
      fallbackAdapter: binding.fallbackAdapter ?? null,
    }, signal);
  }
  try {
    if (signal.aborted) return await fail('cancelled', false);
    const recovered = completionResult(await boundary.recover(fence));
    if (recovered) return recovered;
    // 02b sections 7.1/8.1-8.2/10: recover before deriving the current cache tuple.
    // Only SQL's plain miss continues to registration/reservation/provider egress.
    const reused = await boundary.reuseCache({ ...fence, cacheVersions: port.cacheVersions() });
    if (reused.status !== 'miss') {
      return completionResult(reused) ?? { outcome: 'manual_metadata_required' };
    }
    if (signal.aborted) return await fail('cancelled', false);
    const policy = decideMetadataProductionPolicy(request.providerPolicy);
    if (!policy.allowFreshProviderCall || !policy.allowPositiveRetention) return await fail('policy_denied', false);
    // 02b section 10: after recovery proves no receipt, terminate without refetching,
    // after lease reclaim of a finalized nonretryable response.
    if (recoveryOnly) return await fail('provider_unavailable', false);
    if (context.currentPhysicalStatus === 'stale_rejected' && context.currentPhysicalClaimAttempt === context.attempt) return { outcome: 'stale_claim' };
    // Same-claim replay cannot authorize a duplicate physical call when its outcome is known.
    if (context.currentPhysicalStatus === 'finalized' && context.currentPhysicalClaimAttempt === context.attempt) {
      return await fail('provider_unavailable', true);
    }
    const { lookupId } = await gateway.registerLookup(request);
    const { reservationId } = await gateway.reserveUsage({ ...request, lookupId });
    let { attemptId } = await gateway.registerAttempt({ ...request, lookupId, reservationId, providerRole: 'primary' });
    if (signal.aborted) return await fail('cancelled', false);
    let selectedAdapter = adapter;
    if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter)
      && !await gateway.validateEgress({ ...request, lookupId, attemptId })) return { outcome: 'stale_claim' };
    const lookup = async () => selectedAdapter.lookupEditionOptions({
      query: request.query, correlationId: lookupId, attemptId, signal,
      httpHooks: selectedAdapter instanceof OpenLibraryEditionOptionsAdapter
        ? gateway.editionProviderCalls?.createHooks(lookupId,attemptId) : undefined,
    });
    if (selectedAdapter instanceof OpenLibraryEditionOptionsAdapter && !gateway.editionProviderCalls) {
      return await fail('provider_disabled',false);
    }
    let provider: EditionOptionsProviderResult;
    try {
      provider = await lookup();
    } catch(error) {
      if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
      // U6 fix1 (F7): shared denial mapping — denials, pauses and unknown-P9_
      // keep identity (manual, no secondary, no retry); only non-P9_ unknowns
      // keep the retryable technical-failure mapping.
      const mapped = denialFail(error);
      if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter)) await gateway.finalizeAttempt({
        lookupId, attemptId, normalizedOutcome: (mapped?.outcome ?? 'provider_unavailable') as Parameters<typeof gateway.finalizeAttempt>[0]['normalizedOutcome'],
        disposition: 'rejected',
        providerRequestId: null, normalizedCandidate: null, retryable: mapped === null, physicalStatus: 'outcome_unknown',
      });
      if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
      return await fail('provider_unavailable', true);
    }
    // Physical spend is durable separately from options persistence; audits/cache retain no alternatives.
    if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter)) await gateway.finalizeAttempt({
      lookupId, attemptId, normalizedOutcome: provider.outcome, disposition: 'rejected',
      providerRequestId: provider.providerRequestId, normalizedCandidate: null,
      evidence: [], retryable: provider.retryable, physicalStatus: 'finalized',
    });
    if (signal.aborted) return await fail('cancelled', false);
    // Google remains preferred when it has independent retention permission. Denial never invokes a secondary.
    const allowedFallback = ['no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
      'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open','network_failure','response_too_large','unsupported_content_type'];
    const googleRetention = provider.fetchedAt && provider.retentionEvidence
      ? resolveOptionsDeadline(provider.fetchedAt,provider.retentionEvidence) : null;
    if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter) && fallback && gateway.editionProviderCalls
      && allowedFallback.includes(provider.outcome) && (provider.fetchedAt === null || googleRetention !== null)
      && !provider.rows.some(row => row.eligibility === 'eligible')) {
      ({ attemptId } = await gateway.editionProviderCalls.registerFallback(request,lookupId,reservationId,attemptId,provider.outcome));
      selectedAdapter = fallback;
      provider = await lookup();
    }
    if (provider.retryable) return await fail(provider.outcome, true);
    if (provider.fetchedAt === null && provider.rows.length === 0) return await fail(provider.outcome, false);
    const expiresAt = provider.fetchedAt && provider.retentionEvidence
      ? resolveOptionsDeadline(provider.fetchedAt, provider.retentionEvidence) : null;
    if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return await fail('policy_denied', false);
    if (!Array.isArray(provider.rows) || provider.rows.length > 10) return await fail('schema_invalid', false);
    try {
      const ids = new Set<string>();
      for (const [ordinal, row] of provider.rows.entries()) {
        projectStoredEditionRow(row);
        if (row.ordinal !== ordinal || ids.has(row.optionId)
          || Object.keys(row).some(key => !['optionId','ordinal','googleBooksUrl','eligibility','metadata'].includes(key))) {
          throw new Error('P9_EDITION_ROWS_INVALID');
        }
        ids.add(row.optionId);
        if (row.metadata !== null) {
          const metadata = parseNormalizedMetadataEdition(row.metadata, selectedAdapter.normalizedEditionHostPolicy);
          if (metadata.adapterKey !== selectedAdapter.normalizedEditionHostPolicy?.adapterKey
            || metadata.correlationId !== lookupId || metadata.attemptId !== attemptId
            || fetchedAtMicros(metadata.fetchedAt) !== fetchedAtMicros(provider.fetchedAt!)) throw new Error('P9_EDITION_ROWS_INVALID');
        }
      }
    } catch {
      return await fail('schema_invalid', false);
    }
    const completion = await boundary.complete({
      ...fence, lookupId, attemptId, sourceFetchedAt: provider.fetchedAt!,
      optionsExpiresAt: expiresAt, storagePermissionVerified: true, rows: provider.rows,
      catalogueCompanions: provider.catalogueCompanions,
    });
    return completionResult(completion) ?? await fail('provider_unavailable', true);
  } catch (error) {
    if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) return { outcome: 'stale_claim' };
    // A committed transaction may lose its response. Recover its slim receipt before scheduling retry.
    try {
      const recovered = completionResult(await boundary.recover(fence));
      if (recovered) return recovered;
      if (recoveryOnly) return await fail('provider_unavailable', false);
    } catch { /* Missing/unavailable recovery cannot manufacture a saved response. */ }
    // 02b sections 7.1/10: uncertainty/outage stays recovery-only, never a provider retry.
    // Claims still use the existing DB attempt budget; this port cannot defer it neutrally.
    if (error instanceof EditionOptionsCompletionUncertainError || recoveryOnly) return { outcome: 'manual_metadata_required' };
    if (error instanceof Error && ['P9_EDITION_ROWS_INVALID','P9_CATALOGUE_COMPANIONS_INVALID'].includes(error.message)) {
      return await fail('schema_invalid', false);
    }
    // U6 fix1 (F7): pauses, typed denials and configuration failures
    // terminate; completion-phase P9_ errors keep their pinned recovery
    // (retryable) semantics — see outerDenialFail.
    const mapped = outerDenialFail(error);
    if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
    return await fail('provider_unavailable', true);
  }
}

// U6: descriptor-driven explicit execution. Election (which descriptor)
// comes from the verified route; the binding below decides HOW it executes,
// from binding availability — never instanceof or provider/version literals:
// - adapter arm: a live adapter is bound (v1/Google). OL v1 adapters expose
//   transportBinding, so every GET runs through a fenced bridge port (S3);
//   adapters without it (Google) keep the exact legacy direct call (R3/S4).
// - port arm: no live adapter (v2/synthetic port-native). The elected
//   descriptor invokes through a fully fenced port (policy/hosts/validator
//   from explicitHttp); NULL policy never authorizes this arm.
// Legacy adapter callers (no gateway binding) keep executeEditionOptionsLookup
// above byte-identical.
export type DescriptorExplicitExecution = Readonly<{
  descriptor: ProviderDescriptor;
  adapter?: EditionOptionsAdapter | null;
  fallbackAdapter?: EditionOptionsAdapter | null;
}>;

// Structural descriptor discrimination for the legacy entry point (U6): a
// descriptor exposes invoke/protocol/purposes; adapters expose lookup. Never
// instanceof, so synthetic descriptors route without provider literals.
function isProviderDescriptor(value: unknown): value is ProviderDescriptor {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.invoke === 'function'
    && row.protocol !== null && typeof row.protocol === 'object'
    && Array.isArray(row.purposes);
}

type TransportBinding = {
  fetcher: (
    input: string | URL | Request, init?: RequestInit,
  ) => Promise<Response>;
  timeoutMs: number;
  maxResponseBytes: number;
  acquireLimiter: (signal: AbortSignal) => Promise<(egressStarted: boolean) => void>;
};

function transportBindingOf(adapter: EditionOptionsAdapter): TransportBinding | null {
  const binding = (adapter as { transportBinding?: unknown }).transportBinding;
  if (binding === null || typeof binding !== 'object') return null;
  const row = binding as Record<string, unknown>;
  if (typeof row.fetcher !== 'function' || typeof row.timeoutMs !== 'number'
    || typeof row.maxResponseBytes !== 'number' || typeof row.acquireLimiter !== 'function') {
    return null;
  }
  return binding as TransportBinding;
}

// S3 bridge: the port owns bounds/trust/limiter-acquire/registration/fence/
// finalization/receipt; transport owns the single send+parse via the adapter's
// existing constructor-supplied fetcher/timeout/size/limiter. The held permit
// transfers into getOpenLibraryJson (released at GET start there): exactly one
// limiter, one hook pair, no global fetch, no copied bootstrap defaults.
// Exported for bridge-parity tests: the production v1 bridge ( callers
// outside the executor must supply fenced hooks; the port owns
// registration/finalization, transport owns send/parse).
export function createBridgedPort(opts: Readonly<{
  adapterKey: string;
  adapterVersion: string;
  binding: TransportBinding;
  maxGets: number;
  policy: unknown;
  requestHosts?: readonly string[];
  lookupId: string;
  attemptId: string;
  claim: Readonly<{ jobId: string; worker: string; leaseToken: string; claimAttempt: number }>;
  hooks: Readonly<{
    beforeRequest(call: Readonly<{ sequence: number; stage: string; signal: AbortSignal }>)
      : Promise<{ callId: string; grantEpoch: null }>;
    afterRequest(callId: string, settled: Readonly<{ outcome: string; retryable: boolean;
      physicalStatus: 'finalized' | 'outcome_unknown' | 'stale_rejected'; egressStarted: boolean }>)
      : Promise<{ receiptId: string }>;
  }>;
  // F3: provider-scoped shared protection state (worker-owned); all ports
  // for one provider share pacing/breaker observations.
  sharedProtection?: object | null;
  // Unit B: transient server-configuration contact for the identifying
  // User-Agent. Never logged, persisted or returned. NULL selects the
  // fixed legacy literal.
  providerContact?: string | null;
}>): ProviderHttpPort {
  return createProviderHttpPort({
    adapterKey: opts.adapterKey, adapterVersion: opts.adapterVersion,
    policy: opts.policy, maxGets: opts.maxGets,
    timeoutMs: opts.binding.timeoutMs, maxResponseBytes: opts.binding.maxResponseBytes,
    fetcher: opts.binding.fetcher,
    lookupId: opts.lookupId, attemptId: opts.attemptId, claim: opts.claim,
    providerContact: opts.providerContact ?? null,
    acquireLimiter: opts.binding.acquireLimiter,
    transportSend: async (url, call, permit, onSendStart) => {
      const envelope = await getOpenLibraryJson(url, {
        fetcher: opts.binding.fetcher, timeoutMs: opts.binding.timeoutMs,
        maxResponseBytes: opts.binding.maxResponseBytes,
        providerContact: opts.providerContact ?? null,
        waitForRequest: async () => permit as OpenLibraryRequestPermit,
        onFetchStart: onSendStart,
      }, { sequence: call.sequence, stage: call.stage, signal: call.signal });
      return { json: envelope.raw, headers: envelope.headers };
    },
    beforeRequest: async (call) => opts.hooks.beforeRequest(call),
    afterRequest: async (callId, settled) => opts.hooks.afterRequest(callId,
      { outcome: settled.outcome, retryable: settled.retryable,
        physicalStatus: settled.status, egressStarted: settled.egressStarted }),
    requestHosts: opts.requestHosts,
    sharedProtection: opts.sharedProtection ?? null,
  });
}

export async function executeDescriptorEditionOptions(
  context: MetadataJobContext, gateway: MetadataProductionGateway,
  execution: DescriptorExplicitExecution, signal: AbortSignal,
): Promise<MetadataEditionOptionsJobResult> {
  if (context.purpose !== 'edition_options' || context.requestGeneration === null) {
    throw new Error('P9_EDITION_CONTEXT_INVALID');
  }
  const port = gateway.editionOptions;
  if (!port) return { outcome: 'manual_metadata_required' };
  const { request, boundary } = port;
  if (request.jobId !== context.jobId || request.candidateId !== context.candidateId
    || request.storeId !== context.storeId || request.claimAttempt !== context.attempt
    || request.claimLeaseToken !== context.claimToken || request.query.key !== context.queryIdentity
    || request.claimWorker.length === 0) throw new Error('P9_EDITION_CONTEXT_INVALID');
  const fence: EditionOptionsFence = editionOptionsFence(context,request.claimWorker);
  const fail = async (outcome: EditionOptionsProviderResult['outcome'], retryable: boolean)
    : Promise<MetadataEditionOptionsJobResult> => {
    const completion = await boundary.fail({ ...fence, outcome, retryable });
    const status = completion.status === 'replayed' ? completion.jobStatus : completion.status;
    return { outcome: status === 'retry_scheduled' ? 'retry_scheduled' : 'manual_metadata_required' };
  };
  const completionResult = (completion: EditionOptionsCompletion): MetadataEditionOptionsJobResult | null => {
    if (completion.status === 'stale_rejected') return { outcome: 'stale_claim' };
    if (completion.status === 'missing') return null;
    if (completion.requestId !== fence.requestId || completion.requestGeneration !== fence.requestGeneration
      || !Number.isSafeInteger(completion.optionsVersion) || completion.optionsVersion < 1
      || !Number.isFinite(Date.parse(completion.optionsExpiresAt))) {
      throw new Error('P9_EDITION_COMPLETION_INVALID');
    }
    return Date.parse(completion.optionsExpiresAt) > Date.now()
      ? { outcome: 'edition_options_available' } : { outcome: 'manual_metadata_required' };
  };
  const recoveryOnly = context.currentPhysicalStatus === 'finalized' && context.currentPhysicalRetryable === false
    && context.currentPhysicalClaimAttempt !== context.attempt;
  const descriptor = execution.descriptor;
  try {
    if (signal.aborted) return await fail('cancelled', false);
    const recovered = completionResult(await boundary.recover(fence));
    if (recovered) return recovered;
    // 02b sections 7.1/8.1-8.2/10: recover before deriving the current cache tuple.
    // Only SQL's plain miss continues to registration/reservation/provider egress.
    const reused = await boundary.reuseCache({ ...fence, cacheVersions: port.cacheVersions() });
    if (reused.status !== 'miss') {
      return completionResult(reused) ?? { outcome: 'manual_metadata_required' };
    }
    if (signal.aborted) return await fail('cancelled', false);
    const policy = decideMetadataProductionPolicy(request.providerPolicy);
    if (!policy.allowFreshProviderCall || !policy.allowPositiveRetention) return await fail('policy_denied', false);
    // 02b section 10: after recovery proves no receipt, terminate without refetching,
    // after lease reclaim of a finalized nonretryable response.
    if (recoveryOnly) return await fail('provider_unavailable', false);
    if (context.currentPhysicalStatus === 'stale_rejected' && context.currentPhysicalClaimAttempt === context.attempt) return { outcome: 'stale_claim' };
    // Same-claim replay cannot authorize a duplicate physical call when its outcome is known.
    if (context.currentPhysicalStatus === 'finalized' && context.currentPhysicalClaimAttempt === context.attempt) {
      return await fail('provider_unavailable', true);
    }
    const { lookupId } = await gateway.registerLookup(request);
    const { reservationId } = await gateway.reserveUsage({ ...request, lookupId });
    let { attemptId } = await gateway.registerAttempt({ ...request, lookupId, reservationId, providerRole: 'primary' });
    if (signal.aborted) return await fail('cancelled', false);
    const calls = gateway.editionProviderCalls;
    if (!calls) return await fail('provider_disabled', false);
    const hooks = calls.createPortHooks(lookupId, attemptId);
    const http = (gateway as { explicitHttp?: MetadataGatewayConfiguration['explicitHttp'] }).explicitHttp;
    // Normalized provider result: the adapter arm returns it directly; the
    // port arm maps MetadataResultV2 into the same shape so the tail below
    // (retryable/fetchedAt/expiry/rows/completion) is shared and identical.
    let provider: EditionOptionsProviderResult;
    // Per-GET finalization owner: true when every GET finalizes through port
    // hooks (bridge + full port); false only for the legacy direct adapter
    // call, which finalizes at the attempt level like the historical Google path.
    let perGetFinalized = true;
    let hostPolicy: Parameters<typeof parseNormalizedMetadataEdition>[1] =
      http?.rowHostPolicy ?? undefined;
    let expectedAdapterKey = descriptor.adapterKey;
    let fallbackAdapter: EditionOptionsAdapter | null = null;
    if (execution.adapter !== undefined && execution.adapter !== null) {
      const adapter = execution.adapter;
      const binding = transportBindingOf(adapter);
      if (binding !== null) {
        const claim = { jobId: request.jobId, worker: request.claimWorker,
          leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
        const bridge = createBridgedPort({ adapterKey: descriptor.adapterKey,
          adapterVersion: descriptor.adapterVersion, binding,
          maxGets: descriptor.protocol.maxGets, policy: http?.policy ?? null,
          requestHosts: http?.requestHosts, lookupId, attemptId, claim, hooks,
          providerContact: http?.providerContact ?? null,
          sharedProtection: http?.sharedProtection ?? null });
        try {
          provider = await adapter.lookupEditionOptions({
            query: request.query, correlationId: lookupId, attemptId, signal, httpPort: bridge,
          });
        } catch (error) {
          if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
          const mapped = denialFail(error);
          if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
          return await fail('provider_unavailable', true);
        }
      } else {
        // Adapters without a transport binding (Google) keep the exact legacy
        // direct call (R3/S4): no hooks, attempt-level finalization, no wrapper.
        // U6 fix1 (F12): routed Google performs EXACTLY the legacy egress
        // validation and physical accounting (validateEgress single-call
        // registration before lookup, attempt-level finalization after).
        perGetFinalized = false;
        hostPolicy = (adapter as { normalizedEditionHostPolicy?: Parameters<typeof parseNormalizedMetadataEdition>[1] }).normalizedEditionHostPolicy;
        expectedAdapterKey = (adapter as { normalizedEditionHostPolicy?: { adapterKey?: string } }).normalizedEditionHostPolicy?.adapterKey ?? descriptor.adapterKey;
        fallbackAdapter = execution.fallbackAdapter ?? null;
        if (!await gateway.validateEgress({ ...request, lookupId, attemptId })) {
          return { outcome: 'stale_claim' };
        }
        try {
          provider = await adapter.lookupEditionOptions({
            query: request.query, correlationId: lookupId, attemptId, signal,
          });
        } catch (error) {
          if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
          const mapped = denialFail(error);
          await gateway.finalizeAttempt({
            lookupId, attemptId,
            normalizedOutcome: ((mapped?.outcome ?? 'provider_unavailable') as Parameters<typeof gateway.finalizeAttempt>[0]['normalizedOutcome']),
            disposition: 'rejected',
            providerRequestId: null, normalizedCandidate: null, retryable: mapped === null, physicalStatus: 'outcome_unknown',
          });
          if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
          return await fail('provider_unavailable', true);
        }
        await gateway.finalizeAttempt({
          lookupId, attemptId, normalizedOutcome: provider.outcome, disposition: 'rejected',
          providerRequestId: provider.providerRequestId, normalizedCandidate: null,
          evidence: [], retryable: provider.retryable, physicalStatus: 'finalized',
        });
      }
    } else {
      // Port arm (v2/synthetic port-native): NULL policy never authorizes it.
      if (http === undefined || http.policy === null || http.policy === undefined) {
        return await fail('provider_disabled', false);
      }
      const claim = { jobId: request.jobId, worker: request.claimWorker,
        leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
      const fenced = createProviderHttpPort({
        adapterKey: descriptor.adapterKey, adapterVersion: descriptor.adapterVersion,
        policy: http.policy, maxGets: descriptor.protocol.maxGets,
        timeoutMs: http.timeoutMs, maxResponseBytes: http.maxResponseBytes,
        fetcher: http.fetcher, lookupId, attemptId, claim,
        retentionPolicyVersion: http.retentionPolicyVersion,
        providerContact: http.providerContact ?? null,
        beforeRequest: async (call) => hooks.beforeRequest(call),
        afterRequest: async (callId, settled) => hooks.afterRequest(callId,
          { outcome: settled.outcome, retryable: settled.retryable,
            physicalStatus: settled.status, egressStarted: settled.egressStarted }),
        requestHosts: http.requestHosts, requestValidator: http.requestValidator,
        sharedProtection: http.sharedProtection,
      });
      let result: MetadataResultV2;
      try {
        result = await descriptor.invoke({ query: request.query, correlationId: lookupId,
          attemptId, signal, purpose: 'edition_options', http: fenced });
      } catch (error) {
        if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
        const mapped = denialFail(error);
        if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
        return await fail('provider_unavailable', true);
      }
      provider = {
        outcome: result.outcome.outcome as EditionOptionsProviderResult['outcome'],
        retryable: result.outcome.retryable,
        rows: result.rows === null ? [] : [...result.rows],
        fetchedAt: result.retention?.sourceFetchedAt ?? null,
        retentionEvidence: result.retention === null ? null : {
          storagePermissionVerified: true as const,
          permittedDeadlineAt: result.retention.permittedDeadlineAt,
        },
        providerRequestId: result.outcome.providerRequestId,
        catalogueCompanions: result.catalogueCompanions === null ? undefined : [...result.catalogueCompanions],
      };
    }
    if (signal.aborted) return await fail('cancelled', false);
    // Google remains preferred when it has independent retention permission. Denial never invokes a secondary.
    const allowedFallback = ['no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
      'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open','network_failure','response_too_large','unsupported_content_type'];
    // U6 fix1 (F6): fallback executes under the SECONDARY descriptor and row,
    // never the primary's configuration. Secondary port/validation parameters
    // come from fallbackExplicitHttp (worker, secondary row); the fresh fence
    // uses secondary identity via the binding override.
    const gatewayBinding = (gateway as { explicitDescriptor?: {
      fallbackDescriptor?: ProviderDescriptor | null;
      fallbackExplicitHttp?: import('./metadataGatewayContext').ExplicitHttpConfig | undefined;
    } }).explicitDescriptor;
    const secondaryDescriptor = gatewayBinding?.fallbackDescriptor ?? null;
    const secondaryHttp = gatewayBinding?.fallbackExplicitHttp;
    const canFallback = fallbackAdapter !== null
      || (secondaryDescriptor !== null && secondaryHttp !== undefined);
    if (!perGetFinalized && canFallback && allowedFallback.includes(provider.outcome)) {
      const googleRetention = provider.fetchedAt && provider.retentionEvidence
        ? resolveOptionsDeadline(provider.fetchedAt,provider.retentionEvidence) : null;
      if ((provider.fetchedAt === null || googleRetention !== null)
        && !provider.rows.some(row => row.eligibility === 'eligible')) {
        ({ attemptId } = await calls.registerFallback(request,lookupId,reservationId,attemptId,provider.outcome));
        try {
          if (fallbackAdapter !== null) {
            const binding = transportBindingOf(fallbackAdapter);
            // Secondary fresh fence: secondary key/version, not primary's.
            const secondaryBinding = secondaryDescriptor === null ? undefined
              : { adapterKey: secondaryDescriptor.adapterKey,
                adapterVersion: secondaryDescriptor.adapterVersion };
            // F6: adapter-arm fallback rows validate against the SECONDARY
            // key/host policy (like the legacy reassignment to the fallback
            // adapter), never the primary's.
            expectedAdapterKey = secondaryDescriptor?.adapterKey
              ?? (fallbackAdapter as { normalizedEditionHostPolicy?: { adapterKey?: string } })
                .normalizedEditionHostPolicy?.adapterKey ?? expectedAdapterKey;
            hostPolicy = secondaryHttp?.rowHostPolicy
              ?? (fallbackAdapter as { normalizedEditionHostPolicy?: Parameters<typeof parseNormalizedMetadataEdition>[1] })
                .normalizedEditionHostPolicy ?? hostPolicy;
            if (binding !== null) {
              const claim = { jobId: request.jobId, worker: request.claimWorker,
                leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
              // G5: when the routed secondary carries its own http config, use
              // its policy/requestHosts/sharedProtection VERBATIM (an explicit
              // null policy selects legacy fencing, never the primary's
              // numbers). The primary values apply only to a fallback adapter
              // with no secondary config at all (legacy direct callers).
              const secondaryProtection = secondaryHttp === undefined ? {
                policy: http?.policy ?? null,
                requestHosts: http?.requestHosts,
                providerContact: http?.providerContact ?? null,
                sharedProtection: http?.sharedProtection ?? null,
              } : {
                policy: secondaryHttp.policy,
                requestHosts: secondaryHttp.requestHosts,
                providerContact: secondaryHttp.providerContact ?? null,
                sharedProtection: secondaryHttp.sharedProtection ?? null,
              };
              const bridge = createBridgedPort({ adapterKey: secondaryDescriptor?.adapterKey ?? descriptor.adapterKey,
                adapterVersion: secondaryDescriptor?.adapterVersion ?? descriptor.adapterVersion,
                binding,
                maxGets: secondaryDescriptor?.protocol.maxGets ?? descriptor.protocol.maxGets,
                policy: secondaryProtection.policy,
                requestHosts: secondaryProtection.requestHosts,
                lookupId, attemptId, claim,
                hooks: calls.createPortHooks(lookupId, attemptId, secondaryBinding),
                providerContact: secondaryProtection.providerContact,
                sharedProtection: secondaryProtection.sharedProtection });
              provider = await fallbackAdapter.lookupEditionOptions({
                query: request.query, correlationId: lookupId, attemptId, signal, httpPort: bridge,
              });
            } else {
              provider = await fallbackAdapter.lookupEditionOptions({
                query: request.query, correlationId: lookupId, attemptId, signal,
              });
            }
          } else if (secondaryDescriptor !== null && secondaryHttp !== undefined
            && secondaryHttp.policy !== null && secondaryHttp.policy !== undefined) {
            // Port-kind secondary (no live adapter): full secondary port from
            // the secondary row; rows/companions/covers validate against the
            // secondary policy below.
            const claim = { jobId: request.jobId, worker: request.claimWorker,
              leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
            const hooks2 = calls.createPortHooks(lookupId, attemptId,
              { adapterKey: secondaryDescriptor.adapterKey,
                adapterVersion: secondaryDescriptor.adapterVersion });
            const port2 = createProviderHttpPort({
              adapterKey: secondaryDescriptor.adapterKey,
              adapterVersion: secondaryDescriptor.adapterVersion,
              policy: secondaryHttp.policy, maxGets: secondaryDescriptor.protocol.maxGets,
              timeoutMs: secondaryHttp.timeoutMs, maxResponseBytes: secondaryHttp.maxResponseBytes,
              fetcher: secondaryHttp.fetcher, lookupId, attemptId, claim,
              retentionPolicyVersion: secondaryHttp.retentionPolicyVersion,
              providerContact: secondaryHttp.providerContact ?? null,
              beforeRequest: async (call) => hooks2.beforeRequest(call),
              afterRequest: async (callId, settled) => hooks2.afterRequest(callId,
                { outcome: settled.outcome, retryable: settled.retryable,
                  physicalStatus: settled.status, egressStarted: settled.egressStarted }),
              requestHosts: secondaryHttp.requestHosts,
              requestValidator: secondaryHttp.requestValidator,
              sharedProtection: secondaryHttp.sharedProtection,
            });
            const secondaryResult = await secondaryDescriptor.invoke({ query: request.query,
              correlationId: lookupId, attemptId, signal, purpose: 'edition_options', http: port2 });
            provider = {
              outcome: secondaryResult.outcome.outcome as EditionOptionsProviderResult['outcome'],
              retryable: secondaryResult.outcome.retryable,
              rows: secondaryResult.rows === null ? [] : [...secondaryResult.rows],
              fetchedAt: secondaryResult.retention?.sourceFetchedAt ?? null,
              retentionEvidence: secondaryResult.retention === null ? null : {
                storagePermissionVerified: true as const,
                permittedDeadlineAt: secondaryResult.retention.permittedDeadlineAt,
              },
              providerRequestId: secondaryResult.outcome.providerRequestId,
              catalogueCompanions: secondaryResult.catalogueCompanions === null
                ? undefined : [...secondaryResult.catalogueCompanions],
            };
            expectedAdapterKey = secondaryDescriptor.adapterKey;
            hostPolicy = secondaryHttp.rowHostPolicy ?? undefined;
          }
        } catch (error) {
          // U6 fix1 (F7/Muse-minor): secondary lookup failures keep denial
          // identity and terminate; no further fallback, no generic retry.
          if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
          const mapped = denialFail(error);
          if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
          return await fail('provider_unavailable', true);
        }
      }
    }
    if (provider.retryable) return await fail(provider.outcome, true);
    if (provider.fetchedAt === null && provider.rows.length === 0) return await fail(provider.outcome, false);
    const expiresAt = provider.fetchedAt && provider.retentionEvidence
      ? resolveOptionsDeadline(provider.fetchedAt, provider.retentionEvidence) : null;
    if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return await fail('policy_denied', false);
    if (!Array.isArray(provider.rows) || provider.rows.length > 10) return await fail('schema_invalid', false);
    try {
      const ids = new Set<string>();
      for (const [ordinal, row] of provider.rows.entries()) {
        projectStoredEditionRow(row);
        if (row.ordinal !== ordinal || ids.has(row.optionId)
          || Object.keys(row).some(key => !['optionId','ordinal','googleBooksUrl','eligibility','metadata'].includes(key))) {
          throw new Error('P9_EDITION_ROWS_INVALID');
        }
        ids.add(row.optionId);
        if (row.metadata !== null) {
          const metadata = parseNormalizedMetadataEdition(row.metadata, hostPolicy);
          if (metadata.adapterKey !== expectedAdapterKey
            || metadata.correlationId !== lookupId || metadata.attemptId !== attemptId
            || fetchedAtMicros(metadata.fetchedAt) !== fetchedAtMicros(provider.fetchedAt!)) throw new Error('P9_EDITION_ROWS_INVALID');
        }
      }
    } catch {
      return await fail('schema_invalid', false);
    }
    const completion = await boundary.complete({
      ...fence, lookupId, attemptId, sourceFetchedAt: provider.fetchedAt!,
      optionsExpiresAt: expiresAt, storagePermissionVerified: true, rows: provider.rows,
      catalogueCompanions: provider.catalogueCompanions,
    });
    return completionResult(completion) ?? await fail('provider_unavailable', true);
  } catch (error) {
    if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) return { outcome: 'stale_claim' };
    // A committed transaction may lose its response. Recover its slim receipt before scheduling retry.
    try {
      const recovered = completionResult(await boundary.recover(fence));
      if (recovered) return recovered;
      if (recoveryOnly) return await fail('provider_unavailable', false);
    } catch { /* Missing/unavailable recovery cannot manufacture a saved response. */ }
    // 02b sections 7.1/10: uncertainty/outage stays recovery-only, never a provider retry.
    // Claims still use the existing DB attempt budget; this port cannot defer it neutrally.
    if (error instanceof EditionOptionsCompletionUncertainError || recoveryOnly) return { outcome: 'manual_metadata_required' };
    if (error instanceof Error && ['P9_EDITION_ROWS_INVALID','P9_CATALOGUE_COMPANIONS_INVALID'].includes(error.message)) {
      return await fail('schema_invalid', false);
    }
    // U6 fix1 (F7): pauses, typed denials and configuration failures
    // terminate; completion-phase P9_ errors keep their pinned recovery
    // (retryable) semantics — see outerDenialFail.
    const mapped = outerDenialFail(error);
    if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
    return await fail('provider_unavailable', true);
  }
}
