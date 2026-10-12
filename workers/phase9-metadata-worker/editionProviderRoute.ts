import {GoogleBooksAdapter} from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter';
import {OpenLibraryEditionOptionsAdapter,OPEN_LIBRARY_CAPABILITY}
 from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary';
import type {MetadataJobContext} from '../../supabase/functions/_shared/imageInventory/runtime/metadataJobContext';
import type {MetadataWorkerDependencies} from './index';

// Explicit search only: a provider without verified retention is ineligible before route selection.
export function editionProviderRoute(context:MetadataJobContext,dependencies:MetadataWorkerDependencies) {
  const google=dependencies.primary instanceof GoogleBooksAdapter ? dependencies.primary : null;
  const library=dependencies.editionFallback ?? null;
  const allowed=(key:string,version:string)=>context.providerPolicies.some(row=>
    row.adapterKey===key && row.adapterVersion===version && row.enabled && row.matchingAllowed && row.storageAllowed);
  const resumed=context.currentAttemptAdapterKey ?? context.currentLookupAdapterKey;
  if (resumed==='open_library') return library && allowed('open_library','1.0.0')
    ? {adapter:library,capability:OPEN_LIBRARY_CAPABILITY,fallback:null} : null;
  if (resumed==='google_books' && library && !google?.optionsRetentionConfigured) return null;
  if (google && dependencies.primaryCapability && allowed('google_books',dependencies.primaryCapability.adapterVersion)
    && (google.optionsRetentionConfigured || !library)) {
    return {adapter:google,capability:dependencies.primaryCapability,
      fallback:library && allowed('open_library','1.0.0') ? library : null};
  }
  return library && allowed('open_library','1.0.0')
    ? {adapter:library,capability:OPEN_LIBRARY_CAPABILITY,fallback:null} : null;
}
