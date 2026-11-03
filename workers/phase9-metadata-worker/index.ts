import { editionProviderRoute, hasPersistedEvidence } from './editionProviderRoute';
import type { OpenLibraryEditionOptionsAdapter } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary';
import { OPEN_LIBRARY_CAPABILITY } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary';
import { createGoogleBooksDescriptor } from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks/descriptor';
import { createOpenLibraryV1Descriptor } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary/descriptor';
import type { ProviderDescriptor } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import type { RegistrySnapshot } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import { providerManifestKey } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import { OPEN_LIBRARY_ADAPTER_VERSION } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary/normalizer';
import { parseProviderConfigurationSnapshot } from '../../supabase/functions/_shared/imageInventory/runtime/providerConfiguration';
import { GoogleBooksAdapter } from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter';
import { executeEditionOptionsLookup } from '../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptions';
import type { MetadataEditionOptionsBoundary } from '../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
import { editionOptionsFence } from '../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
import { assertSafeIngestionResponse, parseDedicatedMetadataWorkerRequest }
  from '../../supabase/functions/_shared/imageInventory/contracts/ingestion';
import { ProviderCapabilityDeclaration }
  from '../../supabase/functions/_shared/imageInventory/metadata/contracts';
import { MetadataProviderAdapter }
  from '../../supabase/functions/_shared/imageInventory/metadata/providerAdapter';
import { runMetadataProductionComposition }
  from '../../supabase/functions/_shared/imageInventory/runtime/metadataProductionComposition';
import {
  loadMetadataJobContext,
  MetadataJobContext,
  requestFromMetadataContext,
  SupabaseMetadataProductionGateway,
} from '../../supabase/functions/_shared/imageInventory/runtime/metadataProductionGateway';

export type MetadataWorkerDependencies = Readonly<{
  workerId: string;
  workerAuthToken: string;
  serviceClient: any;
  primary: MetadataProviderAdapter | null;
  primaryCapability: ProviderCapabilityDeclaration | null;
  editionFallback?: OpenLibraryEditionOptionsAdapter;
  // Optional installed descriptor manifest supplied by the bootstrap (U3) or
  // the test harness. When present, automatic and explicit share the resolved
  // registry route; the unbound manifest is never the execution map, so
  // readiness is never overridden to force routing. When absent, the legacy
  // capability route below is preserved for old callers.
  installed?: ReadonlyMap<string, ProviderDescriptor>;
  // Trusted composition port; production bootstrap installs the M68 RPC implementation.
  editionOptionsBoundary?: MetadataEditionOptionsBoundary;
}>;

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', pragma: 'no-cache' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const METADATA_JOB_CONCURRENCY = 3;

type MetadataClaim = Readonly<{
  id: string;
  attempt_count: number;
  lease_token: string;
}>;
type MetadataWorkerResult = Readonly<{
  outcome: 'edition_options_available' | 'accepted_metadata_match' | 'coalesced_follower' | 'local_canonical_match'
    | 'manual_metadata_required' | 'retry_scheduled' | 'stale_claim';
}>;

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
async function validCredential(request: Request, expected: string): Promise<boolean> {
  const supplied = request.headers.get('authorization') ?? '';
  const expectedHeader = `Bearer ${expected}`;
  const [left, right] = await Promise.all([digest(supplied), digest(expectedHeader)]);
  let different = supplied.length ^ expectedHeader.length;
  for (let index = 0; index < left.length; index += 1) different |= left[index] ^ right[index];
  return different === 0;
}

function completionResult(value: unknown): MetadataWorkerResult {
  const status = value && typeof value === 'object' && 'status' in value
    ? (value as { status?: unknown }).status : undefined;
  return { outcome: status === 'retry_scheduled'
    ? 'retry_scheduled' : 'manual_metadata_required' };
}

async function resolveSupersededEditionJob(
  claim: MetadataClaim,
  dependencies: MetadataWorkerDependencies,
): Promise<boolean> {
  try {
    const superseded = await dependencies.serviceClient.rpc('phase9_resolve_superseded_edition_job_v1', {
      p_job_id: claim.id,p_worker: dependencies.workerId,
      p_lease_token: claim.lease_token,p_attempt_count: claim.attempt_count,
    });
    return !superseded.error && superseded.data?.status === 'resolved_noop';
  } catch {
    // Keep the stale outcome when claim-fenced cleanup cannot be confirmed.
    return false;
  }
}

// Binds the verified per-job registry policyVersion to the installed OL
// descriptor. Only a row the resolver may route can confer readiness: the
// single enabled metadata row for open_library@1.0.0 whose accepted versions
// contain it. Zero or more-than-one qualifying rows bind nothing, so a
// disabled, non-metadata, or duplicate row never makes an entry ready, and
// election and completion behaviour are unchanged.
export function bindVerifiedRegistryPolicy(
  installed: ReadonlyMap<string, ProviderDescriptor>,
  registry: RegistrySnapshot,
  openLibrary: OpenLibraryEditionOptionsAdapter | null,
): ReadonlyMap<string, ProviderDescriptor> {
  if (openLibrary === null) return installed;
  const qualifying = registry.providers.filter((row) =>
    row.providerKind === 'metadata'
    && row.enabled
    && row.adapterKey === 'open_library'
    && row.adapterVersion === OPEN_LIBRARY_ADAPTER_VERSION
    && row.acceptedAdapterVersions.includes(OPEN_LIBRARY_ADAPTER_VERSION));
  if (qualifying.length !== 1) return installed;
  const row = qualifying[0];
  const key = providerManifestKey(row.adapterKey, row.adapterVersion);
  if (!installed.has(key)) return installed;
  const next = new Map(installed);
  next.set(key, createOpenLibraryV1Descriptor({
    adapter: openLibrary, policyVersion: row.policyVersion,
  }));
  return next;
}

async function processRoutedClaim(
  claim: MetadataClaim,
  dependencies: MetadataWorkerDependencies,
  context: MetadataJobContext,
  installed: ReadonlyMap<string, ProviderDescriptor>,
): Promise<MetadataWorkerResult> {
  // Receipt-first local short-circuit (02c §3.2: resolve local first). A
  // durable local canonical edition resolves without any provider route or
  // egress, so it is checked before the registry read. The provisional
  // gateway needs a real configured primary (its type requires one); with no
  // primary the claim fails closed below instead of inventing gateway config.
  if (context.purpose === 'automatic' && context.localCanonicalEditionId !== null
    && dependencies.primary !== null && dependencies.primaryCapability !== null) {
    const provisional = new SupabaseMetadataProductionGateway(dependencies.serviceClient, {
      worker: dependencies.workerId, context, primary: dependencies.primary,
      adapterKey: dependencies.primaryCapability.adapterKey,
      adapterVersion: dependencies.primaryCapability.adapterVersion,
      capabilityVersion: dependencies.primaryCapability.capabilityVersion,
      schemaVersion: 'p9-metadata-foundation-v1',
      lookupContractVersion: 'p9-metadata-lookup-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      routingPolicyVersion: 'p9-metadata-routing-v1',
      selectionPolicyVersion: 'p9-metadata-selection-v1',
      snapshotVersion: 'p9-selected-metadata-v1', cachePolicyVersion: 'p9-metadata-cache-v1',
      cacheNamespace: 'metadata-v1', pricingPolicyVersion: 'metadata-zero-cost-v1',
      revalidationSeconds: 86400,
    });
    const local = await provisional.resolveLocal({
      ...requestFromMetadataContext(context), claimWorker: dependencies.workerId,
      providerPolicy: {
        enabled: false, adapterVersionCompatible: false,
        capabilityVersionCompatible: false,
        matchingAllowed: false, storageAllowed: false,
        reuseAllowed: false, pricingPolicyCompatible: true,
      },
    });
    if (local.outcome === 'matched') return { outcome: 'local_canonical_match' };
  }
  // Persisted evidence (a registered lookup, attempt, or physical call, or a
  // known attempt disposition) means a previous provider flow touched this
  // job: it is not fresh. Run receipt-first recovery, then refuse new egress.
  // The resolver is never called with resumed:null over an existing attempt,
  // so no fresh route can execute against old lookup/attempt identity — for
  // unknown or registered sends this stays recovery-only (02c §5.1). An
  // M93-authorized next-claim retry cannot be distinguished here (the round
  // allowance is private to M93; neither an older claim number nor
  // retryable=true proves authorization), so its round-1 execution is a U5
  // dependency; U2 preserves every receipt U5 needs to complete it.
  if (hasPersistedEvidence(context)) {
    if (context.purpose === 'edition_options') {
      if (dependencies.editionOptionsBoundary === undefined) {
        return { outcome: 'manual_metadata_required' };
      }
      const fence = editionOptionsFence(context, dependencies.workerId);
      const recovered = await dependencies.editionOptionsBoundary.recover(fence);
      if (recovered.status === 'completed' || recovered.status === 'replayed') {
        if (recovered.requestId !== fence.requestId
          || recovered.requestGeneration !== fence.requestGeneration
          || !Number.isSafeInteger(recovered.optionsVersion)
          || recovered.optionsVersion < 1
          || !Number.isFinite(Date.parse(recovered.optionsExpiresAt))) {
          throw new Error('P9_EDITION_COMPLETION_INVALID');
        }
        return Date.parse(recovered.optionsExpiresAt) > Date.now()
          ? { outcome: 'edition_options_available' }
          : { outcome: 'manual_metadata_required' };
      }
      if (recovered.status === 'stale_rejected') {
        await resolveSupersededEditionJob(claim, dependencies);
        return { outcome: 'stale_claim' };
      }
      return completionResult(await dependencies.editionOptionsBoundary.fail({
        ...fence, outcome: 'provider_disabled', retryable: false,
      }));
    }
    // Automatic: receipt-first through the existing finalized-attempt path
    // when the old lookup/attempt identity exists; otherwise fail closed.
    // No new fetch is issued from this branch.
    if (context.currentLookupId !== null && context.currentAttemptId !== null
      && dependencies.primary !== null && dependencies.primaryCapability !== null) {
      const provisional = new SupabaseMetadataProductionGateway(dependencies.serviceClient, {
        worker: dependencies.workerId, context, primary: dependencies.primary,
        adapterKey: dependencies.primaryCapability.adapterKey,
        adapterVersion: dependencies.primaryCapability.adapterVersion,
        capabilityVersion: dependencies.primaryCapability.capabilityVersion,
        schemaVersion: 'p9-metadata-foundation-v1',
        lookupContractVersion: 'p9-metadata-lookup-v1',
        normalizerVersion: 'p9-bibliographic-normalizer-v1',
        routingPolicyVersion: 'p9-metadata-routing-v1',
        selectionPolicyVersion: 'p9-metadata-selection-v1',
        snapshotVersion: 'p9-selected-metadata-v1', cachePolicyVersion: 'p9-metadata-cache-v1',
        cacheNamespace: 'metadata-v1', pricingPolicyVersion: 'metadata-zero-cost-v1',
        revalidationSeconds: 86400,
      });
      const resumed = await provisional.resumeFinalizedAttempt({
        ...requestFromMetadataContext(context), claimWorker: dependencies.workerId,
        providerPolicy: {
          enabled: false, adapterVersionCompatible: false,
          capabilityVersionCompatible: false,
          matchingAllowed: false, storageAllowed: false,
          reuseAllowed: false, pricingPolicyCompatible: true,
        },
        lookupId: context.currentLookupId, attemptId: context.currentAttemptId,
      });
      if (resumed !== null) return resumed;
    }
    const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
      p_job_id: context.jobId,p_worker: dependencies.workerId,
      p_lease_token: context.claimToken,p_attempt_count: context.attempt,
      p_candidate_id: context.candidateId,p_candidate_version: context.candidateVersion,
      p_query_identity: context.queryIdentity,p_failure_kind: 'provider_disabled',
      p_retryable: false,
    });
    if (failed.error) throw new Error('P9_METADATA_COMPLETION_FAILED');
    return completionResult(failed.data);
  }
  // Service-only registry read for genuinely fresh jobs only. A failed read
  // never falls back to legacy election: the claim fails closed below.
  const configuration = await dependencies.serviceClient.rpc(
    'phase9_provider_configuration_v1',
  );
  if (configuration === null || typeof configuration !== 'object'
    || ((configuration as { error?: unknown }).error !== null
      && (configuration as { error?: unknown }).error !== undefined)) {
    throw new Error('P9_METADATA_RPC_FAILED:phase9_provider_configuration_v1');
  }
  const registry = parseProviderConfigurationSnapshot(
    (configuration as { data?: unknown }).data,
  );
  // U3 narrow binding: the boot manifest carries no per-job registry policy,
  // so OL retention readiness is false there (openLibrary/descriptor.ts
  // requires a non-null policy version). Rebind the OL descriptor with this
  // job's verified registry policyVersion before routing. The version comes
  // from the parsed service-only snapshot (a validated safe integer >= 1),
  // never a dummy; the adapter is the production fallback instance, never a
  // stub. Unbound entries (Google without a key) stay not-ready and the
  // resolver still refuses them; no manifest entry is forced ready.
  const boundInstalled = bindVerifiedRegistryPolicy(
    installed, registry, dependencies.editionFallback ?? null,
  );
  // Automatic and explicit share the same resolved route; invalid routes
  // throw before any egress. Existing context/claim checks are unchanged.
  // Evidence is absent here, so resumed is always null: fresh routing only.
  const route = editionProviderRoute({ context, registry, installed: boundInstalled });
  if ('manual' in route) {
    if (context.purpose === 'edition_options' && dependencies.editionOptionsBoundary) {
      return completionResult(await dependencies.editionOptionsBoundary.fail({
        ...editionOptionsFence(context, dependencies.workerId),
        outcome: 'provider_disabled', retryable: false,
      }));
    }
    if (context.purpose === 'edition_options') {
      return { outcome: 'manual_metadata_required' };
    }
    const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
      p_job_id: context.jobId,p_worker: dependencies.workerId,
      p_lease_token: context.claimToken,p_attempt_count: context.attempt,
      p_candidate_id: context.candidateId,p_candidate_version: context.candidateVersion,
      p_query_identity: context.queryIdentity,p_failure_kind: 'provider_disabled',
      p_retryable: false,
    });
    if (failed.error) throw new Error('P9_METADATA_COMPLETION_FAILED');
    return completionResult(failed.data);
  }
  // The unbound manifest is never the execution map. The configured adapter
  // must serve the exact selected key@version with the exact contract tuple;
  // a key-only match never runs under a relabelled version. The rebound
  // factory descriptor is identity-only: credentials and retention readiness
  // were already verified on the selected manifest descriptor by the resolver.
  const configured = [dependencies.primary, dependencies.editionFallback ?? null];
  const adapterForKey = (adapterKey: string): MetadataProviderAdapter | null =>
    configured.find((adapter) =>
      adapter?.normalizedEditionHostPolicy?.adapterKey === adapterKey) ?? null;
  const reboundDescriptorFor = (
    adapterKey: string, adapter: MetadataProviderAdapter,
  ): ProviderDescriptor | null => {
    if (adapterKey === 'google_books') {
      return createGoogleBooksDescriptor({
        adapter: adapter as unknown as GoogleBooksAdapter,
      });
    }
    if (adapterKey === 'open_library') {
      return createOpenLibraryV1Descriptor({
        adapter: adapter as unknown as OpenLibraryEditionOptionsAdapter,
        policyVersion: null,
      });
    }
    return null;
  };
  const sameContractTuple = (left: ProviderDescriptor, right: ProviderDescriptor): boolean =>
    left.validationContract === right.validationContract
    && left.hostPolicyVersion === right.hostPolicyVersion
    && left.capabilityVersion === right.capabilityVersion
    && left.normalizerVersion === right.normalizerVersion
    && left.payloadSchemaVersion === right.payloadSchemaVersion
    && left.lookupSchemaVersion === right.lookupSchemaVersion;
  const bindAdapter = (descriptor: ProviderDescriptor): MetadataProviderAdapter | null => {
    const candidate = adapterForKey(descriptor.adapterKey);
    if (candidate === null) return null;
    const rebound = reboundDescriptorFor(descriptor.adapterKey, candidate);
    if (rebound === null || rebound.adapterVersion !== descriptor.adapterVersion
      || !sameContractTuple(rebound, descriptor)) {
      return null;
    }
    return candidate;
  };
  const primary = bindAdapter(route.primary);
  // Capability derives from the selected descriptor and its registry row: the
  // resolver verified registry enabled/matching/storage for this row, so the
  // value below is derived, not forced.
  const selectedRow = registry.providers.find((row) =>
    row.adapterKey === route.primary.adapterKey
    && row.adapterVersion === route.primary.adapterVersion) ?? null;
  const capability = {
    adapterKey: route.primary.adapterKey,
    adapterVersion: route.primary.adapterVersion,
    capabilityVersion: route.primary.capabilityVersion,
    enabled: selectedRow !== null && selectedRow.enabled
      && selectedRow.matchingAllowed && selectedRow.storageAllowed,
  } as ProviderCapabilityDeclaration;
  if (primary === null) {
    const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
      p_job_id: context.jobId,p_worker: dependencies.workerId,
      p_lease_token: context.claimToken,p_attempt_count: context.attempt,
      p_candidate_id: context.candidateId,p_candidate_version: context.candidateVersion,
      p_query_identity: context.queryIdentity,p_failure_kind: 'provider_disabled',
      p_retryable: false,
    });
    if (failed.error) throw new Error('P9_METADATA_COMPLETION_FAILED');
    return completionResult(failed.data);
  }
  const provider = context.providerPolicies.find((item) =>
    item.adapterKey === capability.adapterKey
    && item.adapterVersion === capability.adapterVersion);
  const request = {
    ...requestFromMetadataContext(context, {
      adapterKey: capability.adapterKey, adapterVersion: capability.adapterVersion,
    }),
    claimWorker: dependencies.workerId,
    providerPolicy: {
      enabled: provider?.enabled ?? false,adapterVersionCompatible: provider !== undefined,
      capabilityVersionCompatible: capability.enabled,
      matchingAllowed: provider?.matchingAllowed ?? false,
      storageAllowed: provider?.storageAllowed ?? false,
      reuseAllowed: provider?.reuseAllowed ?? false,pricingPolicyCompatible: true,
    },
  };
  const gateway = new SupabaseMetadataProductionGateway(dependencies.serviceClient, {
    worker: dependencies.workerId, context, primary,
    adapterKey: capability.adapterKey, adapterVersion: capability.adapterVersion,
    capabilityVersion: capability.capabilityVersion,
    schemaVersion: 'p9-metadata-foundation-v1',
    lookupContractVersion: 'p9-metadata-lookup-v1',
    normalizerVersion: route.primary.normalizerVersion,
    routingPolicyVersion: 'p9-metadata-routing-v1',
    selectionPolicyVersion: 'p9-metadata-selection-v1',
    snapshotVersion: 'p9-selected-metadata-v1', cachePolicyVersion: 'p9-metadata-cache-v1',
    cacheNamespace: 'metadata-v1', pricingPolicyVersion: 'metadata-zero-cost-v1',
    revalidationSeconds: 86400,
    // The resolver's selected row policy for this fresh key/version. (Only
    // direct resolver callers carry resumed historical identity; the worker
    // never manufactures lineage, so this is always the current row policy.)
    selectedPolicyVersion:
      route.policyVersions[providerManifestKey(capability.adapterKey, capability.adapterVersion)],
    editionOptions: context.purpose === 'edition_options' && dependencies.editionOptionsBoundary
      ? { request,boundary: dependencies.editionOptionsBoundary } : undefined,
  });
  if (context.purpose === 'edition_options') {
    const fallbackAdapter = route.secondary === null
      ? null : bindAdapter(route.secondary);
    const fallback = fallbackAdapter as unknown as OpenLibraryEditionOptionsAdapter | undefined;
    const result = await executeEditionOptionsLookup(
      context,gateway,
      primary as OpenLibraryEditionOptionsAdapter,
      new AbortController().signal,fallback,
    );
    if (result.outcome === 'stale_claim') await resolveSupersededEditionJob(claim,dependencies);
    return result;
  }
  return await runMetadataProductionComposition(request,gateway);
}

async function processMetadataClaim(
  claim: MetadataClaim,
  dependencies: MetadataWorkerDependencies,
): Promise<MetadataWorkerResult> {
  let context: MetadataJobContext | null = null;
  try {
    context = await loadMetadataJobContext(dependencies.serviceClient, {
      jobId: claim.id,worker: dependencies.workerId,
      leaseToken: claim.lease_token,attempt: claim.attempt_count,
    });
    if (dependencies.installed !== undefined) {
      return await processRoutedClaim(claim,dependencies,context,dependencies.installed);
    }
    // Fixture mode and old callers without an installed manifest keep the
    // legacy capability route. Real mode always supplies the manifest from
    // production bootstrap, so production never takes this path. Owned by
    // later units; the routed path above is the 8b behavior.
    const job: MetadataJobContext = context;
    const google = dependencies.primary instanceof GoogleBooksAdapter ? dependencies.primary : null;
    const library = dependencies.editionFallback ?? null;
    const allowed = (key: string,version: string) => job.providerPolicies.some((row) =>
      row.adapterKey === key && row.adapterVersion === version && row.enabled
      && row.matchingAllowed && row.storageAllowed);
    const resumedKey = job.currentAttemptAdapterKey ?? job.currentLookupAdapterKey;
    const route = job.purpose !== 'edition_options' ? null
      : resumedKey === 'open_library' ? library && allowed('open_library','1.0.0')
        ? { adapter: library,capability: OPEN_LIBRARY_CAPABILITY,fallback: null } : null
      : resumedKey === 'google_books' && library && !google?.optionsRetentionConfigured ? null
      : google && dependencies.primaryCapability && allowed('google_books',dependencies.primaryCapability.adapterVersion)
        && (google.optionsRetentionConfigured || !library)
        ? { adapter: google,capability: dependencies.primaryCapability,
          fallback: library && allowed('open_library','1.0.0') ? library : null }
      : library && allowed('open_library','1.0.0')
        ? { adapter: library,capability: OPEN_LIBRARY_CAPABILITY,fallback: null } : null;
    if (context.purpose === 'edition_options' && (!dependencies.editionOptionsBoundary || !route)) {
      if (dependencies.editionOptionsBoundary) {
        return completionResult(await dependencies.editionOptionsBoundary.fail({
          ...editionOptionsFence(context,dependencies.workerId),outcome:'provider_disabled',retryable:false,
        }));
      }
      return { outcome: 'manual_metadata_required' };
    }
    const primary = route?.adapter ?? dependencies.primary;
    const primaryCapability = route?.capability ?? dependencies.primaryCapability;
    if (primary === null || primaryCapability === null) {
      const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
        p_job_id: context.jobId,p_worker: dependencies.workerId,
        p_lease_token: context.claimToken,p_attempt_count: context.attempt,
        p_candidate_id: context.candidateId,p_candidate_version: context.candidateVersion,
        p_query_identity: context.queryIdentity,p_failure_kind: 'provider_disabled',
        p_retryable: false,
      });
      if (failed.error) throw new Error('P9_METADATA_COMPLETION_FAILED');
      return completionResult(failed.data);
    }
    const capability = primaryCapability;
    const provider = context.providerPolicies.find((item) =>
      item.adapterKey === capability.adapterKey
      && item.adapterVersion === capability.adapterVersion);
    const request = {
      ...requestFromMetadataContext(context),claimWorker: dependencies.workerId,
      providerPolicy: {
        enabled: provider?.enabled ?? false,adapterVersionCompatible: provider !== undefined,
        capabilityVersionCompatible: capability.enabled,
        matchingAllowed: provider?.matchingAllowed ?? false,
        storageAllowed: provider?.storageAllowed ?? false,
        reuseAllowed: provider?.reuseAllowed ?? false,pricingPolicyCompatible: true,
      },
    };
    const gateway = new SupabaseMetadataProductionGateway(dependencies.serviceClient, {
      worker: dependencies.workerId,context,primary,
      adapterKey: capability.adapterKey,adapterVersion: capability.adapterVersion,
      capabilityVersion: capability.capabilityVersion,
      schemaVersion: 'p9-metadata-foundation-v1',
      lookupContractVersion: 'p9-metadata-lookup-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      routingPolicyVersion: 'p9-metadata-routing-v1',
      selectionPolicyVersion: 'p9-metadata-selection-v1',
      snapshotVersion: 'p9-selected-metadata-v1',cachePolicyVersion: 'p9-metadata-cache-v1',
      cacheNamespace: 'metadata-v1',pricingPolicyVersion: 'metadata-zero-cost-v1',
      revalidationSeconds: 86400,
      editionOptions: context.purpose === 'edition_options' && dependencies.editionOptionsBoundary
        ? { request, boundary: dependencies.editionOptionsBoundary } : undefined,
    });
    if (context.purpose === 'edition_options') {
      const result = await executeEditionOptionsLookup(
        context, gateway, route!.adapter, new AbortController().signal, route!.fallback ?? undefined,
      );
      if (result.outcome === 'stale_claim') await resolveSupersededEditionJob(claim, dependencies);
      return result;
    }
    return await runMetadataProductionComposition(request, gateway);
  } catch (error) {
    if (context?.purpose === 'edition_options' || context === null) {
      if (await resolveSupersededEditionJob(claim, dependencies)) return { outcome: 'stale_claim' };
      if (context?.purpose === 'edition_options'
        || (error instanceof Error && error.message === 'P9_EDITION_CONTEXT_INVALID')) return { outcome: 'stale_claim' };
    }
    try {
      const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
        p_job_id: context?.jobId ?? claim.id,p_worker: dependencies.workerId,
        p_lease_token: context?.claimToken ?? claim.lease_token,
        p_attempt_count: context?.attempt ?? claim.attempt_count,
        p_candidate_id: context?.candidateId ?? null,
        p_candidate_version: context?.candidateVersion ?? null,
        p_query_identity: context?.queryIdentity ?? null,
        p_failure_kind: 'provider_unavailable',p_retryable: true,
      });
      return failed.error ? { outcome: 'stale_claim' } : completionResult(failed.data);
    } catch {
      return { outcome: 'stale_claim' };
    }
  }
}

async function claimMetadataJobs(
  batchSize: number,
  dependencies: MetadataWorkerDependencies,
): Promise<readonly MetadataClaim[]> {
  const claimed = await dependencies.serviceClient.rpc('claim_phase9_metadata_jobs', {
    p_batch_size: batchSize,p_worker: dependencies.workerId,
  });
  if (claimed.error || !Array.isArray(claimed.data)
    || claimed.data.length > batchSize) throw new Error('P9_METADATA_CLAIM_FAILED');
  return claimed.data;
}

export async function runMetadataWorkerBatch(
  batchSize: number,
  dependencies: MetadataWorkerDependencies,
) {
  const results: Array<MetadataWorkerResult | undefined> = [];
  const active = new Set<Promise<void>>();
  let remaining = batchSize;
  let claimedCount = 0;
  let queueExhausted = false;
  let claimFailure: unknown;

  const launch = (claim: MetadataClaim, resultIndex: number) => {
    let task: Promise<void>;
    task = processMetadataClaim(claim, dependencies)
      .then((result) => { results[resultIndex] = result; })
      .finally(() => { active.delete(task); });
    active.add(task);
  };

  while ((remaining > 0 && !queueExhausted) || active.size > 0) {
    if (remaining > 0 && !queueExhausted && active.size < METADATA_JOB_CONCURRENCY) {
      const capacity = Math.min(METADATA_JOB_CONCURRENCY - active.size, remaining);
      let claims: readonly MetadataClaim[];
      try {
        claims = await claimMetadataJobs(capacity, dependencies);
      } catch (error) {
        claimFailure = error;
        queueExhausted = true;
        continue;
      }
      if (claims.length < capacity) queueExhausted = true;
      for (const claim of claims) {
        const resultIndex = claimedCount;
        claimedCount += 1;
        remaining -= 1;
        launch(claim, resultIndex);
      }
      continue;
    }
    if (active.size === 0) break;
    await Promise.race(active);
  }
  await Promise.all(active);
  if (claimFailure !== undefined) throw claimFailure;
  return { claimed: claimedCount, results: results.filter(
    (result): result is MetadataWorkerResult => result !== undefined,
  ) };
}

export async function handlePhase9MetadataWorker(
  request: Request,
  dependencies: MetadataWorkerDependencies,
): Promise<Response> {
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  if (!await validCredential(request, dependencies.workerAuthToken)) {
    return response({ error: 'forbidden' }, 403);
  }
  try {
    const body = parseDedicatedMetadataWorkerRequest(await request.json());
    const result = await runMetadataWorkerBatch(body.batchSize, dependencies);
    assertSafeIngestionResponse(result);
    return response(result);
  } catch {
    return response({ error: 'P9_WORKER_REQUEST_INVALID' }, 400);
  }
}
