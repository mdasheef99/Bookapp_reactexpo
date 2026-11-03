import { loadMetadataWorkerEnvironment } from '../../../workers/phase9-runtime/environment';
import {
  createMetadataProductionDependencies,
} from '../../../workers/phase9-metadata-worker/bootstrap';

import { bootstrapOpenLibraryOnly, runDescriptorWorker, installedManifest } from './support/providerModules';
import { automaticDependencies } from './support/automaticWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { automaticContext } from './fixtures/phase9/editionOptionsWorker';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';

const base = {
  SUPABASE_URL: 'https://ahntbtktjjmvfosgkmgn.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-that-is-long-enough-0001',
  PHASE9_WORKER_HOST: '0.0.0.0',
  PHASE9_WORKER_PORT: '8080',
  PHASE9_WORKER_CONCURRENCY: '1',
  PHASE9_METADATA_WORKER_ID: 'metadata-worker-0000001',
  PHASE9_METADATA_WORKER_INGRESS_TOKEN: 'metadata-ingress-secret-A7z.49_xYp-001',
};

describe('Phase 9 metadata worker server-only environment', () => {
  it('fails closed on every non-approved privileged Supabase target before composition', () => {
    const compose = jest.fn();
    const rejected = [
      'https://another-project.supabase.co',
      'https://ahntbtktjjmvfosgkmgn.supabase.co.attacker.example',
      'http://ahntbtktjjmvfosgkmgn.supabase.co',
      'https://user@ahntbtktjjmvfosgkmgn.supabase.co',
      'https://ahntbtktjjmvfosgkmgn.supabase.co?unsafe=1',
      'https://ahntbtktjjmvfosgkmgn.supabase.co#unsafe',
      'https://ahntbtktjjmvfosgkmgn.supabase.co/unexpected',
      'not a url',
      '',
    ];

    expect(loadMetadataWorkerEnvironment(base)).toMatchObject({
      supabaseUrl: 'https://ahntbtktjjmvfosgkmgn.supabase.co',
    });
    for (const SUPABASE_URL of rejected) {
      expect(() => {
        const configuration = loadMetadataWorkerEnvironment({ ...base, SUPABASE_URL });
        compose(configuration);
      }).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    }
    expect(compose).not.toHaveBeenCalled();
  });

  it('rejects a service credential when the approved URL is absent', () => {
    expect(() => loadMetadataWorkerEnvironment({ ...base, SUPABASE_URL: undefined }))
      .toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('does not require or accept a meaningless peer fingerprint', () => {
    expect(loadMetadataWorkerEnvironment(base)).toMatchObject({ providerMode: 'fixture' });
    expect(() => loadMetadataWorkerEnvironment({
      ...base,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: 'a'.repeat(64),
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('defaults to fixture mode without a provider credential', () => {
    expect(loadMetadataWorkerEnvironment(base)).toMatchObject({ providerMode: 'fixture' });
  });

  it('boots and dispatches a real OL-only runtime without any Google credential', async () => {
    const urls: string[] = [];
    const fetcher = jest.fn(async (address: string | URL | Request) => {
      const url = new URL(address instanceof Request ? address.url : String(address)); urls.push(url.hostname);
      return new Response(JSON.stringify({ docs: [] }), { headers: { 'content-type': 'application/json' } });
    });
    const production = bootstrapOpenLibraryOnly(base, fetcher);
    // The OL-only runtime is the production bootstrap; the automatic fixture
    // receives it directly and must not construct a Google adapter or key.
    const subject = automaticDependencies({ production, context: { providerPolicies: [{
      ...automaticContext.providerPolicies[0], adapterKey: 'open_library', adapterVersion: '2.0.0',
    }] }, rpc: async name => name === 'phase9_provider_configuration_v1' ? {
      data: providerConfigurationSnapshot([providerConfigurationRow('open_library', '2.0.0', {
        protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
      })]), error: null,
    } : undefined });
    const globalFetch = jest.spyOn(globalThis, 'fetch').mockImplementation(fetcher);
    try {
      await runDescriptorWorker({ ...subject.dependencies, ...production }, production.installed ?? installedManifest());
      expect(urls).toEqual(['openlibrary.org']);
      expect(subject.command()?.result.outcome.outcome).toBe('no_acceptable_match');
    } finally { globalFetch.mockRestore(); }
  });

  it('requires explicit real mode and bounded complete Google Books configuration', () => {
    expect(() => loadMetadataWorkerEnvironment({
      ...base,
      PHASE9_METADATA_PROVIDER_MODE: 'google_books',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(loadMetadataWorkerEnvironment({
      ...base,
      PHASE9_METADATA_PROVIDER_MODE: 'google_books',
      PHASE9_GOOGLE_BOOKS_API_KEY: 'google-books-key-that-is-long-enough-A7z.49',
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    })).toMatchObject({
      providerMode: 'google_books',
      timeoutMs: 5000,
      maxResponseBytes: 262144,
    });
  });

  it('rejects Google Books secrets in fixture mode', () => {
    expect(() => loadMetadataWorkerEnvironment({
      ...base,
      PHASE9_GOOGLE_BOOKS_API_KEY: 'google-books-key-that-is-long-enough-A7z.49',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('wires only the configured primary and never creates a secondary', () => {
    const fixture = loadMetadataWorkerEnvironment(base);
    expect(createMetadataProductionDependencies(fixture)).toEqual({
      primary: null,
      primaryCapability: null,
      secondary: null,
    });
    const real = loadMetadataWorkerEnvironment({
      ...base,
      PHASE9_METADATA_PROVIDER_MODE: 'google_books',
      PHASE9_GOOGLE_BOOKS_API_KEY: 'google-books-key-that-is-long-enough-A7z.49',
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    });
    expect(createMetadataProductionDependencies(real, jest.fn()).primaryCapability)
      .toMatchObject({ adapterKey: 'google_books', role: 'primary' });
    expect(createMetadataProductionDependencies(real, jest.fn()).secondary).toBeNull();
  });

  // U3 boot-only additions. Existing assertions above are unchanged.
  it('accepts real mode and the legacy google_books alias with complete Google configuration', () => {
    const complete = {
      PHASE9_GOOGLE_BOOKS_API_KEY: 'google-books-key-that-is-long-enough-A7z.49',
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    };
    expect(loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real', ...complete,
    })).toMatchObject({ providerMode: 'real', timeoutMs: 5000, maxResponseBytes: 262144 });
    expect(loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'google_books', ...complete,
    })).toMatchObject({ providerMode: 'google_books', timeoutMs: 5000, maxResponseBytes: 262144 });
  });

  it('rejects unknown provider modes while the fixture default keeps working', () => {
    expect(loadMetadataWorkerEnvironment(base)).toMatchObject({ providerMode: 'fixture' });
    for (const mode of ['open_library', 'bogus', 'REAL', 'google-books']) {
      expect(() => loadMetadataWorkerEnvironment({
        ...base, PHASE9_METADATA_PROVIDER_MODE: mode,
      })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    }
  });

  it('boots an OL-only real runtime without any Google credential', () => {
    const environment = loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
    });
    expect(environment).toMatchObject({
      providerMode: 'real', apiKey: null, timeoutMs: null, maxResponseBytes: null,
    });
    const dependencies = createMetadataProductionDependencies(environment, jest.fn());
    expect(dependencies.primary).toBeNull();
    expect(dependencies.primaryCapability).toBeNull();
    expect(dependencies.secondary).toBeNull();
    expect(dependencies.editionFallback).toBeDefined();
    expect(dependencies.installed?.has('google_books@1.0.0')).toBe(true);
    expect(dependencies.installed?.has('open_library@1.0.0')).toBe(true);
    expect(dependencies.installed?.has('open_library@2.0.0')).toBe(false);
    expect(dependencies.installed?.get('google_books@1.0.0')?.credentialsReady()).toBe(false);
    expect(dependencies.installed?.get('open_library@1.0.0')?.credentialsReady()).toBe(true);
  });

  it('rejects a partial Google set without a key while keyless real boot stays valid', () => {
    expect(loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
    })).toMatchObject({ providerMode: 'real' });
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'google_books',
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('keeps today transport bounds for a Google-primary real configuration', () => {
    const key = 'google-books-key-that-is-long-enough-A7z.49';
    const valid = loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_API_KEY: key,
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    });
    expect(valid).toMatchObject({
      providerMode: 'real', apiKey: key, timeoutMs: 5000, maxResponseBytes: 262144,
    });
    const dependencies = createMetadataProductionDependencies(valid, jest.fn());
    expect(dependencies.primaryCapability).toMatchObject({ adapterKey: 'google_books' });
    expect(dependencies.installed?.get('google_books@1.0.0')?.credentialsReady()).toBe(true);
    for (const timeout of ['99', '300001']) {
      expect(() => loadMetadataWorkerEnvironment({
        ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
        PHASE9_GOOGLE_BOOKS_API_KEY: key,
        PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: timeout,
        PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
      })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    }
    for (const bytes of ['16383', '2000001']) {
      expect(() => loadMetadataWorkerEnvironment({
        ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
        PHASE9_GOOGLE_BOOKS_API_KEY: key,
        PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
        PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: bytes,
      })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    }
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_API_KEY: key,
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  // U3 fix pass 1 additions. Existing assertions above are unchanged.
  it('rejects a keyless google_books alias while the complete legacy set keeps working', () => {
    const complete = {
      PHASE9_GOOGLE_BOOKS_API_KEY: 'google-books-key-that-is-long-enough-A7z.49',
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    };
    expect(loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'google_books', ...complete,
    })).toMatchObject({ providerMode: 'google_books', timeoutMs: 5000, maxResponseBytes: 262144 });
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'google_books',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'google_books',
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('treats a whitespace-only Google key as absent and guards keyed partial sets in real mode', () => {
    expect(loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_API_KEY: '   ',
    })).toMatchObject({ providerMode: 'real', apiKey: null, timeoutMs: null, maxResponseBytes: null });
    const key = 'google-books-key-that-is-long-enough-A7z.49';
    expect(loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_API_KEY: key,
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    })).toMatchObject({ providerMode: 'real', timeoutMs: 5000, maxResponseBytes: 262144 });
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_API_KEY: key,
      PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '5000',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_METADATA_PROVIDER_MODE: 'real',
      PHASE9_GOOGLE_BOOKS_API_KEY: key,
      PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '262144',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });
});
