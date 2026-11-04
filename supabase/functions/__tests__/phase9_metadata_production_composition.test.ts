import {
  decideMetadataProductionPolicy,
} from '../_shared/imageInventory/runtime/metadataProductionComposition';
import { completedReceipt, automaticDependencies, workerEnvironment, JOB_ID, CANDIDATE_ID } from './support/automaticWorker';
import { worker as fixtureWorkerId } from './fixtures/phase9/editionOptionsWorker';
import { bootstrapGoogle, observedInstalledManifest, runDescriptorWorker, testProviderManifest } from './support/providerModules';
import { GOLDEN_ATTEMPT_ID, GOLDEN_CLOCK, GOLDEN_LOOKUP_ID, GOOGLE_AUTOMATIC_V1 } from './fixtures/phase9/providerReplacementGoldens';
import { failClosedMetadataProviderOutcome } from '../_shared/imageInventory/metadata/providerAdapter';
import { GOOGLE_BOOKS_PROVIDER_VALIDATION } from '../_shared/imageInventory/metadata/googleBooks/validation';

const basePolicy = {
  enabled: true,
  adapterVersionCompatible: true,
  capabilityVersionCompatible: true,
  matchingAllowed: true,
  storageAllowed: true,
  reuseAllowed: true,
  pricingPolicyCompatible: true,
};

// The pure policy matrix always runs: it does not depend on any worker entry,
// only on the policy export imported above.
const selectedCompletions = (subject: ReturnType<typeof automaticDependencies>) =>
  subject.fixture.calls.filter(call => call.name === 'phase9_complete_automatic_metadata_v1'
    && call.parameters.p_command.result.outcome.selected !== null);

describe('Phase 9 metadata production policy', () => {
  it('derives independent matching, reuse, storage, and cache-write decisions', () => {
    expect(decideMetadataProductionPolicy({
      ...basePolicy,
      reuseAllowed: false,
    })).toEqual({
      allowCacheRead: false,
      allowFollowerReuse: false,
      allowFreshProviderCall: true,
      allowPositiveRetention: true,
      allowCacheWrite: false,
      requiredDegradationOutcome: 'policy_denied',
    });
    expect(decideMetadataProductionPolicy({
      ...basePolicy,
      matchingAllowed: false,
    })).toEqual(expect.objectContaining({
      allowCacheRead: true,
      allowFollowerReuse: true,
      allowFreshProviderCall: false,
      allowPositiveRetention: true,
      allowCacheWrite: true,
    }));
    expect(decideMetadataProductionPolicy({
      ...basePolicy,
      storageAllowed: false,
    })).toEqual(expect.objectContaining({
      allowCacheRead: true,
      allowFollowerReuse: true,
      allowFreshProviderCall: true,
      allowPositiveRetention: false,
      allowCacheWrite: true,
    }));
  });
});

// Stable worker-level behaviour controls. Every control drives the worker
// through the supported seams (support/automaticWorker.ts for the runnable
// worker + RPC mocks, support/providerModules.ts for the installed-manifest
// observer and the Google bootstrap used to inject a stub adapter) and asserts
// observable results and RPC effects. No control depends on the legacy
// exported composition or gateway call shape; no such import remains, so a
// missing legacy export neither passes vacuously nor turns red.
describe('Phase 9 8b worker behaviour for pre-8b controls (stable seam)', () => {
  const emptyItemsFetcher = async () => new Response(JSON.stringify({
    kind: 'books#volumes', totalItems: 0, items: [],
  }), { headers: { 'content-type': 'application/json' } });
  const callsNamed = (subject: ReturnType<typeof automaticDependencies>, name: string) =>
    subject.fixture.calls.filter(call => call.name === name);
  // A stub primary lets worker-level tests feed the exact malformed/hostile
  // provider shapes the old gateway mocks injected, without touching
  // production: the real Google validation still owns fail-closed. The stub
  // bypasses the counting fetcher, so each stub test also asserts the stub
  // was invoked exactly once to prove the zero-GET result is exercised
  // rather than vacuous.
  const stubProduction = (lookupResult: unknown) => {
    let invocations = 0;
    const production = bootstrapGoogle(workerEnvironment, emptyItemsFetcher);
    (production.primary as unknown as { lookup: () => Promise<unknown> }).lookup =
      async (input: any) => { invocations += 1;
        input.observeAutomaticHttp?.({ kind: 'send_started', at: Date.now() });
        input.observeAutomaticHttp?.({ kind: 'response_received', at: Date.now(), status: 200, retryAfter: null });
        return lookupResult; };
    return { production, invoked: () => invocations };
  };

  it('completes a compatible cache hit through the worker without provider egress', async () => {
    const subject = automaticDependencies({
      rpc: async (name: string) => {
        if (name === 'phase9_metadata_cache_reuse_context') {
          return { data: { leaderLookupId: GOLDEN_LOOKUP_ID, normalizedOutcome: 'coherent_match' }, error: null };
        }
        if (name === 'phase9_complete_metadata_cache_reuse') {
          return { data: { normalized_outcome: 'coherent_match' }, error: null };
        }
        return undefined;
      },
    });
    const result = await subject.run();
    expect(result.results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(subject.gets()).toBe(0);
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).toContain('phase9_metadata_cache_reuse_context');
    expect(names).toContain('phase9_complete_metadata_cache_reuse');
    expect(callsNamed(subject, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    expect(callsNamed(subject, 'phase9_reserve_metadata_usage')).toHaveLength(0);
  });

  it('completes a non-positive cache hit as manual without provider egress (positive control: coherent hit is accepted)', async () => {
    const hit = (normalizedOutcome: string) => automaticDependencies({
      rpc: async (name: string) => {
        if (name === 'phase9_metadata_cache_reuse_context') {
          return { data: { leaderLookupId: GOLDEN_LOOKUP_ID, normalizedOutcome }, error: null };
        }
        if (name === 'phase9_complete_metadata_cache_reuse') {
          return { data: { normalized_outcome: normalizedOutcome }, error: null };
        }
        return undefined;
      },
    });
    const negative = hit('no_acceptable_match');
    expect((await negative.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(negative.gets()).toBe(0);
    expect(callsNamed(negative, 'phase9_complete_metadata_cache_reuse')).toHaveLength(1);
    expect(callsNamed(negative, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    expect(callsNamed(negative, 'phase9_reserve_metadata_usage')).toHaveLength(0);
    // Positive control differs only in the cached outcome.
    const positive = hit('coherent_match');
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(0);
  });

  it('coalesces a follower through the worker without duplicate charge', async () => {
    const seenGets: Array<{ url?: URL; stage?: string; sequence?: number }> = [];
    const installed = observedInstalledManifest(testProviderManifest(), call => { seenGets.push(call); });
    const subject = automaticDependencies({
      rpc: async (name: string) => {
        if (name === 'phase9_prepare_automatic_metadata_v1') {
          return { data: { admission: null, coalescing: { mode: 'follower', leaderLookupId: GOLDEN_LOOKUP_ID } }, error: null };
        }
        return undefined;
      },
    });
    const result = await runDescriptorWorker(subject.dependencies, installed);
    expect(result.results).toEqual([{ outcome: 'coalesced_follower' }]);
    expect(subject.gets()).toBe(0);
    expect(seenGets).toEqual([]);
    expect(callsNamed(subject, 'phase9_register_structural_metadata_lookup').length).toBeGreaterThan(0);
    expect(callsNamed(subject, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    // completeReuse ignores the follower decision args: registerFollower
    // forwards only (request, leader) (metadataProductionGateway.ts:135-143).
    expect(callsNamed(subject, 'phase9_reserve_metadata_usage')).toHaveLength(0);
  });

  it('resolves a local canonical match with zero provider effects (positive control: no local match does a fresh GET)', async () => {
    const local = automaticDependencies({
      context: { localCanonicalEditionId: 'local-winner' },
    });
    expect((await local.run()).results).toEqual([{ outcome: 'local_canonical_match' }]);
    expect(local.gets()).toBe(0);
    expect(local.command()).toBeNull();
    // The local short-circuit returns before any cache/coalescing/lineage
    // work (metadataProductionComposition.ts: local check precedes cache).
    expect(callsNamed(local, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    expect(callsNamed(local, 'phase9_register_structural_metadata_lookup')).toHaveLength(0);
    expect(callsNamed(local, 'phase9_metadata_cache_reuse_context')).toHaveLength(0);
    expect(callsNamed(local, 'phase9_metadata_coalescing_context')).toHaveLength(0);
    expect(callsNamed(local, 'phase9_reserve_metadata_usage')).toHaveLength(0);
    expect(callsNamed(local, 'phase9_register_structural_metadata_attempt')).toHaveLength(0);
    // Positive control differs only in the local match.
    const fresh = automaticDependencies();
    expect((await fresh.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(fresh.gets()).toBe(1);
  });

  it('skips reuse but preserves fresh matching, fencing and snapshot retention', async () => {
    const subject = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: true, storageAllowed: true, reuseAllowed: false, policyVersion: 1,
        }],
      },
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(subject.gets()).toBe(1);
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).not.toContain('phase9_metadata_cache_reuse_context');
    expect(names).not.toContain('phase9_metadata_coalescing_context');
    expect(callsNamed(subject, 'phase9_register_metadata_provider_call')).toHaveLength(1);
    expect(selectedCompletions(subject)).toHaveLength(1);
    expect(names).not.toContain('phase9_store_metadata_cache');
    // The selection persists the accepted edition with its match evidence
    // (metadataProductionGateway.ts:296-309).
    const select = subject.fixture.calls.find(call => call.name === 'phase9_complete_automatic_metadata_v1');
    expect(select?.parameters.p_command.result.outcome.selected).toEqual({
      ...GOOGLE_AUTOMATIC_V1.selected,
      fetchedAt: expect.any(String),
    });
    expect(select?.parameters.p_command.result.outcome.evidence).toEqual(GOOGLE_AUTOMATIC_V1.evidence);
    // Positive control differs only in reuseAllowed: the default reuses the
    // cache/coalescing boundary and persists the selected snapshot to cache.
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.fixture.calls.map(call => call.name)).toContain('phase9_metadata_cache_reuse_context');
    expect(callsNamed(positive, 'phase9_store_metadata_cache')).toHaveLength(1);
  });

  it('permits compatible cache reuse under matching denial with zero fresh calls', async () => {
    const denied = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: false, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
        }],
      },
      rpc: async (name: string) => {
        if (name === 'phase9_metadata_cache_reuse_context') {
          return { data: { leaderLookupId: GOLDEN_LOOKUP_ID, normalizedOutcome: 'coherent_match' }, error: null };
        }
        if (name === 'phase9_complete_metadata_cache_reuse') {
          return { data: { normalized_outcome: 'coherent_match' }, error: null };
        }
        return undefined;
      },
    });
    expect((await denied.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(denied.gets()).toBe(0);
    expect(callsNamed(denied, 'phase9_complete_metadata_cache_reuse')).toHaveLength(1);
    expect(callsNamed(denied, 'phase9_register_structural_metadata_lookup')).toHaveLength(0);
    expect(callsNamed(denied, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    expect(callsNamed(denied, 'phase9_reserve_metadata_usage')).toHaveLength(0);
    // Positive control differs only in matchingAllowed: same hit, same
    // accepted outcome, still zero fresh calls.
    const allowed = automaticDependencies({
      rpc: async (name: string) => {
        if (name === 'phase9_metadata_cache_reuse_context') {
          return { data: { leaderLookupId: GOLDEN_LOOKUP_ID, normalizedOutcome: 'coherent_match' }, error: null };
        }
        if (name === 'phase9_complete_metadata_cache_reuse') {
          return { data: { normalized_outcome: 'coherent_match' }, error: null };
        }
        return undefined;
      },
    });
    expect((await allowed.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(allowed.gets()).toBe(0);
  });

  it('denies a fresh call after a cache miss when matching is denied (positive control: matching allowed does fresh work)', async () => {
    const denied = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: false, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
        }],
      },
    });
    expect((await denied.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(denied.gets()).toBe(0);
    expect(callsNamed(denied, 'phase9_register_structural_metadata_lookup')).toHaveLength(0);
    expect(callsNamed(denied, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    const fail = denied.fixture.calls.find(call => call.name === 'phase9_fail_metadata_job');
    expect(fail?.parameters).toMatchObject({ p_failure_kind: 'policy_denied', p_retryable: false });
    // Positive control differs only in matchingAllowed.
    const allowed = automaticDependencies();
    expect((await allowed.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(allowed.gets()).toBe(1);
  });

  it('denies fresh calls when matching, reuse and storage are all denied', async () => {
    const subject = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: false, storageAllowed: false, reuseAllowed: false, policyVersion: 1,
        }],
      },
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    expect(callsNamed(subject, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    const fail = subject.fixture.calls.find(call => call.name === 'phase9_fail_metadata_job');
    expect(fail?.parameters).toMatchObject({ p_failure_kind: 'policy_denied', p_retryable: false });
    // Positive control differs only in the three flags: all allowed completes
    // accepted with a fresh provider call.
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });

  it('registers durable lineage and revalidates the fence before provider egress', async () => {
    const subject = automaticDependencies({ fetcher: emptyItemsFetcher });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    const order = subject.fixture.calls.map(call => call.name);
    const indexOf = (name: string) => order.indexOf(name);
    // The coalescing leader reserves the lookup, so no separate lookup
    // registration RPC is issued on the fresh path; lineage runs
    // reserve -> attempt -> grant -> physical finalize -> attempt finalize.
    expect(indexOf('phase9_prepare_automatic_metadata_v1')).toBeGreaterThanOrEqual(0);
    expect(indexOf('phase9_reserve_metadata_usage')).toBeGreaterThan(indexOf('phase9_prepare_automatic_metadata_v1'));
    expect(indexOf('phase9_register_structural_metadata_attempt')).toBeGreaterThan(indexOf('phase9_reserve_metadata_usage'));
    expect(indexOf('phase9_register_metadata_provider_call')).toBeGreaterThan(indexOf('phase9_register_structural_metadata_attempt'));
    expect(indexOf('phase9_finalize_metadata_provider_call')).toBeGreaterThan(indexOf('phase9_register_metadata_provider_call'));
    expect(indexOf('phase9_complete_automatic_metadata_v1')).toBeGreaterThan(indexOf('phase9_finalize_metadata_provider_call'));
    expect(indexOf('phase9_finalize_structural_metadata_attempt')).toBe(-1);
    expect(callsNamed(subject, 'phase9_complete_automatic_metadata_v1')).toHaveLength(1);
    expect(callsNamed(subject, 'phase9_fail_metadata_job')).toHaveLength(0);
    expect(callsNamed(subject, 'phase9_store_metadata_cache')).toHaveLength(1);
    // Positive control differs only in the provider result: coherent success
    // persists a selection and never fails the job.
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(selectedCompletions(positive)).toHaveLength(1);
    expect(callsNamed(positive, 'phase9_fail_metadata_job')).toHaveLength(0);
  });

  // Mutation caught: scheduling retry in fetch or retrying an unproved send.
  it('reports the received-failure retry chosen by M93 and keeps unknown sends recovery-only', async () => {
    const retrying = automaticDependencies({ fetcher: async () => new Response('', { status: 503 }),
      rpc: async name => name === 'phase9_finish_automatic_provider_run_v1'
        ? { data: { status: 'retry_scheduled', round: 0, dueAt: new Date().toISOString() }, error: null } : undefined });
    expect((await retrying.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(retrying.gets()).toBe(1);
    expect(callsNamed(retrying, 'phase9_finish_automatic_provider_run_v1')).toHaveLength(1);
    expect(callsNamed(retrying, 'phase9_fail_metadata_job')).toHaveLength(0);
    const unknown = automaticDependencies({ fetcher: async () => { throw new Error('unknown send'); },
      rpc: async name => name === 'phase9_finish_automatic_provider_run_v1'
        ? { data: { status: 'recovery_only' }, error: null } : undefined });
    expect((await unknown.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(unknown.gets()).toBe(1);
    expect(callsNamed(unknown, 'phase9_finalize_metadata_provider_call')[0].parameters.p_status).toBe('outcome_unknown');
    expect(unknown.command()).toBeNull();
  });

  it('makes zero provider calls after stale claim rejection (positive control: valid claim does fresh work)', async () => {
    let jobContextCalls = 0;
    let current: () => Record<string, unknown> = () => ({});
    const subject = automaticDependencies({
      rpc: async (name: string) => {
        if (name === 'phase9_metadata_job_context') {
          jobContextCalls += 1;
          if (jobContextCalls === 4) {
            return {
              data: { ...current(), candidateId: '00000000-0000-4000-8000-000000000099' },
              error: null,
            };
          }
        }
        return undefined;
      },
    });
    current = subject.fixture.current as () => Record<string, unknown>;
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    expect(selectedCompletions(subject)).toHaveLength(0);
    // The stale fence writes the durable stale finalization before returning:
    // physical p_status 'stale_rejected' and attempt p_disposition 'stale'
    // with the production-written policy_denied outcome
    // (metadataAttemptFinalization.ts:21,61-63).
    const physical = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(physical?.parameters).toMatchObject({ p_status: 'stale_rejected' });
    const attempt = subject.fixture.calls.find(call => call.name === 'phase9_finalize_structural_metadata_attempt');
    expect(attempt).toBeUndefined();
    expect(subject.command()).toBeNull();
    // Positive control differs only in fence validity.
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });

  it('persists one coherent accepted snapshot and never invokes a secondary', async () => {
    const subject = automaticDependencies();
    expect((await subject.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(subject.gets()).toBe(1);
    expect(selectedCompletions(subject)).toHaveLength(1);
    expect(callsNamed(subject, 'phase9_fail_metadata_job')).toHaveLength(0);
    expect(callsNamed(subject, 'phase9_register_metadata_provider_call')).toHaveLength(1);
    expect(callsNamed(subject, 'phase9_store_metadata_cache')).toHaveLength(1);
    // The selection persists the accepted edition with its match evidence
    // (metadataProductionGateway.ts:296-309).
    const select = subject.fixture.calls.find(call => call.name === 'phase9_complete_automatic_metadata_v1');
    expect(select?.parameters.p_command.result.outcome.selected).toEqual({
      ...GOOGLE_AUTOMATIC_V1.selected,
      fetchedAt: expect.any(String),
    });
    expect(select?.parameters.p_command.result.outcome.evidence).toEqual(GOOGLE_AUTOMATIC_V1.evidence);
    // Negative control differs only in storage: denial keeps the same fresh
    // call but persists nothing and stays manual.
    const denied = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: true, storageAllowed: false, reuseAllowed: true, policyVersion: 1,
        }],
      },
    });
    expect((await denied.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(denied.gets()).toBe(1);
    expect(selectedCompletions(denied)).toHaveLength(0);
  });

  // Mutation caught: writing cover/selection separately or caching an unconfirmed transaction.
  it('carries cover and selection atomically and refuses unconfirmed completion', async () => {
    const alternateFetcher = async () => new Response(JSON.stringify({
      kind: 'books#volumes', totalItems: 2, items: [
        { id: 'winner', volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'],
          language: 'en', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } },
        { id: 'alternate', volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'],
          language: 'en', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=alternate' } } },
      ],
    }), { headers: { 'content-type': 'application/json' } });
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const failing = automaticDependencies({ fetcher: alternateFetcher,
        rpc: async name => name === 'phase9_complete_automatic_metadata_v1'
          ? { data: null, error: { message: 'https://token:secret@example.invalid/private-cover?signature=redact-me' } } : undefined });
      expect((await failing.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
      expect(failing.command()!.result.outcome.representativeCover).toMatchObject({
        sourceProviderRecordId: 'alternate', coverReference: 'https://books.google.com/books/content?id=alternate',
        sourceRelation: 'representative_edition', selectionPolicyVersion: 'p9-representative-cover-v1',
        matchEvidence: ['exact_title', 'exact_author_set', 'language_compatible'],
      });
      expect(callsNamed(failing, 'phase9_store_metadata_representative_cover_v1')).toHaveLength(0);
      expect(callsNamed(failing, 'phase9_select_structural_metadata_snapshot')).toHaveLength(0);
      expect(callsNamed(failing, 'phase9_store_metadata_cache')).toHaveLength(0);
      expect(warning).not.toHaveBeenCalled();
      expect(JSON.stringify(warning.mock.calls)).not.toContain('redact-me');
      const healthy = automaticDependencies({ fetcher: alternateFetcher });
      expect((await healthy.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
      expect(healthy.command()!.result.outcome.representativeCover).toEqual(failing.command()!.result.outcome.representativeCover);
      expect(selectedCompletions(healthy)).toHaveLength(1);
      expect(callsNamed(healthy, 'phase9_store_metadata_representative_cover_v1')).toHaveLength(0);
    } finally { warning.mockRestore(); }
  });

  it('recovers a durable atomic receipt without reconstructing metadata or another physical call', async () => {
    const subject = automaticDependencies({
      rpc: async name => name === 'phase9_recover_automatic_metadata_v1' ? { data: {
        version: 'p9-auto-completion-v1', status: 'replayed', lookupId: GOLDEN_LOOKUP_ID,
        snapshotId: '00000000-0000-4000-8000-000000000005', outcome: 'accepted_metadata_match', selectedOptionId: null,
        prefill: { status: 'skipped', reason: 'not_installed' },
      }, error: null } : undefined,
      context: {
        currentLookupId: GOLDEN_LOOKUP_ID,
        currentLookupAdapterKey: 'google_books',
        currentLookupAdapterVersion: '1.0.0',
        currentAttemptId: GOLDEN_ATTEMPT_ID,
        currentAttemptAdapterKey: 'google_books',
        currentAttemptDisposition: 'unresolved',
        currentAttemptOutcome: 'coherent_match',
        currentPhysicalStatus: 'finalized',
        currentPhysicalClaimAttempt: 1,
        currentPhysicalOutcome: 'coherent_match',
        currentPhysicalLogicalOutcome: 'coherent_match',
        currentPhysicalRetryable: false,
        currentPhysicalCandidate: { providerRecordId: 'resumed' },
        currentPhysicalEvidence: [],
        currentPhysicalProviderRequestId: null,
      },
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(subject.gets()).toBe(0);
    expect(callsNamed(subject, 'phase9_register_metadata_provider_call')).toHaveLength(0);
    expect(selectedCompletions(subject)).toHaveLength(0);
    expect(callsNamed(subject, 'phase9_recover_automatic_metadata_v1')).toHaveLength(1);
    // Positive control differs only in persisted evidence: a fresh job does a
    // physical GET and registers a new grant.
    const fresh = automaticDependencies();
    expect((await fresh.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(fresh.gets()).toBe(1);
    expect(callsNamed(fresh, 'phase9_register_metadata_provider_call')).toHaveLength(1);
  });

  it('does not strand a terminal accepted match when cache persistence fails', async () => {
    const failing = automaticDependencies({
      rpc: async (name: string) => name === 'phase9_store_metadata_cache'
        ? Promise.reject(new Error('cache unavailable')) : undefined,
    });
    expect((await failing.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(selectedCompletions(failing)).toHaveLength(1);
    expect(callsNamed(failing, 'phase9_store_metadata_cache')).toHaveLength(1);
    // The selection still carries the accepted edition even though the
    // follow-on cache write fails (metadataProductionGateway.ts:296-309).
    const failingSelect = failing.fixture.calls.find(call => call.name === 'phase9_complete_automatic_metadata_v1');
    expect(failingSelect?.parameters.p_command.result.outcome.selected).toEqual({
      ...GOOGLE_AUTOMATIC_V1.selected,
      fetchedAt: expect.any(String),
    });
    expect(failingSelect?.parameters.p_command.result.outcome.evidence).toEqual(GOOGLE_AUTOMATIC_V1.evidence);
    // Positive control differs only in cache-store health.
    const healthy = automaticDependencies();
    expect((await healthy.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(selectedCompletions(healthy)).toHaveLength(1);
  });

  it('fails closed when storage permission is absent', async () => {
    const subject = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: true, storageAllowed: false, reuseAllowed: true, policyVersion: 1,
        }],
      },
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).not.toContain('phase9_select_structural_metadata_snapshot');
    expect(names).not.toContain('phase9_store_metadata_cache');
    // Production finalizes the storage-denied accepted outcome as rejected
    // with the policy_denied logical outcome and no retained candidate, and
    // fails the job the same way
    // (metadataProductionComposition.ts:254-266, metadataAttemptFinalization.ts:27-30,63-67).
    const physical = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(physical?.parameters).toMatchObject({
      p_normalized_outcome: 'coherent_match',
      p_logical_outcome: 'policy_denied',
      p_normalized_candidate: null,
      p_retryable: false,
    });
    const attempt = subject.fixture.calls.find(call => call.name === 'phase9_finalize_structural_metadata_attempt');
    expect(attempt).toBeUndefined();
    expect(subject.command()?.result.outcome).toMatchObject({ outcome: 'policy_denied', selected: null, retryable: false });
    const fail = subject.fixture.calls.find(call => call.name === 'phase9_fail_metadata_job');
    expect(fail).toBeUndefined();
    expect(subject.command()?.result.outcome).toMatchObject({ outcome: 'policy_denied', selected: null, retryable: false });
    // Positive control differs only in storageAllowed (see the accepted
    // snapshot test above, which persists a selection with storage allowed).
  });

  it.each([
    { outcome: 'coherent_match', selected: null, candidates: [] },
    { outcome: 'no_acceptable_match', selected: { providerRecordId: 'bad', attemptId: 'attempt-1' }, candidates: [] },
    { outcome: 'coherent_match', selected: {}, candidates: [{}] },
  ])('fails malformed provider outcome %p closed as schema_invalid (positive control: healthy provider is accepted)', async (malformed) => {
    const stub = stubProduction({
      ...malformed,
      evidence: [], retryable: false, secondaryEligible: true, providerRequestId: null,
    });
    const subject = automaticDependencies({
      production: stub.production,
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    expect(stub.invoked()).toBe(1);
    // The physical-call finalize keeps the normalized outcome; the structural
    // attempt finalize carries the canonicalized form.
    const physical = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(physical?.parameters).toMatchObject({
      p_normalized_outcome: 'schema_invalid',
      p_normalized_candidate: null,
      p_retryable: false,
    });
    const attempt = subject.fixture.calls.find(call => call.name === 'phase9_finalize_structural_metadata_attempt');
    expect(attempt).toBeUndefined();
    expect(subject.command()?.result.outcome.outcome).toBe('schema_invalid');
    expect(selectedCompletions(subject)).toHaveLength(0);
    // Positive control differs only in provider health: the real adapter with
    // the standard fixture returns an accepted coherent match (see the
    // accepted snapshot test above).
  });

  it.each([null, {}, { outcome: 'unknown', candidates: [], selected: null,
    evidence: [], retryable: false, secondaryEligible: false, providerRequestId: null },
  ])('normalizes hostile provider value %p to non-retryable schema_invalid', async (value) => {
    const stub = stubProduction(value);
    const subject = automaticDependencies({ production: stub.production });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    expect(stub.invoked()).toBe(1);
    const physical = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(physical?.parameters).toMatchObject({
      p_normalized_outcome: 'schema_invalid',
      p_normalized_candidate: null,
      p_retryable: false,
    });
    expect(selectedCompletions(subject)).toHaveLength(0);
    // Positive control differs only in provider health (see the accepted
    // snapshot test above).
  });

  it('normalizes a retryable coherent provider outcome to non-retryable schema_invalid', async () => {
    const stub = stubProduction({
      outcome: 'coherent_match', candidates: [{ providerRecordId: 'v', attemptId: 'a' }],
      selected: { providerRecordId: 'v', attemptId: 'a' }, evidence: [], retryable: true,
      secondaryEligible: false, providerRequestId: null,
    });
    const subject = automaticDependencies({
      production: stub.production,
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    expect(stub.invoked()).toBe(1);
    const physical = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(physical?.parameters).toMatchObject({
      p_normalized_outcome: 'schema_invalid',
      p_normalized_candidate: null,
      p_retryable: false,
    });
    expect(selectedCompletions(subject)).toHaveLength(0);
    // Positive control differs only in provider health: the real adapter with
    // the standard fixture returns an accepted coherent match (see the
    // accepted snapshot test above).
  });

  it('normalizes an unsafe provider request id to non-retryable schema_invalid', async () => {
    const shape = (providerRequestId: string | null) => {
      const stub = stubProduction({
        outcome: 'timeout', candidates: [], selected: null, evidence: [], retryable: true,
        secondaryEligible: true, providerRequestId,
      });
      return stub;
    };
    const unsafe = shape('unsafe request id');
    const subject = automaticDependencies({ production: unsafe.production });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    expect(unsafe.invoked()).toBe(1);
    const physical = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(physical?.parameters).toMatchObject({
      p_normalized_outcome: 'schema_invalid',
      p_normalized_candidate: null,
      p_retryable: false,
    });
    expect(selectedCompletions(subject)).toHaveLength(0);
    // Positive control differs only in request-id safety.
    const safeStub = shape(null);
    const safe = automaticDependencies({ production: safeStub.production });
    expect((await safe.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(safe.gets()).toBe(0);
    expect(safeStub.invoked()).toBe(1);
    const safePhysical = safe.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(safePhysical?.parameters).toMatchObject({
      p_normalized_outcome: 'timeout',
      p_normalized_candidate: null,
      p_retryable: true,
    });
  });

  it('does not consume a positive cache hit when storage is denied and still permits fresh matching', async () => {
    const subject = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: true, storageAllowed: false, reuseAllowed: true, policyVersion: 1,
        }],
      },
      rpc: async (name: string) => {
        if (name === 'phase9_metadata_cache_reuse_context') {
          return { data: { leaderLookupId: GOLDEN_LOOKUP_ID, normalizedOutcome: 'coherent_match' }, error: null };
        }
        return undefined;
      },
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(1);
    expect(callsNamed(subject, 'phase9_complete_metadata_cache_reuse')).toHaveLength(0);
    expect(selectedCompletions(subject)).toHaveLength(0);
    expect(callsNamed(subject, 'phase9_store_metadata_cache')).toHaveLength(0);
    // Same storage-denied finalization as the storage test above: the fresh
    // coherent outcome is rejected with the policy_denied logical outcome and
    // the job fails the same way.
    const physical = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(physical?.parameters).toMatchObject({
      p_normalized_outcome: 'coherent_match',
      p_logical_outcome: 'policy_denied',
      p_normalized_candidate: null,
      p_retryable: false,
    });
    const attempt = subject.fixture.calls.find(call => call.name === 'phase9_finalize_structural_metadata_attempt');
    expect(attempt).toBeUndefined();
    expect(subject.command()?.result.outcome).toMatchObject({ outcome: 'policy_denied', selected: null, retryable: false });
    const fail = subject.fixture.calls.find(call => call.name === 'phase9_fail_metadata_job');
    expect(fail).toBeUndefined();
    expect(subject.command()?.result.outcome).toMatchObject({ outcome: 'policy_denied', selected: null, retryable: false });
    // Positive control differs only in storageAllowed: the same hit with
    // storage allowed completes from cache with zero fresh calls (see the
    // compatible cache hit test above).
  });

  it.each(['ambiguous_match', 'timeout'])(
    'degrades completed non-positive cache outcome %s to manual without fresh calls (positive control: storage allowed is also manual)',
    async (normalizedOutcome) => {
      const runWith = (storageAllowed: boolean) => automaticDependencies({
        context: {
          providerPolicies: [{
            adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
            matchingAllowed: true, storageAllowed, reuseAllowed: true, policyVersion: 1,
          }],
        },
        rpc: async (name: string) => {
          if (name === 'phase9_metadata_cache_reuse_context') {
            return { data: { leaderLookupId: GOLDEN_LOOKUP_ID, normalizedOutcome }, error: null };
          }
          if (name === 'phase9_complete_metadata_cache_reuse') {
            return { data: { normalized_outcome: normalizedOutcome }, error: null };
          }
          return undefined;
        },
      });
      const denied = runWith(false);
      expect((await denied.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
      expect(denied.gets()).toBe(0);
      expect(callsNamed(denied, 'phase9_complete_metadata_cache_reuse')).toHaveLength(1);
      expect(callsNamed(denied, 'phase9_register_metadata_provider_call')).toHaveLength(0);
      // Positive control differs only in storageAllowed.
      const allowed = runWith(true);
      expect((await allowed.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
      expect(allowed.gets()).toBe(0);
    },
  );

  it('allows a fresh call without reuse or storage but retains no positive output', async () => {
    const subject = automaticDependencies({
      context: {
        providerPolicies: [{
          adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
          matchingAllowed: true, storageAllowed: false, reuseAllowed: false, policyVersion: 1,
        }],
      },
    });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(1);
    const fail = subject.fixture.calls.find(call => call.name === 'phase9_fail_metadata_job');
    expect(fail).toBeUndefined();
    expect(subject.command()?.result.outcome).toMatchObject({ outcome: 'policy_denied', selected: null, retryable: false });
    expect(selectedCompletions(subject)).toHaveLength(0);
    expect(callsNamed(subject, 'phase9_store_metadata_cache')).toHaveLength(0);
    // Positive control differs only in reuse/storage: the default fresh run
    // with both allowed persists the accepted selection (see the accepted
    // snapshot test above).
  });

  it.todo('completes a positive follower with a coherent retained outcome as accepted (worker completeReuse always returns coalesced_follower; the mocked coherent registerFollower shape is not producible via phase9_register_structural_metadata_lookup)');
  it.todo('degrades a storage-denied follower via manual_degradation (worker completeReuse only returns completed/policy_denied; manual_degradation is not producible via RPCs)');
  it.todo('maps a rejected reuse completion to stale_claim via a stale_rejected completeCacheHit (gateway completeCacheHit only returns completed/policy_denied; stale arises via fence revalidation or stale disposition instead)');
});

// The 8b automatic entry is the runnable worker + M92 RPC (02c §§4.3/5.1).
describe('Phase 9 8b automatic completion transaction through the worker', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK)); });
  afterEach(() => jest.useRealTimers());

  it('commits a valid external automatic success through the transaction RPC', async () => {
    const subject = automaticDependencies();
    await expect(subject.run()).resolves.toMatchObject({ results: [{ outcome: 'accepted_metadata_match' }] });
    expect(subject.command()?.result).toEqual({
      version: 'p9-metadata-result-v2', purpose: 'automatic',
      outcome: GOOGLE_AUTOMATIC_V1, rows: null, catalogueCompanions: null, retention: null,
    });
    expect(subject.fixture.calls.filter(call => call.name === 'phase9_select_structural_metadata_snapshot'))
      .toEqual([]);
  });

  it('carries a valid representative cover and its alternate source inside the transaction', async () => {
    // Use the real Google decoder/ranker. The ISBN winner has no cover; its
    // same-identity alternate has a cover and weaker secondary evidence.
    const subject = automaticDependencies({ fetcher: async () => new Response(JSON.stringify({
      kind: 'books#volumes', totalItems: 2, items: [
        { id: 'winner', volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'],
          language: 'en', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } },
        { id: 'alternate', volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'],
          language: 'en', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=alternate' } } },
      ],
    }), { headers: { 'content-type': 'application/json' } }) });
    await expect(subject.run()).resolves.toMatchObject({ results: [{ outcome: 'accepted_metadata_match' }] });
    const outcome = subject.command()?.result.outcome;
    expect(outcome).toBeDefined();
    expect(outcome.representativeCover).toMatchObject({ sourceProviderRecordId: 'alternate' });
    expect(outcome.candidates).toEqual(expect.arrayContaining([expect.objectContaining({
      providerRecordId: 'alternate', coverReference: outcome.representativeCover.coverReference,
    })]));
    expect(failClosedMetadataProviderOutcome(outcome, {
      correlationId: subject.command()!.lookupId, attemptId: subject.command()!.attemptId,
      adapterKey: 'google_books', adapterVersion: '1.0.0',
      hostPolicy: GOOGLE_BOOKS_PROVIDER_VALIDATION.hostPolicy,
    })).toEqual(outcome);
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_representative_cover_v1');
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_select_structural_metadata_snapshot');
  });

  it('fails closed when the transaction RPC is unavailable after a valid provider result', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_complete_automatic_metadata_v1'
      ? { data: null, error: { message: 'fixture transaction unavailable' } } : undefined });
    const result = await subject.run();
    // This positive assertion prevents a legacy-parser schema rejection from
    // masquerading as transaction refusal.
    expect(subject.command()?.result.outcome).toEqual(GOOGLE_AUTOMATIC_V1);
    expect(result.results[0].outcome).not.toBe('accepted_metadata_match');
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).not.toContain('phase9_select_structural_metadata_snapshot');
    expect(names).not.toContain('phase9_store_metadata_cache');
    expect(names).not.toContain('phase9_store_metadata_representative_cover_v1');
  });
});
