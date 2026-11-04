// U2: explicit and automatic share one pure fresh route. The database
// registry (phase9_provider_configuration_v1) intersected with the installed
// descriptor manifest elects the provider; no instanceof, literal version or
// adapter-capability election remains here.
//
// 02c section 5.1: automatic resumes use M94 historical lineage. It pins routing
// only; M93 begin remains the sole authority for another physical round.
import type { MetadataJobContext } from '../../supabase/functions/_shared/imageInventory/runtime/metadataJobContext';
import type {
  ProviderDescriptor,
  Purpose,
  RegistrySnapshot,
  Route,
  Lineage,
} from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import { resolveProviderRoute } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';

export type EditionProviderRouteRequest = Readonly<{
  context: MetadataJobContext;
  resumed?: Lineage | null;
  registry: RegistrySnapshot;
  installed: ReadonlyMap<string, ProviderDescriptor>;
}>;

// Persisted evidence that a previous provider flow touched this job: a
// registered lookup, a registered attempt, a registered physical call, or a
// known attempt disposition. Any one of these proves the job is not fresh.
// Fresh jobs have all four null (no lookup/attempt/call rows exist yet).
// Incomplete evidence stays recovery-only; current policy is never historical lineage.
export function hasPersistedEvidence(context: MetadataJobContext): boolean {
  return context.currentLookupId !== null
    || context.currentAttemptId !== null
    || context.currentPhysicalStatus !== null
    || context.currentAttemptDisposition !== null;
}

export function editionProviderRoute(
  request: EditionProviderRouteRequest,
): Route | { manual: true } {
  const purpose: Purpose = request.context.purpose === 'edition_options'
    ? 'edition_options'
    : 'automatic';
  return resolveProviderRoute({
    purpose,
    registry: request.registry,
    installed: request.installed,
    resumed: request.resumed ?? null,
  });
}
