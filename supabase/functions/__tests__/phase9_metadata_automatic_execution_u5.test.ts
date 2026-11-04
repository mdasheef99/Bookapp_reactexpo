import { automaticDependencies } from './support/automaticWorker';
import { bootstrapOpenLibraryOnly, runDescriptorWorker } from './support/providerModules';
import { workerEnvironment } from './support/automaticWorker';
import { getWorkerProtectionState } from '../../../workers/phase9-metadata-worker';
import { TEST_ONLY_PROTECTION_POLICY as protection } from './support/providerProtection';

describe('U5 automatic admission and execution (02c §4.3)', () => {
  // Mutation caught: legacy election creates lineage before capacity admission.
  it('prepares before usage or physical registration and completes atomically', async () => {
    const subject = automaticDependencies();
    expect((await subject.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).toContain('phase9_prepare_automatic_metadata_v1');
    expect(names.indexOf('phase9_prepare_automatic_metadata_v1')).toBeLessThan(names.indexOf('phase9_reserve_metadata_usage'));
    expect(names).not.toContain('phase9_metadata_coalescing_context');
    expect(names).not.toContain('phase9_finalize_structural_metadata_attempt');
    expect(subject.gets()).toBe(1);
    expect(subject.command()).not.toBeNull();
  });
  // Mutation caught: a capacity denial falls through to a GET or a generic retry write.
  it('stops on capacity_wait without lineage, with a started positive control', async () => {
    const denied = automaticDependencies({ rpc: async name => name === 'phase9_prepare_automatic_metadata_v1'
      ? { data: { admission: { status: 'capacity_wait', dueAt: new Date().toISOString() }, coalescing: null }, error: null } : undefined });
    expect((await denied.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(denied.gets()).toBe(0);
    expect(denied.fixture.calls.map(call => call.name)).not.toContain('phase9_reserve_metadata_usage');
    expect(denied.fixture.calls.map(call => call.name)).not.toContain('phase9_fail_metadata_job');
    const started = automaticDependencies();
    expect((await started.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(started.gets()).toBe(1);
  });
  // Mutation caught: a replay, configuration/drain refusal or unknown decision authorizes a duplicate GET.
  it.each([
    { status: 'recovery_only' }, { status: 'configuration_required' }, { status: 'drain_required' },
    { status: 'replayed', round: 0, runStatus: 'running' },
    { status: 'replayed', round: 0, runStatus: 'finalized' },
    { status: 'replayed', round: 1, runStatus: 'unknown' }, { status: 'unrecognized' },
  ])('refuses egress for admission %p', async admission => {
    const refused = automaticDependencies({ rpc: async name => name === 'phase9_prepare_automatic_metadata_v1'
      ? { data: { admission, coalescing: null }, error: null } : undefined });
    expect((await refused.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(refused.gets()).toBe(0);
    expect(refused.command()).toBeNull();
    const names = refused.fixture.calls.map(call => call.name);
    if (admission.status === 'unrecognized') {
      // A malformed admission is uncertain: no generic fail/requeue.
      expect(names).not.toContain('phase9_fail_metadata_job');
    } else {
      // Known refusals terminalize instead of leaving an in-progress job.
      expect(names).toContain('phase9_fail_metadata_job');
    }
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });
  // Mutation caught: treating an error's message as certain rollback without the real SQLSTATE.
  it.each([
    ['P9_STATE_CONFLICT', 'P0001', 'stale_claim'],
    ['P9_STATE_CONFLICT', undefined, 'manual_metadata_required'],
    ['P9_REQUEST_INVALID', 'P0001', 'manual_metadata_required'],
    ['P9_EXTERNAL_ADMISSION_PAUSED', 'P0001', 'manual_metadata_required'],
  ])('preserves refusal identity %s / %s', async (message, code, outcome) => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_prepare_automatic_metadata_v1'
      ? { data: null, error: { message, code } } : undefined });
    expect((await subject.run()).results).toEqual([{ outcome }]);
    expect(subject.gets()).toBe(0);
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_fail_metadata_job');
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });
  // Mutation caught: a pending follower begins its own run or reserves logical usage before deferral.
  it('defers a pending follower without beginning a provider run', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_prepare_automatic_metadata_v1'
      ? { data: { admission: null, coalescing: { mode: 'follower_pending',
        leaderLookupId: '00000000-0000-4000-8000-000000000099' } }, error: null } : undefined });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).toContain('phase9_fail_metadata_job');
    expect(names).not.toContain('phase9_begin_automatic_provider_run_v1');
    expect(names).not.toContain('phase9_reserve_metadata_usage');
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
  });
  // Mutation caught: a Google-less local canonical match depends on provider/registry availability.
  it('resolves local metadata before registry or fence reads in a keyless runtime', async () => {
    const production = bootstrapOpenLibraryOnly(workerEnvironment, async () => { throw new Error('no egress'); });
    const subject = automaticDependencies({ production, context: { localCanonicalEditionId: 'local-winner' },
      rpc: async name => name === 'phase9_provider_configuration_v1' ? { data: null, error: { message: 'unavailable' } } : undefined });
    expect((await runDescriptorWorker(subject.dependencies, production.installed)).results)
      .toEqual([{ outcome: 'local_canonical_match' }]);
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_provider_configuration_v1');
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_automatic_edition_fence_v1');
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });
  // Mutation caught: provider permission changes after registration are ignored by the final pre-send fence.
  it('records an unsent stale call when provider permission changes after its grant', async () => {
    let subject: ReturnType<typeof automaticDependencies>;
    subject = automaticDependencies({ rpc: async (name, p) => {
      if (name === 'phase9_register_metadata_provider_call') {
        subject.fixture.current().providerPolicies = subject.fixture.current().providerPolicies
          .map((row: Record<string, unknown>) => ({ ...row, matchingAllowed: false }));
        return { data: { status: 'registered', provider_call_id: '00000000-0000-4000-8000-000000000007' }, error: null };
      }
      return undefined;
    } });
    expect((await subject.run()).results).toEqual([{ outcome: 'stale_claim' }]);
    expect(subject.gets()).toBe(0);
    const receipts = subject.fixture.calls.filter(call => call.name === 'phase9_finalize_metadata_provider_call');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].parameters).toMatchObject({ p_status: 'stale_rejected', p_normalized_candidate: null });
    expect(subject.command()).toBeNull();
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_fail_metadata_job');
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });
  // Mutation caught: aborting after the probe is acquired leaks the half-open probe.
  it('releases its half-open probe when cancelled before the send', async () => {
    const controller = new AbortController();
    const state = getWorkerProtectionState('google_books');
    let prepared = false, probeAtAbort = false;
    const subject = automaticDependencies({ rpc: async name => {
      if (name === 'phase9_prepare_automatic_metadata_v1') prepared = true;
      if (name === 'phase9_metadata_job_context' && prepared && !controller.signal.aborted) {
        probeAtAbort = state.halfOpenProbeInFlight;
        controller.abort();
      }
      return undefined;
    } });
    jest.useFakeTimers();
    state.breakerOpenedAtMs = Date.now() - protection.breakerCooldownMs;
    state.lastGetStartMs = Date.now();
    const constructor = jest.spyOn(globalThis, 'AbortController').mockImplementation(() => controller);
    try {
      const running = subject.run();
      await jest.advanceTimersByTimeAsync(protection.minIntervalMs);
      expect((await running).results).toEqual([{ outcome: 'manual_metadata_required' }]);
      expect(probeAtAbort).toBe(true);
      expect(state.halfOpenProbeInFlight).toBe(false);
      expect(subject.gets()).toBe(0);
    } finally { constructor.mockRestore(); jest.useRealTimers(); }
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });
  // Mutation caught: checking the breaker before the pacing wait authorizes a GET after it opens.
  it('opens the breaker during pacing and sends no GET', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_schedule_automatic_provider_recheck_v1'
      ? { data: { status: 'retry_scheduled', round: 0,
        dueAt: new Date(Date.now() + protection.minIntervalMs).toISOString() }, error: null } : undefined });
    jest.useFakeTimers();
    const state = getWorkerProtectionState('google_books');
    state.lastGetStartMs = Date.now();
    try {
      const running = subject.run();
      await jest.advanceTimersByTimeAsync(0);
      state.breakerOpenedAtMs = Date.now();
      await jest.advanceTimersByTimeAsync(protection.minIntervalMs);
      expect((await running).results).toEqual([{ outcome: 'retry_scheduled' }]);
      expect(subject.gets()).toBe(0);
      expect(subject.fixture.calls.map(call => call.name)).toContain('phase9_schedule_automatic_provider_recheck_v1');
    } finally { jest.useRealTimers(); }
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });
});
