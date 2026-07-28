import {
  GoogleBooksAdapter,
  GOOGLE_BOOKS_CAPABILITY,
} from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks';
import { MetadataWorkerEnvironment } from '../phase9-runtime/environment';

export type MetadataProductionDependencies = Readonly<{
  primary: GoogleBooksAdapter | null;
  primaryCapability: typeof GOOGLE_BOOKS_CAPABILITY | null;
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
