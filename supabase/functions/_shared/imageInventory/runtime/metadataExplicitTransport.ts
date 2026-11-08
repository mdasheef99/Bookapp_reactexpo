import type { EditionOptionsAdapter } from './metadataEditionOptions';
import { getOpenLibraryJson } from '../metadata/openLibrary/transport';
import type { OpenLibraryRequestPermit } from '../metadata/openLibrary/transport';
import type { ProviderHttpPort } from '../metadata/providerDescriptor';
import { createProviderHttpPort } from '../metadata/providerHttp';
type TransportBinding = {
  fetcher: (
    input: string | URL | Request, init?: RequestInit,
  ) => Promise<Response>;
  timeoutMs: number;
  maxResponseBytes: number;
  acquireLimiter: (signal: AbortSignal) => Promise<(egressStarted: boolean) => void>;
};

export function transportBindingOf(adapter: EditionOptionsAdapter): TransportBinding | null {
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

