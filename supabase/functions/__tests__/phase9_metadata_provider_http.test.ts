// 02c ??5.1/5.4/9 AC8-5/11. Port tests observe GET/fencing effects;
// retry scheduling is tested at the durable worker/RPC boundary separately.
import { createTestHttpPort } from './support/providerModules';
import { TEST_ONLY_PROTECTION_POLICY as policy, TEST_ONLY_PROVIDER_CONTACTS, fakeClock } from './support/providerProtection';
import { CALL_ID } from './support/automaticWorker';

// M91 stage/sequence grammar: search=0, editions/edition=1, authors=2..5.
const staged = [
  { sequence: 0, stage: 'search', url: 'https://openlibrary.org/search.json' },
  { sequence: 1, stage: 'editions', url: 'https://openlibrary.org/works/OL1W/editions.json' },
  { sequence: 2, stage: 'author:OL1A', url: 'https://openlibrary.org/authors/OL1A.json' },
  { sequence: 3, stage: 'author:OL2A', url: 'https://openlibrary.org/authors/OL2A.json' },
  { sequence: 4, stage: 'author:OL3A', url: 'https://openlibrary.org/authors/OL3A.json' },
  { sequence: 5, stage: 'author:OL4A', url: 'https://openlibrary.org/authors/OL4A.json' },
] as const;
const call = (ordinal = 0) => ({
  url: new URL(staged[ordinal].url), sequence: staged[ordinal].sequence,
  stage: staged[ordinal].stage, signal: new AbortController().signal,
});
const jsonResponse = () => new Response(JSON.stringify({ docs: [] }), {
  headers: { 'content-type': 'application/json' },
});
function createPort(clock: ReturnType<typeof fakeClock>, overrides: Record<string, unknown> = {}) {
  let ordinal = 0;
  const beforeRequest = jest.fn(async () => ({ callId: ordinal++ === 0 ? CALL_ID
    : `00000000-0000-4000-8000-${String(ordinal + 100).padStart(12, '0')}`, grantEpoch: 1n }));
  const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
  const port = createTestHttpPort({
    adapterKey: 'open_library', adapterVersion: '2.0.0',
    policy, providerContact: TEST_ONLY_PROVIDER_CONTACTS['fixture-contact'],
    maxGets: 6, timeoutMs: 1000, maxResponseBytes: 64000,
    now: clock.now, sleep: clock.sleep, fetcher: async () => jsonResponse(),
    beforeRequest, afterRequest, ...overrides,
  });
  return { port, beforeRequest, afterRequest };
}
const until = async (predicate: () => boolean) => {
  for (let i = 0; i < 100 && !predicate(); i++) await Promise.resolve();
  expect(predicate()).toBe(true);
};

describe('Phase 9 ProviderHttpPort effects', () => {
  it('paces fenced requests using the explicit test policy and injected clock', async () => {
    const clock = fakeClock(); const fetchedAt: number[] = [];
    const { port, beforeRequest, afterRequest } = createPort(clock, {
      fetcher: async () => { fetchedAt.push(clock.now()); return jsonResponse(); },
    });
    await expect(port.get(call(0))).resolves.toMatchObject({ json: { docs: [] }, receiptId: CALL_ID });
    // Sequence 1 is the M91 'editions' step after a finalized 'search'.
    await port.get(call(1));
    expect(fetchedAt).toEqual([0, policy.minIntervalMs]);
    expect(beforeRequest).toHaveBeenCalledTimes(2);
    expect(afterRequest).toHaveBeenCalledWith(CALL_ID, expect.objectContaining({
      status: 'finalized', egressStarted: true, retryable: false,
    }));
  });

  it('allows only one concurrent half-open probe and closes the breaker after its success', async () => {
    const clock = fakeClock(); let fetches = 0; let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const sharedFetcher = async () => {
      fetches++;
      if (fetches <= policy.breakerFailures) return new Response('', { status: 503 });
      if (fetches === policy.breakerFailures + 1) await held;
      return jsonResponse();
    };
    // M91-valid distinct claim identities: each breaker failure is the first
    // GET (search/sequence 0) of a separate claim with distinct claim, lookup
    // and attempt UUIDs. Breaker state is shared via ONE object across claims.
    const breakerState = {};
    const leaseTokens = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64),
      'd'.repeat(64), 'e'.repeat(64), 'f'.repeat(64)];
    const pad12 = (n: number) => String(n).padStart(12, '0');
    const claimPort = (index: number) => {
      const lookupId = `00000000-0000-4000-8000-${pad12(110 + index)}`;
      const attemptId = `00000000-0000-4000-8000-${pad12(210 + index)}`;
      const jobId = `00000000-0000-4000-8000-${pad12(310 + index)}`;
      const callId = `00000000-0000-4000-8000-${pad12(410 + index)}`;
      const beforeRequest = jest.fn(async () => ({ callId, grantEpoch: 1n }));
      const afterRequest = jest.fn(async (id: string) => ({ receiptId: id }));
      return createTestHttpPort({
        adapterKey: 'open_library', adapterVersion: '2.0.0',
        policy, providerContact: TEST_ONLY_PROVIDER_CONTACTS['fixture-contact'],
        maxGets: 6, timeoutMs: 1000, maxResponseBytes: 64000,
        now: clock.now, sleep: clock.sleep, fetcher: sharedFetcher,
        beforeRequest, afterRequest,
        lookupId, attemptId,
        claim: { jobId, worker: 'metadata-worker-fixture-0001',
          leaseToken: leaseTokens[index % leaseTokens.length], claimAttempt: 1 },
        breakerState,
      });
    };
    await expect(claimPort(0).get(call(0))).rejects.toBeDefined();
    await expect(claimPort(1).get(call(0))).rejects.toBeDefined();
    await expect(claimPort(2).get(call(0))).rejects.toBeDefined();
    expect(fetches).toBe(2);
    clock.advance(policy.breakerCooldownMs);
    const probe = claimPort(3).get(call(0));
    try {
      await until(() => fetches === 3);
      // The first probe is still in flight, so this really is concurrent.
      await expect(claimPort(4).get(call(0))).rejects.toBeDefined();
      expect(fetches).toBe(3);
    } finally { release(); await probe; }
    await claimPort(5).get(call(0));
    expect(fetches).toBe(4);
  });

  it('finalizes a known 429 once and never retries HTTP within the port', async () => {
    const clock = fakeClock(); const fetcher = jest.fn(async () => new Response('', {
      status: 429, headers: { 'retry-after': '120' },
    }));
    const { port, beforeRequest, afterRequest } = createPort(clock, { fetcher });
    await expect(port.get(call(0))).rejects.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(beforeRequest).toHaveBeenCalledTimes(1);
    expect(afterRequest).toHaveBeenCalledWith(CALL_ID, {
      status: 'finalized', egressStarted: true, outcome: 'rate_limited',
      retryable: true, providerRequestId: null,
    });
  });

  it('durably marks an uncertain send without inventing an unsent receipt or retrying GET', async () => {
    const fetcher = jest.fn(async () => { throw new Error('fixture reset after send'); });
    const { port, afterRequest } = createPort(fakeClock(), { fetcher });
    await expect(port.get(call(0))).rejects.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(afterRequest).toHaveBeenCalledWith(CALL_ID, {
      status: 'outcome_unknown', egressStarted: true, outcome: 'network_failure',
      retryable: true, providerRequestId: null,
    });
  });

  it('rejects an out-of-range sequence and an oversized stage without any GET', async () => {
    const fetcher = jest.fn(async () => jsonResponse());
    const { port, afterRequest } = createPort(fakeClock(), { fetcher });
    await expect(port.get({ ...call(0), sequence: 6 })).rejects.toBeDefined();
    await expect(port.get({ ...call(0), stage: 'a'.repeat(129) })).rejects.toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
    expect(afterRequest).not.toHaveBeenCalled();
  });

  it('attempts registration but sends no GET or fabricated finalization after grant refusal', async () => {
    const fetcher = jest.fn(async () => jsonResponse());
    const beforeRequest = jest.fn(async () => { throw new Error('P9_EXTERNAL_ADMISSION_PAUSED'); });
    const afterRequest = jest.fn(async () => ({ receiptId: CALL_ID }));
    const { port } = createPort(fakeClock(), { fetcher, beforeRequest, afterRequest });
    await expect(port.get(call(0))).rejects.toBeDefined();
    expect(beforeRequest).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled(); expect(afterRequest).not.toHaveBeenCalled();
  });
});
