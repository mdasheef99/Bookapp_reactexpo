// U6 step 2: ProviderHttpPort boundary tests (NEW file; no existing test touched).
// Each negative has a positive control differing only in the defect.
import { createProviderHttpPort } from '../_shared/imageInventory/metadata/providerHttp';
import {
  parseProtectionPolicyOrNull,
  parseRetryAfterMs,
  createProtectionState,
} from '../_shared/imageInventory/runtime/providerProtection';
import { TEST_ONLY_PROTECTION_POLICY as policy, TEST_ONLY_PROVIDER_CONTACTS, fakeClock } from './support/providerProtection';
import { CALL_ID } from './support/automaticWorker';

const staged = [
  { sequence: 0, stage: 'search', url: 'https://openlibrary.org/search.json' },
  { sequence: 1, stage: 'editions', url: 'https://openlibrary.org/works/OL1W/editions.json' },
  { sequence: 2, stage: 'author:OL1A', url: 'https://openlibrary.org/authors/OL1A.json' },
] as const;
const call = (ordinal = 0) => ({
  url: new URL(staged[ordinal].url), sequence: staged[ordinal].sequence,
  stage: staged[ordinal].stage, signal: new AbortController().signal,
});
const jsonResponse = () => new Response(JSON.stringify({ docs: [] }), {
  headers: { 'content-type': 'application/json' },
});
const baseConfig = (clock: ReturnType<typeof fakeClock>, overrides: Record<string, unknown> = {}) => ({
  adapterKey: 'open_library', adapterVersion: '2.0.0',
  policy, providerContact: TEST_ONLY_PROVIDER_CONTACTS['fixture-contact'],
  maxGets: 6, timeoutMs: 1000, maxResponseBytes: 64000,
  now: clock.now, sleep: clock.sleep, fetcher: async () => jsonResponse(),
  lookupId: '00000000-0000-4000-8000-000000000101',
  attemptId: '00000000-0000-4000-8000-000000000201',
  claim: { jobId: '00000000-0000-4000-8000-000000000001',
    worker: 'metadata-worker-fixture-0001', leaseToken: 'a'.repeat(64), claimAttempt: 1 },
  ...overrides,
} as unknown as Parameters<typeof createProviderHttpPort>[0]);

describe('Phase 9 ProviderHttpPort U6 boundaries', () => {
  it('works with grantEpoch null (production shape) and 1n (test shape) identically', async () => {
    for (const grantEpoch of [null, 1n]) {
      const clock = fakeClock();
      const fetcher = jest.fn(async () => jsonResponse());
      const afterRequest = jest.fn(async () => ({ receiptId: CALL_ID }));
      const port = createProviderHttpPort(baseConfig(clock, {
        fetcher,
        beforeRequest: async () => ({ callId: CALL_ID, grantEpoch }),
        afterRequest,
      }));
      await expect(port.get(call(0))).resolves.toMatchObject({ json: { docs: [] }, receiptId: CALL_ID });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(afterRequest).toHaveBeenCalledWith(CALL_ID, {
        status: 'finalized', egressStarted: true, outcome: 'no_acceptable_match',
        retryable: false, providerRequestId: null,
      });
    }
  });

  it('refuses a fabricated finalization receipt instead of inventing one', async () => {
    const clock = fakeClock();
    const port = createProviderHttpPort(baseConfig(clock, {
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      // Positive control differs only here: a mapped receipt passes.
      afterRequest: async () => ({}) as unknown as { receiptId: string },
    }));
    await expect(port.get(call(0))).rejects.toMatchObject({ outcome: 'provider_unavailable' });
    const control = createProviderHttpPort(baseConfig(clock, {
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    }));
    await expect(control.get(call(1))).resolves.toMatchObject({ receiptId: CALL_ID });
  });

  it('enforces the compiled request-host intersection before registration', async () => {
    const clock = fakeClock();
    const beforeRequest = jest.fn(async () => ({ callId: CALL_ID, grantEpoch: null }));
    const port = createProviderHttpPort(baseConfig(clock, {
      beforeRequest, afterRequest: async (callId: string) => ({ receiptId: callId }),
      requestHosts: ['openlibrary.org'],
    }));
    await expect(port.get(call(0))).resolves.toMatchObject({ receiptId: CALL_ID });
    expect(beforeRequest).toHaveBeenCalledTimes(1);
    // T3: host-only variation — same valid path/stage/sequence, other host —
    // so only the host check can refuse.
    await expect(port.get({
      url: new URL('https://elsewhere.example.test/works/OL1W/editions.json'),
      stage: 'editions', sequence: 1, signal: new AbortController().signal,
    })).rejects.toMatchObject({ outcome: 'insufficient_query' });
    expect(beforeRequest).toHaveBeenCalledTimes(1);
  });

  it('refuses shared_db without any registration', async () => {
    const clock = fakeClock();
    const beforeRequest = jest.fn(async () => ({ callId: CALL_ID }));
    expect(() => createProviderHttpPort(baseConfig(clock, {
      policy: { ...policy, mode: 'shared_db' }, beforeRequest,
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    }))).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(beforeRequest).not.toHaveBeenCalled();
  });

  it('rejects a reused sequence or a reused stage, including concurrent calls', async () => {
    const clock = fakeClock();
    let fetches = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const beforeRequest = jest.fn(async () => ({
      callId: `call-${fetches}`, grantEpoch: null }));
    const port = createProviderHttpPort(baseConfig(clock, {
      fetcher: async () => { fetches += 1; await held; return jsonResponse(); },
      beforeRequest,
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    }));
    const first = port.get(call(0));
    // Flush until the first fetch actually starts (deterministic: the
    // duplicate rejections below must race an in-flight GET, not startup).
    for (let i = 0; i < 1000 && fetches !== 1; i += 1) await Promise.resolve();
    expect(fetches).toBe(1);
    expect(beforeRequest).toHaveBeenCalledTimes(1);
    // T4: rejection happens synchronously before any async work — zero
    // further registrations, exact refusal identity.
    await expect(port.get(call(0))).rejects.toMatchObject({ outcome: 'insufficient_query' });
    await expect(port.get({
      url: new URL('https://openlibrary.org/search.json?x=1'),
      stage: 'search', sequence: 4, signal: new AbortController().signal,
    })).rejects.toMatchObject({ outcome: 'insufficient_query' });
    expect(beforeRequest).toHaveBeenCalledTimes(1);
    expect(fetches).toBe(1);
    release();
    await first;
    expect(fetches).toBe(1);
    expect(beforeRequest).toHaveBeenCalledTimes(1);
  });

  it('records a proven-unsent finalization when cancelled after a confirmed grant', async () => {
    const clock = fakeClock();
    const controller = new AbortController();
    const fetcher = jest.fn(async () => jsonResponse());
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = createProviderHttpPort(baseConfig(clock, {
      fetcher,
      beforeRequest: async () => { controller.abort(); return { callId: CALL_ID, grantEpoch: null }; },
      afterRequest,
    }));
    await expect(port.get({ ...call(0), signal: controller.signal })).rejects.toMatchObject({
      outcome: 'cancelled', retryable: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(afterRequest).toHaveBeenCalledWith(CALL_ID, {
      status: 'stale_rejected', egressStarted: false, outcome: 'cancelled',
      retryable: false, providerRequestId: null,
    });
  });

  it('surfaces Retry-After observations with headers without scheduling', async () => {
    const clock = fakeClock();
    const port = createProviderHttpPort(baseConfig(clock, {
      fetcher: async () => new Response('', { status: 429, headers: { 'retry-after': '120' } }),
      beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    }));
    const failure = await port.get(call(0)).then(() => null, (error) => error) as {
      outcome: string; retryAfterMs: number; headers: Headers | null;
    };
    expect(failure?.outcome).toBe('rate_limited');
    expect(failure?.retryAfterMs).toBe(120000);
    expect(failure?.headers?.get('retry-after')).toBe('120');
  });

  it('runs fencing-only legacy mode on a NULL policy', async () => {
    const clock = fakeClock();
    const port = createProviderHttpPort(baseConfig(clock, {
      policy: null,
      beforeRequest: async () => ({ callId: CALL_ID }),
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    }));
    await expect(port.get(call(0))).resolves.toMatchObject({ receiptId: CALL_ID });
    await expect(port.get(call(1))).resolves.toMatchObject({ receiptId: CALL_ID });
  });
});

describe('Phase 9 provider protection parsing', () => {
  it('keeps NULL as legacy and rejects malformed policies without invented numbers', () => {
    expect(parseProtectionPolicyOrNull(null)).toBeNull();
    expect(parseProtectionPolicyOrNull(policy)).toMatchObject({ mode: 'single_instance', halfOpenMax: 1 });
    expect(() => parseProtectionPolicyOrNull({ ...policy, halfOpenMax: 2 }))
      .toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(() => parseProtectionPolicyOrNull(
      { ...policy, backoffBaseMs: 500, backoffMaxMs: 100 }))
      .toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(() => parseProtectionPolicyOrNull({ ...policy, minIntervalMs: 0 }))
      .toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(() => parseProtectionPolicyOrNull({ ...policy, extra: 1 }))
      .toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(createProtectionState()).toMatchObject({
      lastGetStartMs: null, failureAtMs: [], breakerOpenedAtMs: null, halfOpenProbeInFlight: false,
    });
  });

  it('parses Retry-After floors without an invented upper cutoff', () => {
    expect(parseRetryAfterMs('120', 1000)).toBe(121000);
    expect(parseRetryAfterMs('Mon, 02 Nov 2026 12:01:00 GMT', 1000))
      .toBe(Date.parse('Mon, 02 Nov 2026 12:01:00 GMT'));
    expect(parseRetryAfterMs('not-a-date', 1000)).toBeNull();
    expect(parseRetryAfterMs('-1', 1000)).toBeNull();
    expect(parseRetryAfterMs('999999999999999999999999', 1000)).toBeNull();
    expect(parseRetryAfterMs(null, 1000)).toBeNull();
  });
});

// Unit B: identifying User-Agent with the resolved server contact (NEW
// describes only; no existing test touched).
describe('Phase 9 Unit B identifying User-Agent on the native port egress', () => {
  it('carries the resolved contact on the native port egress (T1)', async () => {
    // Mutation caught: reverting fetchOnce to the fixed literal UA.
    const clock = fakeClock();
    let captured: Record<string, string> = {};
    const fetcher = jest.fn(async (_input: unknown, init?: { headers?: Record<string, string> }) => {
      captured = { ...(init?.headers ?? {}) };
      return jsonResponse();
    });
    const beforeRequest = jest.fn(async () => ({ callId: CALL_ID, grantEpoch: null }));
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = createProviderHttpPort(baseConfig(clock, { fetcher, beforeRequest, afterRequest }));
    await expect(port.get(call(0))).resolves.toMatchObject({ receiptId: CALL_ID });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(beforeRequest).toHaveBeenCalledTimes(1);
    expect(afterRequest).toHaveBeenCalledTimes(1);
    expect(captured['User-Agent']).toBe('BookConnect edition lookup (ops@example.invalid)');
  });

  it('keeps the legacy literal byte-identical when the policy is NULL (T4 port half)', async () => {
    // Mutation caught: appending the contact (or any suffix) on the legacy path.
    const clock = fakeClock();
    let captured: Record<string, string> = {};
    const fetcher = jest.fn(async (_input: unknown, init?: { headers?: Record<string, string> }) => {
      captured = { ...(init?.headers ?? {}) };
      return jsonResponse();
    });
    const beforeRequest = jest.fn(async () => ({ callId: CALL_ID, grantEpoch: null }));
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = createProviderHttpPort(baseConfig(clock, {
      policy: null, providerContact: null, fetcher, beforeRequest, afterRequest,
    }));
    await expect(port.get(call(0))).resolves.toMatchObject({ receiptId: CALL_ID });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(captured['User-Agent']).toBe('BookConnect edition lookup');
  });
});
