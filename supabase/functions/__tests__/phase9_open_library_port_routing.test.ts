// U6 step 3: O1 retention-header binding (R2) + S3 routed-v1 bridge parity
// (NEW file; no existing test touched). Each negative has a positive control
// differing only in the defect.
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { invokeOpenLibraryV2 } from '../_shared/imageInventory/metadata/openLibrary/automatic';
import { createProviderHttpPort, ProviderHttpError } from '../_shared/imageInventory/metadata/providerHttp';
import { TEST_ONLY_PROTECTION_POLICY, fakeClock } from './support/providerProtection';

const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: null, language: 'en', editionClues: [],
});
const editionEntry = {
  key: '/books/OL100M', title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
  languages: [{ key: '/languages/eng' }], publish_date: '2024', publishers: ['Fixture Press'],
};
const json = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json', ...headers },
});
// Failing author content failure (nonretryable, isolated) with caller-chosen headers.
const failingAuthor = (headers: Record<string, string> = {}) => () => new Response('invalid', {
  headers: { 'content-type': 'text/html', ...headers },
});
function v1Adapter(author: () => Response) {
  return new OpenLibraryEditionOptionsAdapter({
    timeoutMs: 1000, maxResponseBytes: 64000,
    fetcher: async (address) => {
      const path = new URL(String(address)).pathname;
      if (path === '/search.json') return json({ docs: [{ key: '/works/OL1W' }] });
      if (path === '/works/OL1W/editions.json') return json({ entries: [editionEntry] });
      if (path === '/authors/OL1A.json') return author();
      throw new Error('unexpected ' + path);
    },
  });
}
const v1Lookup = (adapter: OpenLibraryEditionOptionsAdapter) => adapter.lookupEditionOptions({
  query, correlationId: 'o1-lookup', attemptId: 'o1-attempt', signal: new AbortController().signal,
});

describe('Phase 9 failed-response retention binding (O1)', () => {
  it('v1: failed-author no-store denies retention while permissive headers keep it', async () => {
    const denied = await v1Lookup(v1Adapter(failingAuthor({ 'cache-control': 'no-store' })));
    expect(denied.rows[0]).toMatchObject({ eligibility: 'unavailable', metadata: null });
    expect(denied.retentionEvidence).toBeNull();
    const control = await v1Lookup(v1Adapter(failingAuthor()));
    expect(control.rows[0]).toMatchObject({ eligibility: 'unavailable', metadata: null });
    expect(control.retentionEvidence).not.toBeNull();
    expect(control.retentionEvidence?.storagePermissionVerified).toBe(true);
  });

  it('v2: failed-author no-store denies retention while permissive headers keep it', async () => {
    const run = async (authorHeaders: Record<string, string>) => {
      const http = {
        get: async ({ url, stage, sequence, signal }: {
          url: URL; stage: string; sequence: number; signal: AbortSignal;
        }) => {
          void sequence; void signal;
          if (url.pathname === '/search.json') {
            return { json: { docs: [{ key: '/works/OL1W' }] }, headers: new Headers() };
          }
          if (url.pathname === '/works/OL1W/editions.json') {
            return { json: { entries: [editionEntry] }, headers: new Headers() };
          }
          throw new ProviderHttpError('unsupported_content_type', false, 'finalized', true,
            new Headers({ 'content-type': 'text/html', ...authorHeaders }), null);
        },
      };
      return invokeOpenLibraryV2({
        query, correlationId: 'o1-lookup', attemptId: 'o1-attempt',
        signal: new AbortController().signal, purpose: 'edition_options', http: http as never,
        version: 'p9-metadata-result-v2', policyVersion: 1,
        retentionContract: 'open-library-options-v1',
      });
    };
    const denied = await run({ 'cache-control': 'no-store' });
    expect(denied.rows).toBeNull();
    expect(denied.retention).toBeNull();
    const control = await run({});
    expect(control.retention).not.toBeNull();
    expect(control.rows).toHaveLength(1);
    expect(control.rows?.[0]).toMatchObject({ eligibility: 'unavailable', metadata: null });
  });
});

describe('Phase 9 routed-v1 bridge parity (S3/T6)', () => {
  it('routes v1 through the production fenced bridge with identical results', async () => {
    // T6: uses the production createBridgedPort (not a re-implementation);
    // compares outcome, retryable, providerRequestId, rows, companions,
    // fetchedAt and retention, plus every afterRequest settled payload.
    const { createBridgedPort } = require('../_shared/imageInventory/runtime/metadataEditionOptions');
    const direct = await v1Lookup(v1Adapter(failingAuthor()));
    const adapter = v1Adapter(failingAuthor());
    const binding = adapter.transportBinding;
    const registered: Array<{ sequence: number; stage: string }> = [];
    const settled: Array<{ callId: string; outcome: string; retryable: boolean;
      physicalStatus: string; egressStarted: boolean }> = [];
    const port = createBridgedPort({ adapterKey: 'open_library', adapterVersion: '1.0.0',
      binding, maxGets: 6, policy: null,
      lookupId: 'o1-lookup', attemptId: 'o1-attempt',
      claim: { jobId: 'o1-job', worker: 'o1-worker',
        leaseToken: 'a'.repeat(64), claimAttempt: 1 },
      hooks: {
        beforeRequest: async (call: { sequence: number; stage: string }) => {
          registered.push({ sequence: call.sequence, stage: call.stage });
          return { callId: `call-${call.sequence}`, grantEpoch: null };
        },
        afterRequest: async (callId: string, s: { outcome: string; retryable: boolean;
          physicalStatus: 'finalized' | 'outcome_unknown' | 'stale_rejected'; egressStarted: boolean }) => {
          settled.push({ callId, ...s });
          return { receiptId: callId };
        },
      } });
    const routed = await adapter.lookupEditionOptions({
      query, correlationId: 'o1-lookup', attemptId: 'o1-attempt',
      signal: new AbortController().signal, httpPort: port,
    });
    // T6 (H1): only genuinely minted fields (optionId, clock timestamps and
    // the derived deadline) are scrubbed; correlation/attempt lineage is the
    // SAME input on both runs and must match exactly.
    const scrub = (result: { outcome: unknown; retryable: unknown; providerRequestId: unknown;
      rows: Array<Record<string, unknown>>; fetchedAt: unknown; retentionEvidence: unknown;
      catalogueCompanions: unknown }) => ({
      outcome: result.outcome, retryable: result.retryable,
      providerRequestId: result.providerRequestId,
      rows: result.rows.map((row) => ({
        ...row, optionId: 'scrubbed',
        metadata: row.metadata === null ? null : {
          ...(row.metadata as Record<string, unknown>), fetchedAt: 'scrubbed',
        },
      })),
      catalogueCompanions: JSON.parse(JSON.stringify(result.catalogueCompanions ?? null,
        (key, value) => key === 'fetchedAt' ? 'scrubbed' : value)),
      fetchedAt: 'scrubbed',
      retentionEvidence: result.retentionEvidence === null ? null : {
        ...(result.retentionEvidence as Record<string, unknown>), permittedDeadlineAt: 'scrubbed',
      },
    });
    expect(scrub(routed as never)).toEqual(scrub(direct as never));
    // Exact lineage: both runs use the same lookup/attempt identity.
    for (const row of routed.rows) {
      if (row.metadata !== null) {
        expect(row.metadata.correlationId).toBe('o1-lookup');
        expect(row.metadata.attemptId).toBe('o1-attempt');
      }
    }
    expect(registered).toEqual([
      { sequence: 0, stage: 'search' },
      { sequence: 1, stage: 'editions' },
      { sequence: 2, stage: 'author:OL1A' },
    ]);
    expect(settled).toEqual([
      { callId: 'call-0', physicalStatus: 'finalized', outcome: 'no_acceptable_match',
        retryable: false, egressStarted: true },
      { callId: 'call-1', physicalStatus: 'finalized', outcome: 'no_acceptable_match',
        retryable: false, egressStarted: true },
      { callId: 'call-2', physicalStatus: 'finalized', outcome: 'unsupported_content_type',
        retryable: false, egressStarted: true },
    ]);
  });
});

describe('Phase 9 fix1 T5: denial stays sticky across later permissive responses', () => {
  // Same lookup, real transports: a failed author carrying no-store denies
  // retention even though a LATER author response is permissive. Not separate
  // lookups, not fabricated transport errors.
  const secondEdition = { ...editionEntry, key: '/books/OL101M', authors: [{ key: '/authors/OL2A' }] };
  const twoAuthorFetcher = (badHeaders: Record<string, string>) => async (address: unknown) => {
    const path = new URL(String(address)).pathname;
    if (path === '/search.json') return json({ docs: [{ key: '/works/OL1W' }] });
    if (path === '/works/OL1W/editions.json') return json({ entries: [editionEntry, secondEdition] });
    if (path === '/authors/OL1A.json') return failingAuthor(badHeaders)();
    if (path === '/authors/OL2A.json') {
      return json({ key: '/authors/OL2A', name: 'Fixture Author' },
        { 'cache-control': 'max-age=86400' });
    }
    throw new Error('unexpected ' + path);
  };
  const stubHooks = () => ({
    beforeRequest: async () => ({ callId: 't5-call', grantEpoch: null }),
    afterRequest: async (callId: string) => ({ receiptId: callId }),
  });
  it('v1 bridge: no-store denial survives a later permissive author', async () => {
    const { createBridgedPort } = require('../_shared/imageInventory/runtime/metadataEditionOptions');
    const run = async (badHeaders: Record<string, string>) => {
      const adapter = new OpenLibraryEditionOptionsAdapter({
        timeoutMs: 1000, maxResponseBytes: 64000, fetcher: twoAuthorFetcher(badHeaders) as never });
      const bridge = createBridgedPort({ adapterKey: 'open_library', adapterVersion: '1.0.0',
        binding: adapter.transportBinding, maxGets: 6, policy: null,
        lookupId: 't5-lookup', attemptId: 't5-attempt',
        claim: { jobId: 't5-job', worker: 't5-worker',
          leaseToken: 'a'.repeat(64), claimAttempt: 1 },
        hooks: stubHooks() });
      return adapter.lookupEditionOptions({ query, correlationId: 't5-lookup',
        attemptId: 't5-attempt', signal: new AbortController().signal, httpPort: bridge });
    };
    const denied = await run({ 'cache-control': 'no-store' });
    expect(denied.rows.map((row) => row.eligibility)).toEqual(['unavailable', 'eligible']);
    expect(denied.retentionEvidence).toBeNull();
    const control = await run({});
    expect(control.rows.map((row) => row.eligibility)).toEqual(['unavailable', 'eligible']);
    expect(control.retentionEvidence).not.toBeNull();
  });
  it('v2 real port: no-store denial survives a later permissive author', async () => {
    const clock = fakeClock();
    const run = async (badHeaders: Record<string, string>) => {
      const http = createProviderHttpPort({
        adapterKey: 'open_library', adapterVersion: '2.0.0',
        policy: TEST_ONLY_PROTECTION_POLICY, maxGets: 6, timeoutMs: 1000,
        maxResponseBytes: 64000, now: clock.now, sleep: clock.sleep,
        fetcher: twoAuthorFetcher(badHeaders) as never,
        lookupId: 't5-lookup', attemptId: 't5-attempt',
        claim: { jobId: 't5-job', worker: 't5-worker',
          leaseToken: 'a'.repeat(64), claimAttempt: 1 },
        retentionPolicyVersion: 1,
        ...stubHooks(),
      });
      return invokeOpenLibraryV2({ query, correlationId: 't5-lookup',
        attemptId: 't5-attempt', signal: new AbortController().signal,
        purpose: 'edition_options', http,
        version: 'p9-metadata-result-v2', policyVersion: null,
        retentionContract: 'open-library-options-v1' });
    };
    const denied = await run({ 'cache-control': 'no-store' });
    expect(denied.rows).toBeNull();
    expect(denied.retention).toBeNull();
    const control = await run({});
    expect(control.rows).toHaveLength(2);
    expect(control.rows?.map((row) => row.eligibility)).toEqual(['unavailable', 'eligible']);
    expect(control.retention).not.toBeNull();
  });
});
