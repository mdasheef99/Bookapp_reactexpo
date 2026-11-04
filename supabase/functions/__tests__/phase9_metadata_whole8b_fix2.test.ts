// FIX2 D1-D4/D7; 02c §§4.3/5.1/9. Test-only policies and recorded responses.
import { automaticDependencies } from './support/automaticWorker';
import { automaticContext } from './fixtures/phase9/editionOptionsWorker';
import { getWorkerProtectionState } from '../../../workers/phase9-metadata-worker';
import { createProtectionState, checkBreaker } from '../_shared/imageInventory/runtime/providerProtection';
import { createTestHttpPort } from './support/providerModules';
import { TEST_ONLY_PROTECTION_POLICY as policy, fakeClock } from './support/providerProtection';

const call = () => ({ url: new URL('https://openlibrary.org/search.json'), stage: 'search', sequence: 0,
  signal: new AbortController().signal });
const port = (clock: ReturnType<typeof fakeClock>, state: object, extra: Record<string, unknown> = {}) =>
  createTestHttpPort({ adapterKey: 'open_library', adapterVersion: '2.0.0', policy, maxGets: 6,
    timeoutMs: 1000, maxResponseBytes: 64000, now: clock.now, sleep: clock.sleep, breakerState: state,
    beforeRequest: async () => ({ callId: '00000000-0000-4000-8000-000000000007' }),
    afterRequest: async (id: string) => ({ receiptId: id }), ...extra });

beforeEach(() => Object.assign(getWorkerProtectionState('google_books'), createProtectionState()));
test('D1: a sent half-open Google probe settles even when finalize and reconcile fail', async () => {
  const subject = automaticDependencies({ fetcher: async () => new Response('{}', { status: 503 }),
    rpc: async name => ['phase9_finalize_metadata_provider_call', 'phase9_reconcile_metadata_provider_call'].includes(name)
      ? { data: null, error: { message: 'lost finalization' } } : undefined });
  const state = getWorkerProtectionState('google_books');
  // Let begin pass its preflight; take a probe only after the run has started.
  const rpc = subject.dependencies.serviceClient.rpc;
  subject.dependencies.serviceClient.rpc = async (name, p) => {
    const result = await rpc(name, p);
    if (name === 'phase9_prepare_automatic_metadata_v1') state.breakerOpenedAtMs = Date.now() - policy.breakerCooldownMs;
    return result;
  };
  await subject.run();
  expect(subject.gets()).toBe(1);
  expect(state.halfOpenProbeInFlight).toBe(false);
  expect(checkBreaker(policy, state, Date.now() + policy.breakerCooldownMs)).toBe(true);
});
test('D2: a reachable half-open 429 closes the port breaker', async () => {
  const clock = fakeClock(policy.breakerCooldownMs), state = createProtectionState();
  state.breakerOpenedAtMs = 0;
  await expect(port(clock, state, { fetcher: async () => new Response('', { status: 429 }) }).get(call()))
    .rejects.toMatchObject({ outcome: 'rate_limited' });
  expect(state.halfOpenProbeInFlight).toBe(false);
  expect(state.breakerOpenedAtMs).toBeNull();
});
test('D3: repeated Google 429s leave the breaker closed while repeated 503s open it', async () => {
  const state = getWorkerProtectionState('google_books');
  for (const status of [429, 503]) {
    Object.assign(state, createProtectionState());
    for (let n = 0; n < policy.breakerFailures; n++) {
      const previous = { ...state, lastGetStartMs: null, failureAtMs: [...state.failureAtMs] };
      const subject = automaticDependencies({ fetcher: async () => new Response('{}', { status,
        headers: { 'content-type': 'application/json' } }) });
      Object.assign(state, previous); // The fixture constructor resets shared state for independent tests.
      await subject.run();
      expect(subject.gets()).toBe(1);
    }
    expect(state.breakerOpenedAtMs === null).toBe(status === 429);
  }
});
test('D4: a breaker opened during the legacy limiter wait refuses before registration', async () => {
  const clock = fakeClock(), state = createProtectionState(), release = jest.fn();
  const beforeRequest = jest.fn(async () => ({ callId: '00000000-0000-4000-8000-000000000007' }));
  const subject = port(clock, state, { beforeRequest, acquireLimiter: async () => {
    state.breakerOpenedAtMs = clock.now(); return release;
  }, fetcher: jest.fn() });
  await expect(subject.get(call())).rejects.toMatchObject({ outcome: 'circuit_breaker_open' });
  expect(beforeRequest).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledWith(false);
  expect(state.halfOpenProbeInFlight).toBe(false);
});
test('D7: a cached accepted_metadata_match cannot bypass positive retention denial', async () => {
  const subject = automaticDependencies({ context: { providerPolicies: automaticContext.providerPolicies.map(row =>
    ({ ...row, storageAllowed: false })) }, rpc: async name => name === 'phase9_metadata_cache_reuse_context'
    ? { data: { leaderLookupId: '00000000-0000-4000-8000-000000000011',
      normalizedOutcome: 'accepted_metadata_match' }, error: null } : undefined });
  await subject.run();
  expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_complete_metadata_cache_reuse');
});
