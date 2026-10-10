import {
  GoogleBooksAdapter,
  GOOGLE_BOOKS_CAPABILITY,
} from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks';
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
}>;

export function createMetadataProductionDependencies(
  environment: MetadataWorkerEnvironment,
  fetcher: typeof fetch = fetch,
): MetadataProductionDependencies {
  if (environment.providerMode === 'fixture') {
    return Object.freeze({
      primary: null,
      primaryCapability: null,
      secondary: null,
    });
  }
  return Object.freeze({
    primary: new GoogleBooksAdapter({
      mode: 'real',
      apiKey: environment.apiKey,
      fetcher,
      timeoutMs: environment.timeoutMs,
      maxResponseBytes: environment.maxResponseBytes,
    }),
    primaryCapability: GOOGLE_BOOKS_CAPABILITY,
    secondary: null,
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
    editionOptionsBoundary,
  });
}
