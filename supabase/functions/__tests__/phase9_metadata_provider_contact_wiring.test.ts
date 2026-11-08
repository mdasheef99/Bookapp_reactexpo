// Unit B fix round 1 (F5): worker-level primary/fallback wiring. Two
// contactIds map to different fake values; the primary and the
// secondary/fallback egress each send their own value through the real
// worker path (runMetadataWorkerBatch), and a NULL policy with a populated
// map still sends the exact literal User-Agent. NEW file; no existing test
// touched. Fake values only; never a real email.
import { createInstalledDescriptorManifest } from '../../../workers/phase9-metadata-worker/bootstrap';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { GoogleBooksAdapter } from '../_shared/imageInventory/metadata/googleBooks/adapter';
import { GOOGLE_BOOKS_CAPABILITY } from '../_shared/imageInventory/metadata/googleBooks';
import { editionWorkerFixture, automaticContext, createdFixtures } from './fixtures/phase9/editionOptionsWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { automaticDependencies, workerEnvironment } from './support/automaticWorker';
import { bootstrapOpenLibraryOnly } from './support/providerModules';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';

const FAKE_PRIMARY = 'primary-ops@example.invalid';
const FAKE_SECONDARY = 'secondary-ops@example.invalid';
const CONTACTS = Object.freeze({
  'primary-contact': FAKE_PRIMARY,
  'secondary-contact': FAKE_SECONDARY,
});
const UA_PRIMARY = `BookConnect edition lookup (${FAKE_PRIMARY})`;
const UA_SECONDARY = `BookConnect edition lookup (${FAKE_SECONDARY})`;
const UA_LITERAL = 'BookConnect edition lookup';

type FetchCall = { url: string; headers: Record<string, string> };

const recordingBundleFetcher = (calls: FetchCall[]): typeof fetch =>
  (async (input: string | URL | Request, init?: RequestInit) => {
    const address = typeof input === 'string' ? input
      : input instanceof URL ? input.href : (input as Request).url;
    const url = new URL(String(address));
    const rawHeaders = init?.headers;
    calls.push({
      url: url.pathname,
      headers: rawHeaders instanceof Headers
        ? Object.fromEntries(rawHeaders.entries())
        : { ...((rawHeaders ?? {}) as Record<string, string>) },
    });
    const body = url.pathname === '/search.json' ? { docs: [{ key: '/works/OL1W', title: 'The Fixture Book' }] }
      : url.pathname.endsWith('/editions.json') ? { entries: [{ key: '/books/OL100M',
        title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
        languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'], covers: [123] }] }
      : { key: '/authors/OL1A', name: 'Fixture Author' };
    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' },
    });
  }) as typeof fetch;

const userAgents = (calls: FetchCall[]) =>
  calls.map((call) => {
    const header = Object.entries(call.headers).find(([name]) => name.toLowerCase() === 'user-agent');
    expect(header).toBeDefined();
    return String(header![1]);
  });

// Primary + protected secondary both hold slots in the fallback case; keep the
// fixture store cap above the sum (the admission budget itself stays 1/6).
const policyWith = (contactId: string) => ({ ...TEST_ONLY_PROTECTION_POLICY, storeMaxGets: 20, contactId });
afterEach(() => {
  for (const fixture of createdFixtures.splice(0)) {
    expect(fixture.admissions.unknownBindingCount()).toBe(0);
  }
});


describe('Phase 9 Unit B worker-level contact wiring (F5)', () => {
  it('explicit OL v1 primary sends its own mapped value', async () => {
    // Mutation caught: primary/fallback wiring swapped (or first-mapping reuse).
    const fetchCalls: FetchCall[] = [];
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: recordingBundleFetcher(fetchCalls) as never,
    });
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'open_library', adapterVersion: '1.0.0',
      enabled: true, matchingAllowed: true, storageAllowed: true,
      reuseAllowed: true, policyVersion: 1 }];
    const installed = createInstalledDescriptorManifest({ google: null, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('open_library', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
            protectionPolicy: policyWith('primary-contact'),
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc: fixture.admissions.wrap(rpc) },
      providerContacts: CONTACTS,
      primary: null, primaryCapability: null, editionFallback: library, installed,
    });
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    const agents = userAgents(fetchCalls);
    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) expect(agent).toBe(UA_PRIMARY);
  }, 30_000);

  it('automatic OL v2 primary sends its own mapped value', async () => {
    // Mutation caught: primary/fallback wiring swapped (or first-mapping reuse).
    const fetchCalls: FetchCall[] = [];
    const fetcher = recordingBundleFetcher(fetchCalls);
    const subject = automaticDependencies({
      production: bootstrapOpenLibraryOnly({
        ...workerEnvironment,
        PHASE9_PROVIDER_CONTACTS: JSON.stringify({ 'secondary-contact': FAKE_SECONDARY }),
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
            protectionPolicy: policyWith('secondary-contact'),
          }),
        ]), error: null }
        : undefined),
      context: { providerPolicies: [
        ...automaticContext.providerPolicies,
        { adapterKey: 'open_library', adapterVersion: '2.0.0', enabled: true,
          matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1 },
      ] },
    });
    const result = await runMetadataWorkerBatch(1, {
      ...subject.dependencies,
      providerContacts: Object.freeze({ 'secondary-contact': FAKE_SECONDARY }),
    });
    expect(result.results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    const agents = userAgents(fetchCalls);
    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) expect(agent).toBe(UA_SECONDARY);
  }, 30_000);

  it('explicit fallback sends the secondary value, not the primary value', async () => {
    // Mutation caught: threading primaryContact into fallbackExplicitHttp
    // (or swapping the map values) — the fallback wire would carry UA_PRIMARY.
    const fetchCalls: FetchCall[] = [];
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: recordingBundleFetcher(fetchCalls) as never,
    });
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [
      { adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
        matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1 },
      { adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
        matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1 },
    ];
    fixture.controls.status = 503;
    const installed = createInstalledDescriptorManifest({
      google: fixture.adapter as unknown as GoogleBooksAdapter, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
            protectionPolicy: policyWith('primary-contact'),
          }),
          providerConfigurationRow('open_library', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'secondary', explicitOrder: 2,
            protectionPolicy: policyWith('secondary-contact'),
          }),
        ]), error: null };
      }
      if (name === 'phase9_finish_edition_primary_for_fallback_v1') {
        return { data: { status: 'completed' }, error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc: fixture.admissions.wrap(rpc) },
      providerContacts: CONTACTS,
      primary: fixture.adapter, primaryCapability: GOOGLE_BOOKS_CAPABILITY,
      editionFallback: library, installed,
    });
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    // Google primary egress carries Google's own transport headers; every
    // BookConnect OL egress (the fallback) must carry the secondary value.
    const agents = userAgents(fetchCalls);
    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) expect(agent).toBe(UA_SECONDARY);
  }, 30_000);

  it('NULL policy with a populated map sends the exact literal User-Agent', async () => {
    // Mutation caught: appending a contact (or any suffix) on the legacy path.
    const fetchCalls: FetchCall[] = [];
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: recordingBundleFetcher(fetchCalls) as never,
    });
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'open_library', adapterVersion: '1.0.0',
      enabled: true, matchingAllowed: true, storageAllowed: true,
      reuseAllowed: true, policyVersion: 1 }];
    const installed = createInstalledDescriptorManifest({ google: null, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('open_library', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
            protectionPolicy: null,
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
      providerContacts: CONTACTS,
      primary: null, primaryCapability: null, editionFallback: library, installed,
    });
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    const agents = userAgents(fetchCalls);
    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) expect(agent).toBe(UA_LITERAL);
  }, 30_000);
});
