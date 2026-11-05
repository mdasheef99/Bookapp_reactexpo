// Unit B: identifying User-Agent with the resolved server contact (NEW file;
// no existing test touched). Fake values only; never a real email.
import { getOpenLibraryJson } from '../_shared/imageInventory/metadata/openLibrary/transport';
import { createProviderHttpPort } from '../_shared/imageInventory/metadata/providerHttp';
import {
  parseProtectionPolicyOrNull,
  resolveProtectionContact,
} from '../_shared/imageInventory/runtime/providerProtection';
import { createJsonOperationalLogger } from '../../../workers/phase9-runtime/httpService';
import {
  TEST_ONLY_PROTECTION_POLICY as policy,
  TEST_ONLY_PROVIDER_CONTACTS,
  fakeClock,
} from './support/providerProtection';
import { CALL_ID } from './support/automaticWorker';

const FAKE = TEST_ONLY_PROVIDER_CONTACTS['fixture-contact'];
const SECOND_FAKE = 'second@example.invalid';

const jsonResponse = () => new Response(JSON.stringify({ docs: [] }), {
  headers: { 'content-type': 'application/json' },
});

const transportCall = (fetcher: typeof fetch, providerContact?: string | null) =>
  getOpenLibraryJson(new URL('https://openlibrary.org/search.json'), {
    fetcher, timeoutMs: 1000, maxResponseBytes: 64000,
    ...(providerContact === undefined ? {} : { providerContact }),
  }, { sequence: 0, stage: 'search', signal: new AbortController().signal });

const portConfig = (clock: ReturnType<typeof fakeClock>, fetcher: typeof fetch,
  overrides: Record<string, unknown> = {}) => ({
  adapterKey: 'open_library', adapterVersion: '2.0.0',
  maxGets: 6, timeoutMs: 1000, maxResponseBytes: 64000,
  now: clock.now, sleep: clock.sleep, fetcher,
  lookupId: '00000000-0000-4000-8000-000000000101',
  attemptId: '00000000-0000-4000-8000-000000000201',
  claim: { jobId: '00000000-0000-4000-8000-000000000001',
    worker: 'metadata-worker-fixture-0001', leaseToken: 'a'.repeat(64), claimAttempt: 1 },
  beforeRequest: async () => ({ callId: CALL_ID, grantEpoch: null }),
  afterRequest: async (callId: string) => ({ receiptId: callId }),
  ...overrides,
} as unknown as Parameters<typeof createProviderHttpPort>[0]);

describe('Phase 9 Unit B transport egress contact', () => {
  it('carries the resolved contact on the transport egress (T2)', async () => {
    // Mutation caught: fixing the transport UA literal while the port is updated.
    const fetcher = jest.fn(async () => jsonResponse());
    await transportCall(fetcher, FAKE);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const headers = (fetcher.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
    expect(headers.headers['User-Agent']).toBe('BookConnect edition lookup (ops@example.invalid)');
  });

  it('keeps the legacy literal byte-identical on the transport without a contact (T4 transport half)', async () => {
    // Mutation caught: appending the contact (or any suffix) on the legacy path.
    const fetcher = jest.fn(async () => jsonResponse());
    await transportCall(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const headers = (fetcher.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
    expect(headers.headers['User-Agent']).toBe('BookConnect edition lookup');
  });
});

describe('Phase 9 Unit B contact resolution and routing', () => {
  it('resolves each mapped id to its own value and NULL policy to NULL (T7/T8)', async () => {
    // Mutation caught: always using the first/only mapping (cross-wiring).
    const contacts = { 'fixture-contact': FAKE, 'other-id': SECOND_FAKE };
    const parsed = parseProtectionPolicyOrNull(policy);
    expect(parsed).not.toBeNull();
    expect(resolveProtectionContact(parsed, contacts)).toBe(FAKE);
    expect(resolveProtectionContact(
      { ...(parsed as object), contactId: 'other-id' } as Parameters<typeof resolveProtectionContact>[0],
      contacts,
    )).toBe(SECOND_FAKE);
    // T8: NULL policy resolves to NULL even with a populated map (legacy literal).
    expect(resolveProtectionContact(null, contacts)).toBeNull();
    expect(resolveProtectionContact(null, {})).toBeNull();
    // The right contact reaches the wire for each claim.
    for (const contact of [FAKE, SECOND_FAKE]) {
      const clock = fakeClock();
      const fetcher = jest.fn(async () => jsonResponse());
      const port = createProviderHttpPort(portConfig(clock, fetcher, { policy, providerContact: contact }));
      await expect(port.get({
        url: new URL('https://openlibrary.org/search.json'), sequence: 0,
        stage: 'search', signal: new AbortController().signal,
      })).resolves.toMatchObject({ receiptId: CALL_ID });
      expect(fetcher).toHaveBeenCalledTimes(1);
      const init = (fetcher.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
      expect(init.headers['User-Agent']).toBe(`BookConnect edition lookup (${contact})`);
    }
  });

  it('fails closed when a non-NULL policy contact has no mapping', async () => {
    // Mutation caught: falling back to the literal (or any default) on unresolved contact.
    const parsed = parseProtectionPolicyOrNull(policy);
    expect(parsed).not.toBeNull();
    expect(() => resolveProtectionContact(parsed, {})).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(() => resolveProtectionContact(parsed, { 'other-id': SECOND_FAKE }))
      .toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(() => createProviderHttpPort(
      portConfig(fakeClock(), async () => jsonResponse(), { policy }),
    )).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
  });
});

describe('Phase 9 Unit B contact privacy', () => {
  it('never leaks the resolved value into logs, errors or hook payloads (T6)', async () => {
    // Mutation caught: logging/persisting/returning the resolved contact.
    const lines: string[] = [];
    const log = createJsonOperationalLogger((line: string) => { lines.push(line); });
    log({ event: 'invocation_completed', service: 'phase9-metadata-worker', status: 200,
      batchSize: 1, claimed: 1, outcomes: ['accepted_metadata_match'], durationMs: 1 });
    const clock = fakeClock();
    const fetcher = jest.fn(async () => jsonResponse());
    const afterRequest = jest.fn(async (callId: string) => ({ receiptId: callId }));
    const port = createProviderHttpPort(portConfig(clock, fetcher,
      { policy, providerContact: FAKE, afterRequest }));
    await expect(port.get({
      url: new URL('https://openlibrary.org/search.json'), sequence: 0,
      stage: 'search', signal: new AbortController().signal,
    })).resolves.toMatchObject({ receiptId: CALL_ID });
    await transportCall(jest.fn(async () => jsonResponse()), FAKE);
    // An error message from a contact-carrying port carries no contact.
    const denied = await port.get({
      url: new URL('https://openlibrary.org/search.json'), sequence: 0,
      stage: 'search', signal: new AbortController().signal,
    }).then(() => null, (error: unknown) => String(error));
    expect(denied).not.toBeNull();
    // The wire headers are the intended destination and are excluded here;
    // everything else must be free of the fake value.
    for (const line of [...lines, JSON.stringify(afterRequest.mock.calls), denied as string]) {
      expect(line).not.toContain(FAKE);
    }
    expect(lines).toHaveLength(1);
  });
});
