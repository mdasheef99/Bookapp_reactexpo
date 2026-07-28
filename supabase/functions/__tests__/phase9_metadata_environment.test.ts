import { loadMetadataWorkerEnvironment } from '../../../workers/phase9-runtime/environment';
import {
  createMetadataProductionDependencies,
} from '../../../workers/phase9-metadata-worker/bootstrap';

const base = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-that-is-long-enough-0001',
  PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: 'a'.repeat(64),
  PHASE9_WORKER_HOST: '0.0.0.0',
  PHASE9_WORKER_PORT: '8080',
  PHASE9_WORKER_CONCURRENCY: '1',
  PHASE9_METADATA_WORKER_ID: 'metadata-worker-0000001',
  PHASE9_METADATA_WORKER_INGRESS_TOKEN: 'metadata-ingress-secret-A7z.49_xYp-001',
};

describe('Phase 9 metadata worker server-only environment', () => {
  it('defaults to fixture mode without a provider credential', () => {
    expect(loadMetadataWorkerEnvironment(base)).toMatchObject({ providerMode: 'fixture' });
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
});
