// U6 fix pass 1 (NEW file). Red-first tests per item; each names the exact
// function called and the mutation caught, with a differing-only control.
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { invokeOpenLibraryV2 } from '../_shared/imageInventory/metadata/openLibrary/automatic';
import { createProviderHttpPort, markProviderHttpUnregistered } from '../_shared/imageInventory/metadata/providerHttp';
import { TEST_ONLY_PROTECTION_POLICY as policy, TEST_ONLY_PROVIDER_CONTACTS, fakeClock } from './support/providerProtection';
import { CALL_ID } from './support/automaticWorker';

const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: null, language: 'en', editionClues: [],
});
const editionEntry = {
  key: '/books/OL100M', title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
  languages: [{ key: '/languages/eng' }], publish_date: '2024', publishers: ['Fixture Press'],
};

describe('Phase 9 fix1 F1: retention policy never from response headers', () => {
  // The verified policy travels on the TYPED response field (populated by the
  // port from verified internal configuration); response headers may only
  // bound retention duration, never identify policy.
  const runV2 = async (headers: Headers, typed: number | null) => {
    const http = {
      get: async ({ url }: { url: URL }) => {
        if (url.pathname === '/search.json') {
          return { json: { docs: [{ key: '/works/OL1W' }] }, headers: new Headers() };
        }
        if (url.pathname === '/works/OL1W/editions.json') {
          return { json: { entries: [editionEntry] }, headers: new Headers() };
        }
        return { json: { key: '/authors/OL1A', name: 'Fixture Author' }, headers,
          retentionPolicyVersion: typed };
      },
    };
    const descriptor = { policyVersion: null };
    return invokeOpenLibraryV2({
      query, correlationId: 'f1-lookup', attemptId: 'f1-attempt',
      signal: new AbortController().signal, purpose: 'edition_options',
      http: http as never,
      version: 'p9-metadata-result-v2', policyVersion: descriptor.policyVersion,
      retentionContract: 'open-library-options-v1',
    });
  };
  it('ignores a forged x-p9-retention-policy-version header with typed policy null', async () => {
    // Mutation caught: trusting provider response headers for policy identity
    // (would retain rows with policyVersion 77 and no verified policy).
    const result = await runV2(
      new Headers({ 'content-type': 'application/json', 'x-p9-retention-policy-version': '77' }), null);
    expect(result.retention).toBeNull();
    expect(result.rows).toBeNull();
  });
  it('retains with typed policy 1 (positive control)', async () => {
    const result = await runV2(new Headers({ 'content-type': 'application/json' }), 1);
    expect(result.retention).toMatchObject({ policyVersion: 1, storagePermissionVerified: true });
    expect(result.rows).toHaveLength(1);
  });
});

const portCall = (url: string, stage: string, sequence: number) => ({
  url: new URL(url), stage, sequence, signal: new AbortController().signal,
});
const jsonResponse = () => new Response(JSON.stringify({ docs: [] }), {
  headers: { 'content-type': 'application/json' },
});
const fix1Port = (clock: ReturnType<typeof fakeClock>, overrides: Record<string, unknown> = {}) => {
  const base = {
    adapterKey: 'open_library', adapterVersion: '2.0.0',
    policy, providerContact: TEST_ONLY_PROVIDER_CONTACTS['fixture-contact'],
    maxGets: 6, timeoutMs: 1000, maxResponseBytes: 64000,
    now: clock.now, sleep: clock.sleep, fetcher: async () => jsonResponse(),
    lookupId: '00000000-0000-4000-8000-000000000101',
    attemptId: '00000000-0000-4000-8000-000000000201',
    claim: { jobId: '00000000-0000-4000-8000-000000000001',
      worker: 'metadata-worker-fixture-0001', leaseToken: 'a'.repeat(64), claimAttempt: 1 },
    beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
    afterRequest: async (callId: string) => ({ receiptId: callId }),
  };
  return createProviderHttpPort({ ...base, ...overrides } as never);
};

describe('Phase 9 fix1 F11: default validator binds path/stage/sequence', () => {
  it('refuses an allowed path with the wrong stage/sequence before registration', async () => {
    const clock = fakeClock();
    const beforeRequest = jest.fn(async () => ({ callId: CALL_ID, grantEpoch: null }));
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = fix1Port(clock, { beforeRequest, afterRequest });
    // Mutation caught: stage/sequence-agnostic path check (would register).
    await expect(port.get(portCall(
      'https://openlibrary.org/search.json', 'editions', 1))).rejects.toMatchObject({
      outcome: 'insufficient_query',
    });
    await expect(port.get(portCall(
      'https://openlibrary.org/authors/OL9A.json', 'author:OL1A', 2))).rejects.toMatchObject({
      outcome: 'insufficient_query',
    });
    expect(beforeRequest).not.toHaveBeenCalled();
    expect(afterRequest).not.toHaveBeenCalled();
    await expect(port.get(portCall(
      'https://openlibrary.org/search.json', 'search', 0))).resolves.toMatchObject({
      receiptId: CALL_ID,
    });
    expect(beforeRequest).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 9 fix1 F13: proven-unsent keeps its reservation', () => {
  it('rejects a repeat stage/sequence after a post-grant cancel, synchronously', async () => {
    const clock = fakeClock();
    const controller = new AbortController();
    let registrations = 0;
    const port = fix1Port(clock, {
      beforeRequest: async () => {
        registrations += 1; controller.abort();
        return { callId: CALL_ID, grantEpoch: null };
      },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    await expect(port.get({
      url: new URL('https://openlibrary.org/search.json'), stage: 'search',
      sequence: 0, signal: controller.signal,
    })).rejects.toMatchObject({ outcome: 'cancelled' });
    expect(registrations).toBe(1);
    // Repeat must refuse BEFORE any async work: zero further registrations.
    await expect(port.get(portCall(
      'https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'insufficient_query',
    });
    expect(registrations).toBe(1);
  });
  it('releases the reservation on pre-grant refusal (positive control)', async () => {
    const clock = fakeClock();
    let registrations = 0;
    const port = fix1Port(clock, {
      beforeRequest: async () => { registrations += 1; return { callId: CALL_ID, grantEpoch: null }; },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    await expect(port.get(portCall(
      'https://elsewhere.example.test/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'insufficient_query' });
    expect(registrations).toBe(0);
    await expect(port.get(portCall(
      'https://openlibrary.org/search.json', 'search', 0))).resolves.toMatchObject({
      receiptId: CALL_ID,
    });
    expect(registrations).toBe(1);
  });
});

describe('Phase 9 fix1 F4: probe settles only on provider contact', () => {
  it('does not extend the outage on a pre-send refusal', async () => {
    const clock = fakeClock();
    let fetches = 0;
    const breakerState = {};
    const failing = async () => { fetches += 1; return new Response('', { status: 503 }); };
    const grant = (id: string) => async () => ({ callId: id, grantEpoch: null });
    const fin = async (callId: string) => ({ receiptId: callId });
    const claimPort = (index: number, fetcher: typeof failing) => fix1Port(clock, {
      fetcher, breakerState,
      beforeRequest: grant(`00000000-0000-4000-8000-${String(400 + index).padStart(12, '0')}`),
      afterRequest: fin,
      claim: { jobId: `00000000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`,
        worker: 'w', leaseToken: `${index}`.repeat(64).slice(0, 64), claimAttempt: 1 },
    });
    await expect(claimPort(0, failing).get(
      portCall('https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'provider_unavailable', retryable: true });
    await expect(claimPort(1, failing).get(
      portCall('https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'provider_unavailable', retryable: true });
    expect(fetches).toBe(2);
    clock.advance(policy.breakerCooldownMs);
    // Probe refused pre-send (validator): must NOT count as a failure.
    await expect(claimPort(2, failing).get(
      portCall('https://elsewhere.example.test/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'insufficient_query' });
    expect(fetches).toBe(2);
    // Outage not extended: a valid claim probes immediately.
    await expect(claimPort(3, async () => jsonResponse()).get(
      portCall('https://openlibrary.org/search.json', 'search', 0))).resolves.toMatchObject({
      json: { docs: [] },
    });
    expect(fetches).toBe(2);
  });
  it('re-opens the breaker when a half-open probe contacts the provider and fails (H4)', async () => {
    // Control for the pass-1 overclaim: an actual contacted 503 probe must
    // extend the outage, unlike a pre-send refusal.
    const clock = fakeClock();
    let fetches = 0;
    const breakerState = {};
    const failing = async () => { fetches += 1; return new Response('', { status: 503 }); };
    const grant = (id: string) => async () => ({ callId: id, grantEpoch: null });
    const fin = async (callId: string) => ({ receiptId: callId });
    const claimPort = (index: number) => fix1Port(clock, {
      fetcher: failing, breakerState,
      beforeRequest: grant(`00000000-0000-4000-8000-${String(410 + index).padStart(12, '0')}`),
      afterRequest: fin,
      claim: { jobId: `00000000-0000-4000-8000-${String(310 + index).padStart(12, '0')}`,
        worker: 'w', leaseToken: `${index}`.repeat(64).slice(0, 64), claimAttempt: 1 },
    });
    await expect(claimPort(0).get(
      portCall('https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'provider_unavailable', retryable: true });
    await expect(claimPort(1).get(
      portCall('https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'provider_unavailable', retryable: true });
    expect(fetches).toBe(2);
    clock.advance(policy.breakerCooldownMs);
    await expect(claimPort(2).get(
      portCall('https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'provider_unavailable', retryable: true });
    expect(fetches).toBe(3);
    await expect(claimPort(3).get(
      portCall('https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'circuit_breaker_open' });
    expect(fetches).toBe(3);
  });
});

/* F10 hook-level tests live in phase9_metadata_explicit_port.test.ts. */

describe('Phase 9 fix1 F2: bridge physical accounting through the real bridge', () => {
  const { OpenLibraryEditionOptionsAdapter } = require('../_shared/imageInventory/metadata/openLibrary/adapter');
  const { createBridgedPort } = require('../_shared/imageInventory/runtime/metadataEditionOptions');
  const q = buildMetadataQueryIdentity({
    strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
    isbnClue: null, language: 'en', editionClues: [],
  });
  const hooksStub = () => {
    const registered: Array<{ sequence: number; stage: string }> = [];
    const settled: Array<{ callId: string; outcome: string; retryable: boolean;
      physicalStatus: string; egressStarted: boolean }> = [];
    return {
      registered, settled,
      hooks: {
        beforeRequest: async (call: { sequence: number; stage: string }) => {
          registered.push({ sequence: call.sequence, stage: call.stage });
          return { callId: `f2-${call.sequence}`, grantEpoch: null };
        },
        afterRequest: async (callId: string, s: { outcome: string; retryable: boolean;
          physicalStatus: 'finalized' | 'outcome_unknown' | 'stale_rejected'; egressStarted: boolean }) => {
          settled.push({ callId, ...s });
          return { receiptId: callId };
        },
      },
    };
  };
  const claim = { jobId: '00000000-0000-4000-8000-000000000001', worker: 'f2-worker',
    leaseToken: 'a'.repeat(64), claimAttempt: 1 };
  const runBoth = async (fetcher: (url: unknown) => Promise<Response>, timeoutMs = 1000) => {
    const config = { timeoutMs, maxResponseBytes: 64000, fetcher };
    const direct = new OpenLibraryEditionOptionsAdapter(config);
    const stub = hooksStub();
    const bridged = new OpenLibraryEditionOptionsAdapter(config);
    const port = createBridgedPort({ adapterKey: 'open_library', adapterVersion: '1.0.0',
      binding: bridged.transportBinding, maxGets: 6, policy: null,
      lookupId: 'f2-lookup', attemptId: 'f2-attempt', claim, hooks: stub.hooks });
    const input = { query: q, correlationId: 'f2-lookup', attemptId: 'f2-attempt',
      signal: new AbortController().signal };
    const [d, b] = await Promise.all([
      direct.lookupEditionOptions(input).then(
        (r: { outcome: string; retryable: boolean }) => ({ outcome: r.outcome, retryable: r.retryable }),
        (e: Error) => ({ thrown: e.constructor.name + ':' + e.message })),
      bridged.lookupEditionOptions({ ...input, httpPort: port }).then(
        (r: { outcome: string; retryable: boolean }) => ({ outcome: r.outcome, retryable: r.retryable }),
        (e: Error) => ({ thrown: e.constructor.name + ':' + e.message })),
    ]);
    return { direct: d, bridged: b, stub };
  };
  const j = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers: { 'content-type': 'application/json', ...headers } });
  it.each([
    ['search 404', () => j({}, 404), 'no_acceptable_match', false, 'finalized', true],
    ['search 429', () => new Response('', { status: 429, headers: { 'retry-after': '120' } }),
      'rate_limited', true, 'finalized', true],
    ['unsupported content type', () => j('x', 200, { 'content-type': 'text/html' }),
      'unsupported_content_type', false, 'finalized', true],
    ['oversized response', () => j({}, 200, { 'content-length': '64001' }),
      'response_too_large', false, 'finalized', true],
    ['network failure', async () => { throw new Error('socket down'); },
      'network_failure', true, 'outcome_unknown', true],
  ] as const)('%s: bridge matches direct outcome/retryability and settled status',
    async (_name, fetcher, outcome, retryable, physicalStatus, egressStarted) => {
      const { direct, bridged, stub } = await runBoth(fetcher as never);
      expect(bridged).toEqual(direct);
      expect(direct).toEqual({ outcome, retryable });
      expect(stub.settled).toHaveLength(1);
      expect(stub.settled[0]).toMatchObject({ outcome, retryable, physicalStatus, egressStarted });
    });
  it('search timeout matches and settles unknown', async () => {
    // A faithful hanging fetcher settles on abort, like real fetch.
    const hanging = (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const { direct, bridged, stub } = await runBoth(hanging as never, 100);
    expect(bridged).toEqual(direct);
    expect(direct).toEqual({ outcome: 'timeout', retryable: true });
    expect(stub.settled).toHaveLength(1);
    expect(stub.settled[0]).toMatchObject(
      { outcome: 'timeout', retryable: true, physicalStatus: 'outcome_unknown', egressStarted: true });
  }, 15000);
  it('pre-send cancellation is proven-unsent with no fetch', async () => {
    const fetched = jest.fn(async () => j({ docs: [] }));
    const controller = new AbortController();
    const stub = hooksStub();
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: fetched });
    const abortingHooks = {
      beforeRequest: async (call: { sequence: number; stage: string }) => {
        controller.abort();
        return stub.hooks.beforeRequest(call);
      },
      afterRequest: stub.hooks.afterRequest,
    };
    const port = createBridgedPort({ adapterKey: 'open_library', adapterVersion: '1.0.0',
      binding: adapter.transportBinding, maxGets: 6, policy: null,
      lookupId: 'f2-lookup', attemptId: 'f2-attempt', claim, hooks: abortingHooks });
    await expect(adapter.lookupEditionOptions({ query: q, correlationId: 'f2-lookup',
      attemptId: 'f2-attempt', signal: controller.signal, httpPort: port,
    })).resolves.toMatchObject({ outcome: 'cancelled', retryable: false });
    expect(fetched).not.toHaveBeenCalled();
    expect(stub.settled).toHaveLength(1);
    expect(stub.settled[0]).toMatchObject(
      { outcome: 'cancelled', retryable: false, physicalStatus: 'stale_rejected', egressStarted: false });
  });
});

describe('Phase 9 fix1 F3: shared atomic start permits', () => {
  const tick = async (n = 10) => {
    for (let i = 0; i < n; i += 1) await Promise.resolve();
  };
  it('separates actual starts across concurrent ports sharing one state', async () => {
    // Mutation caught: check-then-sleep pacing with per-call state (both
    // claims timestamp before either records, then bunch at ~0ms).
    const clock = fakeClock();
    const shared = {};
    const starts: number[] = [];
    let enteredFirst = false;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let registrations = 0;
    const mkPort = () => fix1Port(clock, {
      sharedProtection: shared,
      fetcher: async () => { starts.push(clock.now()); return jsonResponse(); },
      beforeRequest: async () => {
        registrations += 1;
        if (registrations === 1) { enteredFirst = true; await firstGate; }
        return { callId: `00000000-0000-4000-8000-${String(500 + registrations).padStart(12, '0')}`, grantEpoch: null };
      },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    const first = mkPort().get(portCall('https://openlibrary.org/search.json', 'search', 0));
    const second = mkPort().get(portCall('https://openlibrary.org/works/OL1W/editions.json', 'editions', 1));
    await tick(50);
    expect(enteredFirst).toBe(true);
    expect(starts).toEqual([]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(starts).toEqual([0, policy.minIntervalMs]);
  });
  it('does not serialize ports with separate states (positive control)', async () => {
    const clock = fakeClock();
    const starts: number[] = [];
    const mkPort = () => fix1Port(clock, {
      fetcher: async () => { starts.push(clock.now()); return jsonResponse(); },
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    await Promise.all([
      mkPort().get(portCall('https://openlibrary.org/search.json', 'search', 0)),
      mkPort().get(portCall('https://openlibrary.org/works/OL1W/editions.json', 'editions', 1)),
    ]);
    expect(starts).toEqual([0, 0]);
  });
  it('paces from the predecessor actual start when registration overshoots the interval', async () => {
    // Mutation caught: reserving the next start at enqueue (B starts at the
    // same clock instant as A after A's registration blocked past the interval).
    const clock = fakeClock();
    const shared = {};
    const starts: number[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let registrations = 0;
    const mkPort = () => fix1Port(clock, {
      sharedProtection: shared,
      fetcher: async () => { starts.push(clock.now()); return jsonResponse(); },
      beforeRequest: async () => {
        registrations += 1;
        if (registrations === 1) await firstGate;
        return { callId: `00000000-0000-4000-8000-${String(600 + registrations).padStart(12, '0')}`, grantEpoch: null };
      },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    const first = mkPort().get(portCall('https://openlibrary.org/search.json', 'search', 0));
    const second = mkPort().get(portCall('https://openlibrary.org/works/OL1W/editions.json', 'editions', 1));
    await tick(50);
    expect(starts).toEqual([]);
    clock.advance(policy.minIntervalMs * 5);
    releaseFirst();
    await Promise.all([first, second]);
    expect(starts).toEqual([policy.minIntervalMs * 5, policy.minIntervalMs * 6]);
  });
  it('keeps successors behind the blocked head after a queued waiter aborts', async () => {
    // Mutation caught: an aborted waiter resolving its own tail lets a later
    // claim pass a predecessor that has not started yet.
    const clock = fakeClock();
    const shared = {};
    const starts: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let registrations = 0;
    const mkPort = (signal: AbortSignal, stage: string, sequence: number, url: string) => fix1Port(clock, {
      sharedProtection: shared,
      fetcher: async () => { starts.push(`${stage}@${clock.now()}`); return jsonResponse(); },
      beforeRequest: async () => {
        registrations += 1;
        if (registrations === 1) await firstGate;
        return { callId: `00000000-0000-4000-8000-${String(700 + registrations).padStart(12, '0')}`, grantEpoch: null };
      },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    }).get({ url: new URL(url), stage, sequence, signal });
    const a = mkPort(new AbortController().signal, 'search', 0,
      'https://openlibrary.org/search.json');
    await tick(50);
    expect(registrations).toBe(1);
    const controller = new AbortController();
    const b = mkPort(controller.signal, 'editions', 1,
      'https://openlibrary.org/works/OL1W/editions.json');
    await tick(20);
    controller.abort();
    await expect(b).rejects.toMatchObject({ outcome: 'cancelled' });
    const c = mkPort(new AbortController().signal, 'author:OL1A', 2,
      'https://openlibrary.org/authors/OL1A.json');
    await tick(50);
    expect(starts).toEqual([]);
    clock.advance(policy.minIntervalMs * 5);
    releaseFirst();
    await Promise.all([a, c]);
    expect(starts).toEqual([
      `search@${policy.minIntervalMs * 5}`, `author:OL1A@${policy.minIntervalMs * 6}`,
    ]);
  });
  it('interrupts a pacing wait on cancellation and releases successors', async () => {
    const clock = fakeClock();
    const shared = {};
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let first = true;
    const mkPort = (signal: AbortSignal, stage: string, sequence: number) => fix1Port(clock, {
      sharedProtection: shared,
      fetcher: async () => jsonResponse(),
      beforeRequest: async () => {
        if (first) { first = false; await firstGate; }
        return { callId: CALL_ID, grantEpoch: null };
      },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    }).get({ url: new URL(stage === 'search' ? 'https://openlibrary.org/search.json'
      : stage === 'editions' ? 'https://openlibrary.org/works/OL1W/editions.json'
      : 'https://openlibrary.org/authors/OL1A.json'),
      stage, sequence, signal });
    const controller = new AbortController();
    const a = mkPort(new AbortController().signal, 'search', 0);
    const b = mkPort(controller.signal, 'editions', 1);
    await tick(50);
    controller.abort();
    await expect(b).rejects.toMatchObject({ outcome: 'cancelled' });
    releaseFirst();
    await expect(a).resolves.toMatchObject({ receiptId: CALL_ID });
    const c = mkPort(new AbortController().signal, 'author:OL1A', 2);
    await expect(c).resolves.toMatchObject({ receiptId: CALL_ID });
  });
});

describe('Phase 9 fix1 F5: timeout and abort span body consumption', () => {
  // The jest env cannot pend a real Response-body read (it starves timers),
  // so the stalled body is a duck-typed stream exercising the REAL port
  // read-race (not a re-implementation): read() never settles, cancel() no-ops.
  const stalledBody = () => ({
    status: 200, ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: {
      getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => {} }),
      cancel: async () => {},
    },
  }) as unknown as Response;
  const settle = (afterRequest: jest.Mock, status: string, outcome: string, retryable: boolean) => {
    expect(afterRequest).toHaveBeenCalledTimes(1);
    expect(afterRequest).toHaveBeenCalledWith(CALL_ID, {
      status, egressStarted: true, outcome, retryable, providerRequestId: null,
    });
  };
  it('settles a stalled body as timeout with exactly one finalization', async () => {
    // Mutation caught: timer/listener teardown at headers (hangs forever).
    const clock = fakeClock();
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = fix1Port(clock, {
      timeoutMs: 50,
      fetcher: async () => stalledBody(),
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest,
    });
    await expect(port.get(portCall(
      'https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'timeout', retryable: true,
    });
    settle(afterRequest, 'finalized', 'timeout', true);
  }, 10000);
  it('settles caller abort mid-body as cancelled with exactly one finalization', async () => {
    const clock = fakeClock();
    const controller = new AbortController();
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = fix1Port(clock, {
      fetcher: async () => { setTimeout(() => controller.abort(), 10); return stalledBody(); },
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest,
    });
    await expect(port.get({
      url: new URL('https://openlibrary.org/search.json'), stage: 'search',
      sequence: 0, signal: controller.signal,
    })).rejects.toMatchObject({ outcome: 'cancelled', retryable: false });
    settle(afterRequest, 'finalized', 'cancelled', false);
  }, 10000);
  it('consumes a normal body with unchanged success (positive control)', async () => {
    const clock = fakeClock();
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = fix1Port(clock, {
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest,
    });
    await expect(port.get(portCall(
      'https://openlibrary.org/search.json', 'search', 0))).resolves.toMatchObject({
      json: { docs: [] }, receiptId: CALL_ID,
    });
    settle(afterRequest, 'finalized', 'no_acceptable_match', false);
  });
  it('finalizes an error response whose body cancel never settles (G3)', async () => {
    // Mutation caught: awaiting response.body.cancel() before finalization.
    const clock = fakeClock();
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = fix1Port(clock, {
      policy: null,
      fetcher: async () => ({
        status: 503, ok: false,
        headers: new Headers({ 'content-type': 'application/json' }),
        body: { cancel: () => new Promise<void>(() => {}) },
      }) as unknown as Response,
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest,
    });
    const outcome = await Promise.race([
      port.get(portCall('https://openlibrary.org/search.json', 'search', 0)).then(
        () => 'resolved', (error) => error as { outcome?: string }),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 100)),
    ]);
    expect(outcome).toMatchObject({ outcome: 'provider_unavailable' });
    expect(afterRequest).toHaveBeenCalledTimes(1);
    expect(afterRequest).toHaveBeenCalledWith(CALL_ID, {
      status: 'finalized', egressStarted: true, outcome: 'provider_unavailable',
      retryable: true, providerRequestId: null,
    });
  });
  it('finalizes a timed-out stalled body whose reader cancel never settles (G3)', async () => {
    // Mutation caught: awaiting reader.cancel() in the cleanup finally.
    const clock = fakeClock();
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = fix1Port(clock, {
      policy: null, timeoutMs: 25,
      fetcher: async () => ({
        status: 200, ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        body: {
          getReader: () => ({
            read: () => new Promise<never>(() => {}),
            cancel: () => new Promise<void>(() => {}),
          }),
          cancel: () => new Promise<void>(() => {}),
        },
      }) as unknown as Response,
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest,
    });
    const outcome = await Promise.race([
      port.get(portCall('https://openlibrary.org/search.json', 'search', 0)).then(
        () => 'resolved', (error) => error as { outcome?: string }),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 250)),
    ]);
    expect(outcome).toMatchObject({ outcome: 'timeout' });
    expect(afterRequest).toHaveBeenCalledTimes(1);
    expect(afterRequest).toHaveBeenCalledWith(CALL_ID, {
      status: 'finalized', egressStarted: true, outcome: 'timeout',
      retryable: true, providerRequestId: null,
    });
  });
});

describe('Phase 9 fix1 F7: denial identity end to end', () => {
  it('preserves a thrown fresh() denial with zero GET', async () => {
    // Mutation caught: register-catch wrapping the fence denial as retryable
    // provider_unavailable. Calls hooks.beforeRequest through a full port GET.
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{
      adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: false,
      matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
    }];
    const { gateway } = fixture.direct({
      explicitDescriptor: { descriptor: { adapterKey: 'open_library', adapterVersion: '1.0.0' } },
    });
    const hooks = gateway.editionProviderCalls.createPortHooks('f7-lookup', 'f7-attempt');
    const fetched = jest.fn(async () => jsonResponse());
    const { createProviderHttpPort } = require('../_shared/imageInventory/metadata/providerHttp');
    const port = createProviderHttpPort({
      adapterKey: 'open_library', adapterVersion: '1.0.0', policy: null, maxGets: 6,
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: fetched,
      lookupId: 'f7-lookup', attemptId: 'f7-attempt',
      claim: { jobId: fixture.current().jobId, worker: 'metadata-worker-fixture-0001',
        leaseToken: fixture.current().claimToken, claimAttempt: fixture.current().attempt },
      beforeRequest: async (call: unknown) => hooks.beforeRequest(
        call as { sequence: number; stage: string; signal: AbortSignal }),
      afterRequest: async (callId: string) => hooks.afterRequest(callId, {
        outcome: 'no_acceptable_match', retryable: false,
        physicalStatus: 'finalized', egressStarted: true,
      }),
    });
    // Disabled row: fresh() throws provider_disabled (nonretryable denial).
    await expect(port.get(portCall(
      'https://openlibrary.org/search.json', 'search', 0))).rejects.toMatchObject({
      outcome: 'provider_disabled', retryable: false, egressStarted: false,
    });
    expect(fetched).not.toHaveBeenCalled();
  });
  it('maps construction denial to manual with zero registration', async () => {
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { descriptorOptionsGateway, executeDescriptorOptions } =
      require('./support/providerModules');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    const synthetic = {
      adapterKey: 'synthetic_catalogue', adapterVersion: '1.0.0',
      capabilityVersion: 'synthetic-capability-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      payloadSchemaVersion: 'p9-metadata-v1', lookupSchemaVersion: 'p9-metadata-foundation-v1',
      validationContract: 'synthetic-catalogue-v1', hostPolicyVersion: 'synthetic-hosts-v1',
      protocol: { kind: 'fanout', maxGets: 6 }, retentionContract: 'synthetic-options-v1',
      purposes: ['automatic', 'edition_options'],
      credentialsReady: () => true, retentionReady: () => true,
      invoke: async () => { throw new Error('unreachable'); },
    };
    const { context, gateway } = descriptorOptionsGateway(fixture, synthetic);
    // Force a construction denial: shared_db mode is refused before any GET.
    (gateway as { explicitHttp: { policy: unknown } }).explicitHttp.policy = {
      ...(require('./support/providerProtection').TEST_ONLY_PROTECTION_POLICY),
      mode: 'shared_db',
    };
    await expect(executeDescriptorOptions(context, gateway, synthetic))
      .resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.calls.some((call: { name: string }) =>
      call.name === 'phase9_register_edition_options_provider_call_v1')).toBe(false);
  });
  it('keeps unknown P9_ errors manual without fallback or retry', async () => {
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { descriptorOptionsGateway, executeDescriptorOptions } =
      require('./support/providerModules');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'synthetic_catalogue',
      adapterVersion: '1.0.0', enabled: true, matchingAllowed: true,
      storageAllowed: true, reuseAllowed: true, policyVersion: 1 }];
    const synthetic = {
      adapterKey: 'synthetic_catalogue', adapterVersion: '1.0.0',
      capabilityVersion: 'synthetic-capability-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      payloadSchemaVersion: 'p9-metadata-v1', lookupSchemaVersion: 'p9-metadata-foundation-v1',
      validationContract: 'synthetic-catalogue-v1', hostPolicyVersion: 'synthetic-hosts-v1',
      protocol: { kind: 'fanout', maxGets: 6 }, retentionContract: 'synthetic-options-v1',
      purposes: ['automatic', 'edition_options'],
      credentialsReady: () => true, retentionReady: () => true,
      invoke: async (input: { http: { get: Function } }) => {
        await input.http.get({ url: new URL('https://catalogue.example.test/discover'),
          stage: 'discover', sequence: 0, signal: new AbortController().signal });
        return { version: 'p9-metadata-result-v2', purpose: 'edition_options',
          outcome: { outcome: 'no_acceptable_match', candidates: [], selected: null,
            evidence: [], retryable: true, secondaryEligible: true,
            providerRequestId: null, representativeCover: null },
          rows: null, catalogueCompanions: null, retention: null };
      },
    };
    const { context, gateway } = descriptorOptionsGateway(fixture, synthetic);
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      // Persistent registration failure (replay also fails): uncertain,
      // P9_-coded, never authorized for GET.
      if (name === 'phase9_register_edition_options_provider_call_v1') {
        throw new Error('P9_METADATA_RPC_FAILED:phase9_register_edition_options_provider_call_v1');
      }
      return baseRpc(name, parameters);
    };
    try {
      // Unknown P9_: manual (no retry allowance), no secondary attempt, no GET.
      await expect(executeDescriptorOptions(context, gateway, synthetic))
        .resolves.toEqual({ outcome: 'manual_metadata_required' });
      expect(fixture.calls.some((call: { name: string; parameters: { p_provider_role?: string } }) =>
        call.name === 'phase9_register_structural_metadata_attempt'
        && call.parameters.p_provider_role === 'secondary')).toBe(false);
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });
  it('maps breaker refusal to manual', async () => {
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { descriptorOptionsGateway, executeDescriptorOptions } =
      require('./support/providerModules');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'synthetic_catalogue',
      adapterVersion: '1.0.0', enabled: true, matchingAllowed: true,
      storageAllowed: true, reuseAllowed: true, policyVersion: 1 }];
    const denied = {
      adapterKey: 'synthetic_catalogue', adapterVersion: '1.0.0',
      capabilityVersion: 'synthetic-capability-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      payloadSchemaVersion: 'p9-metadata-v1', lookupSchemaVersion: 'p9-metadata-foundation-v1',
      validationContract: 'synthetic-catalogue-v1', hostPolicyVersion: 'synthetic-hosts-v1',
      protocol: { kind: 'fanout', maxGets: 6 }, retentionContract: 'synthetic-options-v1',
      purposes: ['automatic', 'edition_options'],
      credentialsReady: () => true, retentionReady: () => true,
      invoke: async () => {
        const { ProviderHttpError } = require('../_shared/imageInventory/metadata/providerHttp');
        throw new ProviderHttpError('circuit_breaker_open', false, 'stale_rejected', false, null, null);
      },
    };
    const { context, gateway } = descriptorOptionsGateway(fixture, denied);
    await expect(executeDescriptorOptions(context, gateway, denied))
      .resolves.toEqual({ outcome: 'manual_metadata_required' });
  });
  it('keeps genuine 503 transport failure retryable (positive control)', async () => {
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { descriptorOptionsGateway, executeDescriptorOptions } =
      require('./support/providerModules');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'synthetic_catalogue',
      adapterVersion: '1.0.0', enabled: true, matchingAllowed: true,
      storageAllowed: true, reuseAllowed: true, policyVersion: 1 }];
    const failing = {
      adapterKey: 'synthetic_catalogue', adapterVersion: '1.0.0',
      capabilityVersion: 'synthetic-capability-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      payloadSchemaVersion: 'p9-metadata-v1', lookupSchemaVersion: 'p9-metadata-foundation-v1',
      validationContract: 'synthetic-catalogue-v1', hostPolicyVersion: 'synthetic-hosts-v1',
      protocol: { kind: 'fanout', maxGets: 6 }, retentionContract: 'synthetic-options-v1',
      purposes: ['automatic', 'edition_options'],
      credentialsReady: () => true, retentionReady: () => true,
      invoke: async (input: { http: { get: Function } }) => {
        await input.http.get({ url: new URL('https://catalogue.example.test/discover'),
          stage: 'discover', sequence: 0, signal: new AbortController().signal });
        return { version: 'p9-metadata-result-v2', purpose: 'edition_options',
          outcome: { outcome: 'no_acceptable_match', candidates: [], selected: null,
            evidence: [], retryable: true, secondaryEligible: true,
            providerRequestId: null, representativeCover: null },
          rows: null, catalogueCompanions: null, retention: null };
      },
    };
    const { context, gateway } = descriptorOptionsGateway(fixture, failing);
    const fetched = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', {
      status: 503, headers: { 'content-type': 'application/json' } }));
    try {
      // Genuine transport failure stays retryable (recovery path), unlike denials.
      await expect(executeDescriptorOptions(context, gateway, failing))
        .resolves.toEqual({ outcome: 'retry_scheduled' });
      expect(fetched).toHaveBeenCalledTimes(1);
    } finally {
      fetched.mockRestore();
    }
  });
});

describe('Phase 9 fix1 F14: tuple-bound validator with registry intersection', () => {
  const syntheticBase = {
    adapterKey: 'synthetic_catalogue', adapterVersion: '1.0.0',
    capabilityVersion: 'synthetic-capability-v1',
    normalizerVersion: 'p9-bibliographic-normalizer-v1',
    payloadSchemaVersion: 'p9-metadata-v1', lookupSchemaVersion: 'p9-metadata-foundation-v1',
    validationContract: 'synthetic-catalogue-v1', hostPolicyVersion: 'synthetic-hosts-v1',
    protocol: { kind: 'fanout', maxGets: 6 }, retentionContract: 'synthetic-options-v1',
    purposes: ['automatic', 'edition_options'],
    credentialsReady: () => true, retentionReady: () => true,
  };
  const failurePacket = {
    version: 'p9-metadata-result-v2', purpose: 'edition_options',
    outcome: { outcome: 'provider_unavailable', candidates: [], selected: null, evidence: [],
      retryable: true, secondaryEligible: true, providerRequestId: null, representativeCover: null },
    rows: null, catalogueCompanions: null, retention: null,
  };
  const invokeOk = async (input: { http: { get: Function }; purpose: string }) => {
    if (input.purpose !== 'edition_options') throw new Error('wrong purpose');
    await input.http.get({ url: new URL('https://catalogue.example.test/discover'),
      stage: 'discover', sequence: 0, signal: new AbortController().signal });
    return failurePacket;
  };
  it('refuses changed identifiers before registration', async () => {
    // Mutation caught: non-empty-only identifier check (any changed but
    // non-empty contract would still register and GET).
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { descriptorOptionsGateway, executeDescriptorOptions } =
      require('./support/providerModules');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    const tampered = { ...syntheticBase, validationContract: 'synthetic-catalogue-v2',
      invoke: invokeOk };
    expect(() => descriptorOptionsGateway(fixture, tampered)).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    const tamperedHost = { ...syntheticBase, hostPolicyVersion: 'synthetic-hosts-v2',
      invoke: invokeOk };
    expect(() => descriptorOptionsGateway(fixture, tamperedHost))
      .toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
  });
  it('refuses when the registry row excludes the host, even with valid tuple', async () => {
    // Mutation caught: hardcoded hosts without registry intersection, or the
    // port skipping host intersection for injected validators.
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { descriptorOptionsGateway, executeDescriptorOptions } =
      require('./support/providerModules');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'synthetic_catalogue',
      adapterVersion: '1.0.0', enabled: true, matchingAllowed: true,
      storageAllowed: true, reuseAllowed: true, policyVersion: 1 }];
    const descriptor = { ...syntheticBase, invoke: invokeOk };
    const { context, gateway } = descriptorOptionsGateway(fixture, descriptor,
      { registryRequestHosts: ['other.example.test'] });
    const fetched = jest.fn(async () => new Response(JSON.stringify({ docs: [] }), {
      headers: { 'content-type': 'application/json' } }));
    const realFetch = globalThis.fetch;
    (globalThis as { fetch: unknown }).fetch = fetched;
    try {
      await expect(executeDescriptorOptions(context, gateway, descriptor))
        .resolves.toEqual({ outcome: 'manual_metadata_required' });
      expect(fetched).not.toHaveBeenCalled();
      expect(fixture.calls.some((call: { name: string }) =>
        call.name === 'phase9_register_edition_options_provider_call_v1')).toBe(false);
    } finally {
      (globalThis as { fetch: unknown }).fetch = realFetch;
    }
  });
  it('passes registry intersection with matching row hosts (positive control)', async () => {
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { descriptorOptionsGateway, executeDescriptorOptions } =
      require('./support/providerModules');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'synthetic_catalogue',
      adapterVersion: '1.0.0', enabled: true, matchingAllowed: true,
      storageAllowed: true, reuseAllowed: true, policyVersion: 1 }];
    const descriptor = { ...syntheticBase, invoke: invokeOk };
    const { context, gateway } = descriptorOptionsGateway(fixture, descriptor,
      { registryRequestHosts: ['catalogue.example.test'] });
    const fetched = jest.fn(async () => new Response(
      JSON.stringify({ docs: [{ key: '/works/OL1W' }] }),
      { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } }));
    const realFetch = globalThis.fetch;
    (globalThis as { fetch: unknown }).fetch = fetched;
    try {
      await expect(executeDescriptorOptions(context, gateway, descriptor))
        .resolves.toEqual({ outcome: 'retry_scheduled' });
      expect(fetched).toHaveBeenCalledTimes(1);
    } finally {
      (globalThis as { fetch: unknown }).fetch = realFetch;
    }
  });

  it('applies registry-host intersection even when the validator passes', async () => {
    // Mutation caught: port skipping host intersection for injected
    // validators (validator allows, registry excludes -> must still refuse
    // with zero registration).
    const clock = fakeClock();
    const beforeRequest = jest.fn(async () => ({ callId: CALL_ID, grantEpoch: null }));
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const { createProviderHttpPort } = require('../_shared/imageInventory/metadata/providerHttp');
    const port = createProviderHttpPort({
      adapterKey: 'synthetic_catalogue', adapterVersion: '1.0.0',
      policy: require('./support/providerProtection').TEST_ONLY_PROTECTION_POLICY,
      providerContact: require('./support/providerProtection').TEST_ONLY_PROVIDER_CONTACTS['fixture-contact'],
      maxGets: 6, timeoutMs: 1000, maxResponseBytes: 64000,
      now: clock.now, sleep: clock.sleep,
      fetcher: async () => jsonResponse(),
      lookupId: CALL_ID, attemptId: CALL_ID,
      claim: { jobId: CALL_ID, worker: 'w', leaseToken: 'a'.repeat(64), claimAttempt: 1 },
      beforeRequest, afterRequest,
      requestValidator: (url: URL) => {
        if (url.hostname !== 'catalogue.example.test') throw new Error('insufficient_query');
      },
      requestHosts: ['other.example.test'],
    });
    await expect(port.get({
      url: new URL('https://catalogue.example.test/discover'), stage: 'discover',
      sequence: 0, signal: new AbortController().signal,
    })).rejects.toMatchObject({ outcome: 'insufficient_query' });
    expect(beforeRequest).not.toHaveBeenCalled();
    expect(afterRequest).not.toHaveBeenCalled();
  });
});

describe('Phase 9 fix1 T1: omitted-grant_epoch registration shape', () => {
  it('returns null and performs the GET when the RPC omits grant_epoch', async () => {
    // Mutation caught: a hook requiring the field (every production explicit
    // GET would fail closed — M93:991 returns only provider_call_id/status).
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{
      adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
      matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
    }];
    const { gateway } = fixture.direct({
      explicitDescriptor: { descriptor: { adapterKey: 'open_library', adapterVersion: '1.0.0' } },
    });
    // NEW stub (not the fixture): exact M93 shape, no grant_epoch field.
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      const result = await baseRpc(name, parameters);
      if (name === 'phase9_register_edition_options_provider_call_v1'
        || name === 'phase9_register_metadata_provider_call') {
        const { grant_epoch: _dropped, ...rest } = result.data as Record<string, unknown>;
        return { data: rest, error: null };
      }
      return result;
    };
    try {
      const hooks = gateway.editionProviderCalls.createPortHooks(
        '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201');
      await expect(hooks.beforeRequest({ sequence: 0, stage: 'search',
        signal: new AbortController().signal,
      })).resolves.toEqual({ callId: expect.any(String), grantEpoch: null });
      const { createProviderHttpPort } = require('../_shared/imageInventory/metadata/providerHttp');
      const port = createProviderHttpPort({
        adapterKey: 'open_library', adapterVersion: '1.0.0', policy: null, maxGets: 6,
        timeoutMs: 1000, maxResponseBytes: 64000,
        fetcher: async () => new Response(JSON.stringify({ docs: [] }),
          { headers: { 'content-type': 'application/json' } }),
        lookupId: '00000000-0000-4000-8000-000000000101',
        attemptId: '00000000-0000-4000-8000-000000000201',
        claim: { jobId: fixture.current().jobId, worker: 'metadata-worker-fixture-0001',
          leaseToken: fixture.current().claimToken, claimAttempt: fixture.current().attempt },
        beforeRequest: async (call: unknown) => hooks.beforeRequest(
          call as { sequence: number; stage: string; signal: AbortSignal }),
        afterRequest: async (callId: string) => hooks.afterRequest(callId, {
          outcome: 'no_acceptable_match', retryable: false,
          physicalStatus: 'finalized', egressStarted: true,
        }),
      });
      await expect(port.get({ url: new URL('https://openlibrary.org/search.json'),
        stage: 'search', sequence: 0, signal: new AbortController().signal,
      })).resolves.toMatchObject({ json: { docs: [] } });
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });
});

describe('Phase 9 fix2 H2: production-hook ordering and registration replay', () => {
  const OL_ROW = {
    adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
    matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
  };
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  it('orders limiter, fresh checks, registration, cancel checks, GET, processing, finalize', async () => {
    // Mutation caught: fence reordering (e.g. registration after GET) and a
    // stub-hook test that cannot observe the production fresh/cancel order.
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const { OpenLibraryEditionOptionsAdapter } = require('../_shared/imageInventory/metadata/openLibrary/adapter');
    const { createBridgedPort } = require('../_shared/imageInventory/runtime/metadataEditionOptions');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_ROW];
    const events: string[] = [];
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_metadata_job_context') events.push('fresh');
      if (name === 'phase9_register_edition_options_provider_call_v1') events.push('register');
      if (name === 'phase9_finalize_edition_options_provider_call_v1') events.push('finalize');
      return baseRpc(name, parameters);
    };
    try {
      const { gateway } = fixture.direct();
      const hooks = gateway.editionProviderCalls.createPortHooks(uuid(101), uuid(201));
      const adapter = new OpenLibraryEditionOptionsAdapter({
        timeoutMs: 1000, maxResponseBytes: 64000,
        fetcher: async () => {
          events.push('fetch');
          let first = true;
          return {
            status: 200, ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            body: { getReader: () => ({
              read: async () => {
                if (first) {
                  first = false;
                  events.push('processing');
                  return { done: false, value: new TextEncoder().encode('{"docs":[]}') };
                }
                return { done: true, value: undefined };
              },
              cancel: async () => {},
            }) },
          } as unknown as Response;
        },
      });
      const binding = adapter.transportBinding;
      const port = createBridgedPort({
        adapterKey: 'open_library', adapterVersion: '1.0.0',
        binding: { ...binding, acquireLimiter: async (signal: AbortSignal) => {
          events.push('limiter');
          return binding.acquireLimiter(signal);
        } },
        maxGets: 6, policy: null, lookupId: uuid(101), attemptId: uuid(201),
        claim: { jobId: fixture.current().jobId, worker: 'metadata-worker-fixture-0001',
          leaseToken: fixture.current().claimToken, claimAttempt: fixture.current().attempt },
        hooks,
      });
      const signal = {
        get aborted() { events.push('cancelCheck'); return false; },
        addEventListener() {}, removeEventListener() {},
      } as unknown as AbortSignal;
      const result = await adapter.lookupEditionOptions({
        query: require('./fixtures/phase9/editionOptionsWorker').query,
        correlationId: uuid(101), attemptId: uuid(201), signal, httpPort: port,
      });
      expect(result.outcome).toBe('no_acceptable_match');
      const main = events.filter((event) => event !== 'cancelCheck');
      expect(main).toEqual([
        'limiter', 'fresh', 'register', 'fresh', 'fetch', 'processing', 'finalize',
      ]);
      // A cancellation check runs after the post-registration fresh check and
      // before the actual GET.
      const lastFresh = events.lastIndexOf('fresh');
      const fetchIndex = events.indexOf('fetch');
      expect(events.slice(lastFresh + 1, fetchIndex)).toContain('cancelCheck');
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });

  it('authorizes no GET when production register replays an uncertain registration', async () => {
    // Mutation caught: a test stub that throws instead of exercising
    // createEditionProviderCalls.register's uncertain-registration replay.
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_ROW];
    const { gateway } = fixture.direct();
    const hooks = gateway.editionProviderCalls.createPortHooks(uuid(101), uuid(201));
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    let registerCalls = 0;
    let finalizeCalls = 0;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_register_edition_options_provider_call_v1') {
        registerCalls += 1;
        if (registerCalls === 1) throw new Error('P9_METADATA_RPC_FAILED:register');
      }
      if (name === 'phase9_finalize_edition_options_provider_call_v1') finalizeCalls += 1;
      return baseRpc(name, parameters);
    };
    const fetcher = jest.fn(async () => jsonResponse());
    const port = createProviderHttpPort({
      adapterKey: 'open_library', adapterVersion: '1.0.0', policy: null, maxGets: 6,
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher,
      lookupId: uuid(101), attemptId: uuid(201),
      claim: { jobId: fixture.current().jobId, worker: 'metadata-worker-fixture-0001',
        leaseToken: fixture.current().claimToken, claimAttempt: fixture.current().attempt },
      beforeRequest: async (call: { sequence: number; stage: string; signal: AbortSignal }) =>
        hooks.beforeRequest(call),
      afterRequest: async (callId: string, settled: {
        outcome: string; retryable: boolean; status: string; egressStarted: boolean;
      }) => hooks.afterRequest(callId, { outcome: settled.outcome,
        retryable: settled.retryable, physicalStatus: settled.status,
        egressStarted: settled.egressStarted }),
    });
    try {
      await expect(port.get(portCall(
        'https://openlibrary.org/search.json', 'search', 0))).rejects.toThrow(
        'P9_METADATA_RPC_FAILED:register');
      expect(fetcher).not.toHaveBeenCalled();
      expect(registerCalls).toBe(2);
      expect(finalizeCalls).toBe(1);
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });
});

describe('Phase 9 fix2 G9: pre-grant reservations release only on explicit proof', () => {
  const OL_ROW = {
    adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
    matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
  };
  const portFor = (fixture: { current: () => Record<string, any>;
    dependencies: { serviceClient: { rpc: Function } } },
  hooks: { beforeRequest: Function; afterRequest: Function }, fetched: jest.Mock) => {
    const { createProviderHttpPort } = require('../_shared/imageInventory/metadata/providerHttp');
    return createProviderHttpPort({
      adapterKey: 'open_library', adapterVersion: '1.0.0', policy: null, maxGets: 6,
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: fetched,
      lookupId: '00000000-0000-4000-8000-000000000901',
      attemptId: '00000000-0000-4000-8000-000000000902',
      claim: { jobId: fixture.current().jobId, worker: 'metadata-worker-fixture-0001',
        leaseToken: fixture.current().claimToken, claimAttempt: fixture.current().attempt },
      beforeRequest: async (call: unknown) => hooks.beforeRequest(call),
      afterRequest: async (callId: string, settled: {
        outcome: string; retryable: boolean; status: string; egressStarted: boolean;
      }) => hooks.afterRequest(callId, {
        outcome: settled.outcome, retryable: settled.retryable,
        physicalStatus: settled.status, egressStarted: settled.egressStarted,
      }),
    });
  };
  const searchCall = () => ({ url: new URL('https://openlibrary.org/search.json'),
    stage: 'search', sequence: 0, signal: new AbortController().signal });

  it('permits reuse of the same stage/sequence after a first-fresh provider_disabled denial', async () => {
    // Mutation caught: treating !granted alone as proof (post-registration
    // fresh denial also has no grant yet); the reverse mutation (never
    // releasing a proven pre-registration denial) fails the reuse below.
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [];
    const { gateway } = fixture.direct();
    const hooks = gateway.editionProviderCalls.createPortHooks(
      '00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902');
    const fetched = jest.fn(async () => jsonResponse());
    const port = portFor(fixture, hooks, fetched);
    await expect(port.get(searchCall())).rejects.toMatchObject({
      outcome: 'provider_disabled', egressStarted: false });
    expect(fetched).not.toHaveBeenCalled();
    expect(fixture.calls.some((call: { name: string }) =>
      call.name === 'phase9_register_edition_options_provider_call_v1')).toBe(false);
    fixture.current().providerPolicies = [OL_ROW];
    await expect(port.get(searchCall())).resolves.toMatchObject({ receiptId: expect.any(String) });
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fixture.calls.filter((call: { name: string }) =>
      call.name === 'phase9_register_edition_options_provider_call_v1')).toHaveLength(1);
  });

  it('retains the reservation after a post-registration fresh denial', async () => {
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_ROW];
    const { gateway } = fixture.direct();
    const hooks = gateway.editionProviderCalls.createPortHooks(
      '00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902');
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    let contextReads = 0;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_metadata_job_context') {
        contextReads += 1;
        if (contextReads >= 2) {
          return { data: { ...fixture.current(), providerPolicies: [
            { ...OL_ROW, enabled: false }] }, error: null };
        }
      }
      return baseRpc(name, parameters);
    };
    const fetched = jest.fn(async () => jsonResponse());
    const port = portFor(fixture, hooks, fetched);
    try {
      await expect(port.get(searchCall())).rejects.toMatchObject({
        outcome: 'provider_disabled', egressStarted: false });
      expect(fetched).not.toHaveBeenCalled();
      expect(fixture.physicalCalls).toHaveLength(1);
      expect(fixture.physicalCalls[0].finalized).toBe(true);
      const callsBefore = fixture.calls.length;
      await expect(port.get(searchCall())).rejects.toMatchObject({
        outcome: 'insufficient_query' });
      expect(fixture.calls.length).toBe(callsBefore);
      expect(fetched).not.toHaveBeenCalled();
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });

  it('retains the reservation after uncertain registration and replay', async () => {
    const { editionWorkerFixture } = require('./fixtures/phase9/editionOptionsWorker');
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_ROW];
    const { gateway } = fixture.direct();
    const hooks = gateway.editionProviderCalls.createPortHooks(
      '00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902');
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_register_edition_options_provider_call_v1') {
        throw new Error('P9_METADATA_RPC_FAILED:phase9_register_edition_options_provider_call_v1');
      }
      return baseRpc(name, parameters);
    };
    const fetched = jest.fn(async () => jsonResponse());
    const port = portFor(fixture, hooks, fetched);
    try {
      await expect(port.get(searchCall())).rejects.toThrow(
        'P9_METADATA_RPC_FAILED:phase9_register_edition_options_provider_call_v1');
      const callsBefore = fixture.calls.length;
      await expect(port.get(searchCall())).rejects.toMatchObject({
        outcome: 'insufficient_query' });
      expect(fixture.calls.length).toBe(callsBefore);
      expect(fetched).not.toHaveBeenCalled();
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });

  // A grant returned by beforeRequest means registration happened, even when
  // the grant itself is malformed. Mutation caught: treating the port's own
  // stale_rejected grant refusal as proof of no registration (releases).
  it.each([
    ['an empty callId', { callId: '', grantEpoch: null }],
    ['a non-bigint grantEpoch', { callId: CALL_ID, grantEpoch: '1' }],
  ])('retains the reservation after a malformed grant with %s', async (_label, grant) => {
    let registrations = 0;
    const fetcher = jest.fn(async () => jsonResponse());
    const port = fix1Port(fakeClock(), {
      fetcher,
      beforeRequest: async () => { registrations += 1; return grant; },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    await expect(port.get(portCall('https://openlibrary.org/search.json', 'search', 0)))
      .rejects.toMatchObject({ outcome: 'provider_unavailable', physicalStatus: 'stale_rejected' });
    await expect(port.get(portCall('https://openlibrary.org/search.json', 'search', 0)))
      .rejects.toMatchObject({ outcome: 'insufficient_query' });
    expect(registrations).toBe(1);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('releases the reservation for a marked pre-registration P9_ refusal, keeping its identity', async () => {
    // Mutation caught: requiring a ProviderHttpError before honouring the
    // hook's explicit unregistered proof (a marked P9_ refusal stays held).
    let attempts = 0;
    const fetcher = jest.fn(async () => jsonResponse());
    const port = fix1Port(fakeClock(), {
      fetcher,
      beforeRequest: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw markProviderHttpUnregistered(new Error('P9_METADATA_STALE_PHYSICAL_CALL'));
        }
        return { callId: CALL_ID, grantEpoch: null };
      },
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    await expect(port.get(portCall('https://openlibrary.org/search.json', 'search', 0)))
      .rejects.toThrow('P9_METADATA_STALE_PHYSICAL_CALL');
    expect(fetcher).not.toHaveBeenCalled();
    await expect(port.get(portCall('https://openlibrary.org/search.json', 'search', 0)))
      .resolves.toMatchObject({ receiptId: CALL_ID });
    expect(attempts).toBe(2);
  });
});

describe('Phase 9 fix2 G4: bridge contact is recorded at the actual send', () => {
  const { createBridgedPort } = require('../_shared/imageInventory/runtime/metadataEditionOptions');
  const q = buildMetadataQueryIdentity({
    strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
    isbnClue: null, language: 'en', editionClues: [],
  });
  const claim = { jobId: '00000000-0000-4000-8000-000000000801',
    worker: 'w', leaseToken: 'a'.repeat(64), claimAttempt: 1 };
  const bindingFor = (fetcher: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) => ({
    fetcher, timeoutMs: 1000, maxResponseBytes: 64000,
    acquireLimiter: async () => () => {},
  });
  const hooksFor = (settled: Array<Record<string, unknown>>) => ({
    beforeRequest: async (call: { sequence: number }) => ({
      callId: `call-${call.sequence}`, grantEpoch: null,
    }),
    afterRequest: async (callId: string, s: Record<string, unknown>) => {
      settled.push({ callId, ...s });
      return { receiptId: callId };
    },
  });
  const bridge = (fetcher: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
    shared: object, hooks: ReturnType<typeof hooksFor>) => createBridgedPort({
    adapterKey: 'open_library', adapterVersion: '1.0.0', binding: bindingFor(fetcher),
    maxGets: 6, policy: policy, providerContact: TEST_ONLY_PROVIDER_CONTACTS['fixture-contact'],
    lookupId: 'g4-lookup', attemptId: 'g4-attempt',
    claim, hooks, sharedProtection: shared,
  });
  const resetPacing = (shared: Record<string, unknown>) => {
    shared.lastGetStartMs = null;
  };
  const openBreaker = async (shared: Record<string, unknown>,
    settled: Array<Record<string, unknown>>) => {
    await expect(bridge(async () => new Response('', { status: 503 }), shared, hooksFor(settled))
      .get({ url: new URL('https://openlibrary.org/search.json'), stage: 'search',
        sequence: 0, signal: new AbortController().signal }))
      .rejects.toMatchObject({ outcome: 'provider_unavailable' });
    resetPacing(shared);
    await expect(bridge(async () => new Response('', { status: 503 }), shared, hooksFor(settled))
      .get({ url: new URL('https://openlibrary.org/works/OL1W/editions.json'), stage: 'editions',
        sequence: 1, signal: new AbortController().signal }))
      .rejects.toMatchObject({ outcome: 'provider_unavailable' });
    expect(shared.halfOpenProbeInFlight).toBe(false);
    shared.breakerOpenedAtMs = Date.now() - policy.breakerCooldownMs - 1;
  };

  it('finalizes a synchronously-throwing fetcher as outcome_unknown with egress started', async () => {
    // Mutation caught: marking fetchStarted only after the fetcher returns
    // (a synchronously-throwing fetcher would be recorded as proven-unsent).
    let invoked = 0;
    const settled: Array<Record<string, unknown>> = [];
    const port = createBridgedPort({
      adapterKey: 'open_library', adapterVersion: '1.0.0',
      binding: bindingFor((() => { invoked += 1; throw new Error('sync boom'); }) as never),
      maxGets: 6, policy: null, lookupId: 'g4-lookup', attemptId: 'g4-attempt',
      claim, hooks: hooksFor(settled),
    });
    const { OpenLibraryEditionOptionsAdapter } = require('../_shared/imageInventory/metadata/openLibrary/adapter');
    const adapter = new OpenLibraryEditionOptionsAdapter({ timeoutMs: 1000,
      maxResponseBytes: 64000, fetcher: async () => jsonResponse() });
    await adapter.lookupEditionOptions({ query: q, correlationId: 'g4-lookup',
      attemptId: 'g4-attempt', signal: new AbortController().signal, httpPort: port });
    expect(invoked).toBe(1);
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({
      physicalStatus: 'outcome_unknown', egressStarted: true, outcome: 'network_failure',
      retryable: true,
    });
  });

  it('releases a half-open probe when the bridge cancels before the send', async () => {
    // Mutation caught: counting provider contact before the transport's own
    // permit/abort check (a pre-send cancel would re-open the breaker).
    const shared: Record<string, unknown> = {};
    const settled: Array<Record<string, unknown>> = [];
    await openBreaker(shared, settled);
    resetPacing(shared);
    let reads = 0;
    const signal = {
      get aborted() { reads += 1; return reads >= 3; },
      addEventListener() {}, removeEventListener() {},
    } as unknown as AbortSignal;
    const probe = bridge(async () => { throw new Error('fetcher must not run'); },
      shared, hooksFor(settled));
    await expect(probe.get({ url: new URL('https://openlibrary.org/search.json'),
      stage: 'search', sequence: 0, signal })).rejects.toMatchObject({ outcome: 'cancelled' });
    expect(settled[settled.length - 1]).toMatchObject({
      physicalStatus: 'stale_rejected', egressStarted: false, outcome: 'cancelled',
    });
    expect(shared.halfOpenProbeInFlight).toBe(false);
    resetPacing(shared);
    // Outage ended by the next successful probe (breaker cleared).
    await expect(bridge(async () => jsonResponse(), shared, hooksFor(settled))
      .get({ url: new URL('https://openlibrary.org/works/OL1W/editions.json'),
        stage: 'editions', sequence: 1, signal: new AbortController().signal }))
      .resolves.toMatchObject({ json: { docs: [] } });
    expect(shared.breakerOpenedAtMs).toBeNull();
  });

  it('re-opens the breaker when a half-open probe is contacted and fails (control)', async () => {
    const shared: Record<string, unknown> = {};
    const settled: Array<Record<string, unknown>> = [];
    await openBreaker(shared, settled);
    resetPacing(shared);
    let fetches = 0;
    await expect(bridge(async () => { fetches += 1; return new Response('', { status: 503 }); },
      shared, hooksFor(settled))
      .get({ url: new URL('https://openlibrary.org/search.json'), stage: 'search',
        sequence: 0, signal: new AbortController().signal }))
      .rejects.toMatchObject({ outcome: 'provider_unavailable' });
    expect(fetches).toBe(1);
    expect(shared.halfOpenProbeInFlight).toBe(false);
    resetPacing(shared);
    await expect(bridge(async () => { fetches += 1; return jsonResponse(); },
      shared, hooksFor(settled))
      .get({ url: new URL('https://openlibrary.org/works/OL1W/editions.json'),
        stage: 'editions', sequence: 1, signal: new AbortController().signal }))
      .rejects.toMatchObject({ outcome: 'circuit_breaker_open' });
    expect(fetches).toBe(1);
  });
});
