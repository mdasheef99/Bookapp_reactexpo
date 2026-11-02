// 02c §§4.3/5.4/9 AC8-5: production worker + scripted M93 run receipts.
// SQL owns backoff/jitter and durable eligibility; these tests prove the worker
// forwards the safe floor and obeys the ledger instead of retrying in fetch.
// The actual M93 scheduling/exhaustion SQL is proven by the committed PGlite
// suite supabase/tests/phase9/phase9ProviderRunCompletion.integration.test.mjs.
import { automaticDependencies, CALL_ID } from './support/automaticWorker';
import { GOLDEN_CLOCK, GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID } from './fixtures/phase9/providerReplacementGoldens';
import { TEST_ONLY_PROTECTION_POLICY as policy } from './support/providerProtection';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';

const stamp = Date.parse(GOLDEN_CLOCK);
const finishes = (subject: ReturnType<typeof automaticDependencies>) =>
  subject.fixture.calls.filter(call => call.name === 'phase9_finish_automatic_provider_run_v1');
const grants = (subject: ReturnType<typeof automaticDependencies>) =>
  subject.fixture.calls.filter(call => call.name === 'phase9_register_metadata_provider_call');
describe('Phase 9 durable retry and recovery', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(stamp); });
  afterEach(() => jest.useRealTimers());

  it.each([
    ['120', stamp + 120000],
    ['Mon, 02 Nov 2026 12:01:00 GMT', stamp + 60000],
    // An expired HTTP date may safely be forwarded or normalised to null; both
    // leave M93's bounded step as the effective floor.
    ['Wed, 21 Oct 2015 07:28:00 GMT', stamp - 31782720000],
    ['not-a-date', null], ['-1', null], ['999999999999999999999999', null],
  ] as const)('passes safe Retry-After %s to the durable run ledger without depending on an exception shape', async (header, floor) => {
    const subject = automaticDependencies({ fetcher: async () => new Response('', {
      status: 429, headers: { 'retry-after': header },
    }), rpc: async (name: string) => name === 'phase9_finish_automatic_provider_run_v1' ? {
      // Fixed SQL-shaped receipt; the assertion never derives a due time from it.
      data: { status: 'retry_scheduled', round: 0,
        dueAt: new Date(stamp + policy.backoffBaseMs).toISOString() }, error: null,
    } : undefined });
    const result = await subject.run();
    const finish = finishes(subject);
    expect(subject.gets()).toBe(1);
    expect(finish).toHaveLength(1);
    expect(finish[0].parameters.p_key).toBe('google_books');
    expect(finish[0].parameters.p_version).toBe('1.0.0');
    expect(finish[0].parameters.f).toMatchObject({ claimAttempt: 1 });
    const forwarded = finish[0].parameters.p_not_before ?? null;
    if (floor === null || floor < stamp) {
      // Past/invalid headers must not move the persisted floor before now; M93
      // takes max(bounded step, floor) either way.
      expect(forwarded === null || Date.parse(forwarded) <= stamp).toBe(true);
    } else {
      expect(Date.parse(forwarded)).toBe(floor);
    }
    expect(result.results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(subject.command()).toBeNull();
  });

  it('schedules once per claim, replays without another attempt and stops at durable exhaustion', async () => {
    let phase: 'first' | 'same-claim' | 'early-reclaim' | 'retry' | 'exhausted' = 'first';
    const beginReceipts = {
      first: { status: 'started', round: 0 },
      'same-claim': { status: 'replayed', round: 0, runStatus: 'finalized' },
      'early-reclaim': { status: 'recovery_only' },
      retry: { status: 'started', round: 1 },
      exhausted: { status: 'recovery_only' },
    };
    const subject = automaticDependencies({ fetcher: async () => new Response('', { status: 503 }),
      rpc: async (name: string) => {
        if (name === 'phase9_begin_automatic_provider_run_v1') return { data: beginReceipts[phase], error: null };
        if (name === 'phase9_finish_automatic_provider_run_v1') {
          if (phase === 'first' || phase === 'same-claim') {
            return { data: { status: 'retry_scheduled', round: 0,
              dueAt: new Date(stamp + policy.backoffBaseMs).toISOString() }, error: null };
          }
          return { data: { status: 'finalized', round: 1 }, error: null };
        }
        if (name === 'phase9_complete_automatic_metadata_v1') return { data: {
          version: 'p9-auto-completion-v1', status: 'completed', lookupId: GOLDEN_LOOKUP_ID,
          snapshotId: '00000000-0000-4000-8000-000000000005', outcome: 'technical_failure',
          selectedOptionId: null, prefill: { status: 'skipped', reason: 'not_installed' },
        }, error: null };
        return undefined;
      } });
    await subject.run(); expect(subject.gets()).toBe(1);
    expect(finishes(subject)).toHaveLength(1);
    expect(grants(subject)).toHaveLength(1);
    phase = 'same-claim'; await subject.run(); expect(subject.gets()).toBe(1);
    // Same claim replays the durable receipt; it must not schedule again.
    expect(finishes(subject)).toHaveLength(1);
    expect(grants(subject)).toHaveLength(1);
    phase = 'early-reclaim';
    Object.assign(subject.fixture.current(), { attempt: 2, claimToken: 'b'.repeat(64),
      currentLookupId: GOLDEN_LOOKUP_ID, currentLookupAdapterKey: 'google_books', currentLookupAdapterVersion: '1.0.0',
      currentAttemptId: GOLDEN_ATTEMPT_ID, currentAttemptAdapterKey: 'google_books',
      currentAttemptDisposition: 'unresolved', currentAttemptOutcome: null,
      currentPhysicalStatus: 'finalized', currentPhysicalClaimAttempt: 1,
      currentPhysicalOutcome: 'provider_unavailable', currentPhysicalLogicalOutcome: 'provider_unavailable',
      currentPhysicalRetryable: true, currentPhysicalCandidate: null, currentPhysicalEvidence: [],
      currentPhysicalProviderRequestId: null,
    });
    await subject.run(); expect(subject.gets()).toBe(1);
    expect(finishes(subject)).toHaveLength(1);
    expect(grants(subject)).toHaveLength(1);
    phase = 'retry';
    // The retry claim is only eligible after the ledger's safe due time.
    jest.setSystemTime(stamp + policy.backoffMaxMs + 60000);
    await subject.run(); expect(subject.gets()).toBe(2);
    expect(finishes(subject)).toHaveLength(2);
    expect(grants(subject)).toHaveLength(2);
    phase = 'exhausted';
    Object.assign(subject.fixture.current(), { attempt: 5, claimToken: 'e'.repeat(64), currentPhysicalClaimAttempt: 2 });
    const exhausted = await subject.run();
    // M93 returns recovery_only/finalized; no further retry or provider attempt.
    expect(subject.gets()).toBe(2);
    expect(finishes(subject)).toHaveLength(2);
    expect(grants(subject)).toHaveLength(2);
    expect(exhausted.results[0].outcome).not.toBe('retry_scheduled');
    expect(grants(subject).map(call => call.parameters.p_attempt_count)).toEqual([1, 2]);
    // Same logical lineage across the only two allowed physical rounds.
    expect(new Set(grants(subject).map(call => call.parameters.p_attempt_id))).toEqual(new Set([GOLDEN_ATTEMPT_ID]));
  });

  it('recovers uncertain egress on reclaim without a retry allowance or another GET', async () => {
    const subject = automaticDependencies({ fetcher: async () => { throw new Error('fixture reset after send'); },
      rpc: async (name: string) => name === 'phase9_finish_automatic_provider_run_v1'
        ? { data: { status: 'recovery_only' }, error: null } : undefined });
    await subject.run(); expect(subject.gets()).toBe(1);
    const final = subject.fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(final?.parameters).toMatchObject({ p_provider_call_id: CALL_ID, p_status: 'outcome_unknown' });
    Object.assign(subject.fixture.current(), { attempt: 2, claimToken: 'b'.repeat(64),
      currentLookupId: GOLDEN_LOOKUP_ID, currentLookupAdapterKey: 'google_books', currentLookupAdapterVersion: '1.0.0',
      currentAttemptId: GOLDEN_ATTEMPT_ID, currentAttemptAdapterKey: 'google_books',
      currentAttemptDisposition: 'unresolved', currentPhysicalStatus: 'outcome_unknown', currentPhysicalClaimAttempt: 1,
      currentPhysicalOutcome: 'network_failure', currentPhysicalLogicalOutcome: 'network_failure',
      currentPhysicalRetryable: true, currentPhysicalCandidate: null, currentPhysicalEvidence: [],
      currentPhysicalProviderRequestId: null,
    });
    const rpc = subject.dependencies.serviceClient.rpc;
    await runMetadataWorkerBatch(1, { ...subject.dependencies, serviceClient: { rpc: async (name: string, p: Record<string, unknown>) =>
      name === 'phase9_begin_automatic_provider_run_v1' ? { data: { status: 'recovery_only' }, error: null } : rpc(name, p) } });
    expect(subject.gets()).toBe(1);
    expect(subject.command()).toBeNull();
  });
});
