// Unit B fix round 1 (F3): privacy through the REAL worker flow. A
// contact-bearing automatic claim and a contact-bearing explicit claim each
// run through the real worker HTTP service (real logger path via
// createJsonOperationalLogger with a recording sink, real handler
// handlePhase9MetadataWorker) with mocks that record every call: logger
// lines, RPC params/responses/errors, the returned results, and every fetch
// header. The fake contact must appear in the User-Agent and nowhere else.
// NEW file; no existing test touched. Fake values only; never a real email.
import {
  createJsonOperationalLogger,
  createPhase9WorkerHttpService,
} from '../../../workers/phase9-runtime/httpService';
import {
  handlePhase9MetadataWorker,
} from '../../../workers/phase9-metadata-worker';
import { createInstalledDescriptorManifest } from '../../../workers/phase9-metadata-worker/bootstrap';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { editionWorkerFixture, automaticContext } from './fixtures/phase9/editionOptionsWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { automaticDependencies, workerEnvironment } from './support/automaticWorker';
import { bootstrapOpenLibraryOnly } from './support/providerModules';

const AUTO_FAKE = 'auto-ops@example.invalid';
const EXPLICIT_FAKE = 'explicit-ops@example.invalid';
const TOKEN = 'fixture-worker-ingress';

type FetchCall = { url: string; headers: Record<string, string> };
type RpcCall = {
  name: string; parameters: unknown; data: unknown; error: unknown; thrown: string | null;
};

// Serving bundle for coherent OL matches (titles/authors/isbn mirror the
// fixture query), recording every URL and every header.
const recordingBundleFetcher = (calls: FetchCall[]): typeof fetch =>
  (async (input: string | URL | Request, init?: RequestInit) => {
    const address = typeof input === 'string' ? input
      : input instanceof URL ? input.href : (input as Request).url;
    const url = new URL(String(address));
    const rawHeaders = init?.headers;
    const headers: Record<string, string> = rawHeaders instanceof Headers
      ? Object.fromEntries(rawHeaders.entries())
      : { ...((rawHeaders ?? {}) as Record<string, string>) };
    calls.push({ url: url.pathname, headers });
    const body = url.pathname === '/search.json' ? { docs: [{ key: '/works/OL1W', title: 'The Fixture Book' }] }
      : url.pathname.endsWith('/editions.json') ? { entries: [{ key: '/books/OL100M',
        title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
        languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'], covers: [123] }] }
      : { key: '/authors/OL1A', name: 'Fixture Author' };
    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' },
    });
  }) as typeof fetch;

const recordingRpc = (calls: RpcCall[], base: (name: string, p: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) =>
  async (name: string, parameters: Record<string, unknown>) => {
    const entry: RpcCall = { name, parameters, data: undefined, error: undefined, thrown: null };
    calls.push(entry);
    try {
      const result = await base(name, parameters);
      entry.data = result.data;
      entry.error = result.error;
      return result;
    } catch (error) {
      entry.thrown = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw error;
    }
  };

const userAgents = (calls: FetchCall[]) =>
  calls.map((call) => {
    const header = Object.entries(call.headers).find(([name]) => name.toLowerCase() === 'user-agent');
    expect(header).toBeDefined();
    return String(header![1]);
  });

const assertPrivacy = (
  haystacks: { label: string; text: string }[],
  nonUserAgentHeaders: string[][],
  expectedUa: string,
) => {
  for (const fake of [AUTO_FAKE, EXPLICIT_FAKE]) {
    for (const hay of haystacks) {
      expect(hay.text).not.toContain(fake);
    }
    for (const values of nonUserAgentHeaders) {
      for (const value of values) expect(value).not.toContain(fake);
    }
  }
  expect(expectedUa).toContain('BookConnect edition lookup (');
};

describe('Phase 9 Unit B worker-flow privacy (F3)', () => {
  const started: Array<ReturnType<typeof createPhase9WorkerHttpService>> = [];

  afterEach(async () => {
    await Promise.all(started.splice(0).map((service) => service.stop()));
  });

  it('automatic contact-bearing claim: UA carries the contact, logs/RPC/results/headers do not', async () => {
    // Mutation caught: a contact leak through the actual worker logger or RPC path.
    const lines: string[] = [];
    const fetchCalls: FetchCall[] = [];
    const fetcher = recordingBundleFetcher(fetchCalls);
    const rpcCalls: RpcCall[] = [];
    const handlerErrors: string[] = [];
    const subject = automaticDependencies({
      production: bootstrapOpenLibraryOnly({
        ...workerEnvironment,
        PHASE9_PROVIDER_CONTACTS: JSON.stringify({ 'auto-contact': AUTO_FAKE }),
      }, fetcher),
      rpc: async (name) => (name === 'phase9_provider_configuration_v1'
        ? { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', {
            enabled: false, matchingAllowed: false, storageAllowed: false,
            automaticLookupAllowed: false, automaticRole: null, automaticOrder: null,
            explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
          }),
          providerConfigurationRow('open_library', '2.0.0', {
            automaticLookupAllowed: true, automaticRole: 'primary', automaticOrder: 1,
            explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
            protectionPolicy: {
              version: 'p9-protection-v1', minIntervalMs: 1000, storeWindowSeconds: 60,
              storeMaxGets: 6, backoffBaseMs: 100, backoffMaxMs: 400,
              breakerFailures: 2, breakerWindowSeconds: 60, breakerCooldownMs: 30000,
              halfOpenMax: 1, mode: 'single_instance', contactId: 'auto-contact',
            },
          }),
        ]), error: null }
        : undefined),
      context: { providerPolicies: [
        ...automaticContext.providerPolicies,
        { adapterKey: 'open_library', adapterVersion: '2.0.0', enabled: true,
          matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1 },
      ] },
    });
    const baseRpc = subject.dependencies.serviceClient.rpc;
    const dependencies = {
      ...subject.dependencies,
      providerContacts: Object.freeze({ 'auto-contact': AUTO_FAKE }),
      serviceClient: { rpc: recordingRpc(rpcCalls, baseRpc) },
    };
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-metadata-contact-privacy-auto-test',
      host: '127.0.0.1', port: 0, concurrency: 1,
      workerAuthToken: TOKEN,
      handler: async (request) => {
        try {
          return await handlePhase9MetadataWorker(request, dependencies);
        } catch (error) {
          handlerErrors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
          throw error;
        }
      },
      readiness: () => true,
      // The worker's real logger path: the production factory, recording sink.
      log: createJsonOperationalLogger((line: string) => { lines.push(line); }),
    });
    started.push(service);
    const address = await service.start();

    const response = await fetch(`${address.url}/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    });
    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(JSON.parse(bodyText)).toEqual({ claimed: 1, results: [{ outcome: 'accepted_metadata_match' }] });

    const agents = userAgents(fetchCalls);
    expect(fetchCalls.length).toBeGreaterThan(0);
    const expectedUa = `BookConnect edition lookup (${AUTO_FAKE})`;
    for (const agent of agents) expect(agent).toBe(expectedUa);

    const nonUaValues = fetchCalls.map((call) => Object.entries(call.headers)
      .filter(([name]) => name.toLowerCase() !== 'user-agent')
      .map(([, value]) => String(value)));
    assertPrivacy([
      { label: 'logger', text: lines.join('\n') },
      { label: 'rpc', text: JSON.stringify(rpcCalls) },
      { label: 'results', text: bodyText },
      { label: 'handler errors', text: handlerErrors.join('\n') },
    ], nonUaValues, expectedUa);
    expect(lines.length).toBeGreaterThan(0);
    expect(rpcCalls.length).toBeGreaterThan(0);
  }, 30_000);

  it('explicit contact-bearing claim: UA carries the contact, logs/RPC/results/headers do not', async () => {
    // Mutation caught: a contact leak through the actual worker logger or RPC path.
    const lines: string[] = [];
    const fetchCalls: FetchCall[] = [];
    const fetcher = recordingBundleFetcher(fetchCalls);
    const rpcCalls: RpcCall[] = [];
    const handlerErrors: string[] = [];
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'open_library', adapterVersion: '1.0.0',
      enabled: true, matchingAllowed: true, storageAllowed: true,
      reuseAllowed: true, policyVersion: 1 }];
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: fetcher as never,
    });
    const installed = createInstalledDescriptorManifest({ google: null, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('open_library', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
            protectionPolicy: {
              version: 'p9-protection-v1', minIntervalMs: 1000, storeWindowSeconds: 60,
              storeMaxGets: 6, backoffBaseMs: 100, backoffMaxMs: 400,
              breakerFailures: 2, breakerWindowSeconds: 60, breakerCooldownMs: 30000,
              halfOpenMax: 1, mode: 'single_instance', contactId: 'explicit-contact',
            },
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const dependencies = {
      ...fixture.dependencies,
      providerContacts: Object.freeze({ 'explicit-contact': EXPLICIT_FAKE }),
      serviceClient: { rpc: recordingRpc(rpcCalls, rpc) },
      primary: null, primaryCapability: null, editionFallback: library, installed,
    };
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-metadata-contact-privacy-explicit-test',
      host: '127.0.0.1', port: 0, concurrency: 1,
      workerAuthToken: TOKEN,
      handler: async (request) => {
        try {
          return await handlePhase9MetadataWorker(request, dependencies);
        } catch (error) {
          handlerErrors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
          throw error;
        }
      },
      readiness: () => true,
      // The worker's real logger path: the production factory, recording sink.
      log: createJsonOperationalLogger((line: string) => { lines.push(line); }),
    });
    started.push(service);
    const address = await service.start();

    const response = await fetch(`${address.url}/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    });
    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(JSON.parse(bodyText)).toEqual({ claimed: 1, results: [{ outcome: 'edition_options_available' }] });

    const agents = userAgents(fetchCalls);
    expect(fetchCalls.length).toBeGreaterThan(0);
    const expectedUa = `BookConnect edition lookup (${EXPLICIT_FAKE})`;
    for (const agent of agents) expect(agent).toBe(expectedUa);

    const nonUaValues = fetchCalls.map((call) => Object.entries(call.headers)
      .filter(([name]) => name.toLowerCase() !== 'user-agent')
      .map(([, value]) => String(value)));
    assertPrivacy([
      { label: 'logger', text: lines.join('\n') },
      { label: 'rpc', text: JSON.stringify(rpcCalls) },
      { label: 'results', text: bodyText },
      { label: 'handler errors', text: handlerErrors.join('\n') },
    ], nonUaValues, expectedUa);
    expect(lines.length).toBeGreaterThan(0);
    expect(rpcCalls.length).toBeGreaterThan(0);
  }, 30_000);
});
