import { OpenLibraryEditionOptionsAdapter } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary';
import { createOpenLibraryRateLimiter } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary/transport';
import {
  GoogleBooksAdapter,
  GOOGLE_BOOKS_CAPABILITY,
} from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks';
import { createGoogleBooksDescriptor } from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks/descriptor';
import { createOpenLibraryV1Descriptor, createOpenLibraryV2Descriptor } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary/descriptor';
import {
  providerManifestKey,
  type ProviderDescriptor,
} from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import { MetadataWorkerEnvironment } from '../phase9-runtime/environment';
import { MetadataProviderAdapter } from '../../supabase/functions/_shared/imageInventory/metadata/providerAdapter';
import { ProviderCapabilityDeclaration } from '../../supabase/functions/_shared/imageInventory/metadata/contracts';
import { createClient } from '@supabase/supabase-js';
import { handlePhase9MetadataWorker } from './index';
import { createMetadataEditionOptionsBoundary }
  from '../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsRpc';

export type MetadataProductionDependencies = Readonly<{
  primary: MetadataProviderAdapter | null;
  primaryCapability: ProviderCapabilityDeclaration | null;
  secondary: null;
  editionFallback?: OpenLibraryEditionOptionsAdapter;
  // Unit B: server-side contact map (contactId -> contact) for identifying
  // provider User-Agent values. Never logged, persisted or returned.
  providerContacts: Readonly<Record<string, string>>;
  // U3 installed manifest, keyed by providerManifestKey(adapterKey,
  // adapterVersion). Present in every real boot ('real' and the legacy
  // 'google_books' alias); absent in fixture mode, which keeps the legacy
  // capability route for old callers.
  installed?: ReadonlyMap<string, ProviderDescriptor>;
}>;

// OL-only real boot carries no Google transport values in the environment.
// The values below are OL-only operational defaults taken from the README's
// documented example values, inside the preserved bounds in
// workers/phase9-runtime/environment.ts. No new env names.
const OPEN_LIBRARY_ONLY_TIMEOUT_MS = 10_000;
const OPEN_LIBRARY_ONLY_MAX_RESPONSE_BYTES = 262_144;

// U3 installed descriptor manifest from the descriptors that exist today:
// google_books@1.0.0, open_library@1.0.0 and (U4) port-only
// open_library@2.0.0, unbound here like the v1 entry: no per-job registry
// policy is known at boot, so v2 retention stays not ready until U6 binds it.
export function createInstalledDescriptorManifest(input: Readonly<{
  google: GoogleBooksAdapter | null;
  openLibrary: OpenLibraryEditionOptionsAdapter;
}>): ReadonlyMap<string, ProviderDescriptor> {
  // The map is keyed from each descriptor's own adapterKey/adapterVersion so
  // a version bump cannot silently desynchronize a literal key.
  const googleDescriptor = createGoogleBooksDescriptor({
    adapter: input.google,
    // A missing Google key makes Google not ready (credentials readiness
    // false, so no Google egress); readiness is never forced.
    credentialsReady: () => input.google !== null,
  });
  const openLibraryDescriptor = createOpenLibraryV1Descriptor({
    adapter: input.openLibrary,
    // No per-job registry policy is known at boot, so retention stays not
    // ready here; the worker binds the verified registry policyVersion at
    // route time (index.ts). Unbound entries are never used for execution.
    policyVersion: null,
  });
  const openLibraryV2Descriptor = createOpenLibraryV2Descriptor({ policyVersion: null });
  return new Map<string, ProviderDescriptor>([
    [providerManifestKey(googleDescriptor.adapterKey, googleDescriptor.adapterVersion), googleDescriptor],
    [providerManifestKey(openLibraryDescriptor.adapterKey, openLibraryDescriptor.adapterVersion), openLibraryDescriptor],
    [providerManifestKey(openLibraryV2Descriptor.adapterKey, openLibraryV2Descriptor.adapterVersion), openLibraryV2Descriptor],
  ]);
}

export function createMetadataProductionDependencies(
  environment: MetadataWorkerEnvironment,
  fetcher: typeof fetch = fetch,
): MetadataProductionDependencies {
  if (environment.providerMode === 'fixture') {
    return Object.freeze({
      primary: null,
      primaryCapability: null,
      secondary: null,
      providerContacts: Object.freeze({}),
    });
  }
  // Real boot is provider-neutral: 'real' and the bounded legacy
  // 'google_books' alias share this path. The registry + resolver elect the
  // provider; bootstrap never branches routing on a provider name and performs
  // no startup database or network mutation (adapter construction issues no
  // I/O). The guard is all-or-none so the export is self-defending even for a
  // manually constructed environment: Google values are all present (keyed
  // real boot or the complete legacy set) or all absent (OL-only real boot).
  const { apiKey, timeoutMs, maxResponseBytes } = environment;
  if (apiKey === null || timeoutMs === null || maxResponseBytes === null) {
    if (apiKey !== null || timeoutMs !== null || maxResponseBytes !== null) {
      throw new Error('P9_WORKER_CONFIGURATION_INVALID');
    }
    const openLibraryOnly = new OpenLibraryEditionOptionsAdapter({
      fetcher,
      timeoutMs: OPEN_LIBRARY_ONLY_TIMEOUT_MS,
      maxResponseBytes: OPEN_LIBRARY_ONLY_MAX_RESPONSE_BYTES,
      retentionAllowed: true, waitForRequest: createOpenLibraryRateLimiter(),
    });
    return Object.freeze({
      primary: null,
      primaryCapability: null,
      editionFallback: openLibraryOnly,
      installed: createInstalledDescriptorManifest({ google: null, openLibrary: openLibraryOnly }),
      secondary: null,
      providerContacts: environment.providerContacts,
    });
  }
  const openLibrary = new OpenLibraryEditionOptionsAdapter({
    fetcher,
    timeoutMs,
    maxResponseBytes,
    retentionAllowed: true, waitForRequest: createOpenLibraryRateLimiter(),
  });
  const google = new GoogleBooksAdapter({
    mode: 'real',
    apiKey,
    fetcher,
    timeoutMs,
    maxResponseBytes,
  });
  const installed = createInstalledDescriptorManifest({ google, openLibrary });
  return Object.freeze({
    primary: google,
    primaryCapability: GOOGLE_BOOKS_CAPABILITY,
    editionFallback: openLibrary,
    installed,
    secondary: null,
    providerContacts: environment.providerContacts,
  });
}

export function createPhase9MetadataService(environment: MetadataWorkerEnvironment) {
  const serviceClient = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const dependencies = createMetadataProductionDependencies(environment);
  const editionOptionsBoundary = createMetadataEditionOptionsBoundary({
    rpc: async (name, parameters) => {
      const { data, error } = await serviceClient.rpc(name, parameters);
      return { data, error };
    },
  });
  return (request: Request) => handlePhase9MetadataWorker(request, {
    workerId: environment.workerId,
    workerAuthToken: environment.workerAuthToken,
    serviceClient,
    primary: dependencies.primary,
    primaryCapability: dependencies.primaryCapability,
    editionFallback: dependencies.editionFallback,
    providerContacts: dependencies.providerContacts,
    // Unconditional in real mode: the routed path is the production path and
    // no fallback to legacy routing hides a manifest failure. Fixture mode
    // carries no manifest and keeps the legacy route for old callers.
    installed: dependencies.installed,
    editionOptionsBoundary: editionOptionsBoundary,
  });
}
