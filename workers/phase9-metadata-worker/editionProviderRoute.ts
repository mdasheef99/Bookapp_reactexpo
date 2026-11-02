// U2: explicit and automatic share one pure fresh route. The database
// registry (phase9_provider_configuration_v1) intersected with the installed
// descriptor manifest elects the provider; no instanceof, literal version or
// adapter-capability election remains here.
//
// Lineage is locked lookup/attempt identity (02c §5.1) and the context does
// not persist the old attempt's version, role, sequence, or policy: the
// latest lookup/attempt columns (M67/M78, latest DESC without a completed
// filter), the latest physical call and its claim number (M38), and the
// current registry policy (M73/M78) cannot reconstruct them. This module
// therefore never manufactures a resumed Lineage from current state. The
// worker detects persisted evidence with hasPersistedEvidence, runs
// receipt-first recovery, and refuses fresh routing while evidence exists;
// only genuinely fresh jobs reach the resolver with resumed:null.
import type { MetadataJobContext } from '../../supabase/functions/_shared/imageInventory/runtime/metadataJobContext';
import type {
  ProviderDescriptor,
  Purpose,
  RegistrySnapshot,
  Route,
} from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import { resolveProviderRoute } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';

export type EditionProviderRouteRequest = Readonly<{
  context: MetadataJobContext;
  registry: RegistrySnapshot;
  installed: ReadonlyMap<string, ProviderDescriptor>;
}>;

// Persisted evidence that a previous provider flow touched this job: a
// registered lookup, a registered attempt, a registered physical call, or a
// known attempt disposition. Any one of these proves the job is not fresh.
// Fresh jobs have all four null (no lookup/attempt/call rows exist yet).
// This deliberately ignores role, sequence, claim and policy values: none of
// them is historical lineage, and an older claim number or retryable=true
// alone never proves retry authorization (M93 owns the round allowance; the
// worker cannot read it, so authorized round-1 execution is a U5 dependency).
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
    resumed: null,
  });
}
