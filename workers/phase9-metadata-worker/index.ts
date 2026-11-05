import { buildAutomaticFence, loadAutomaticEditionFence, MetadataAutomaticRpcError } from '../../supabase/functions/_shared/imageInventory/runtime/metadataAutomaticEditionFence';
import { recoverAutomaticMetadata } from '../../supabase/functions/_shared/imageInventory/runtime/metadataAutomaticExecution';
import { legacyAutomaticRetry } from './legacyAutomaticRetry';
import { editionProviderRoute, hasPersistedEvidence } from './editionProviderRoute';
import type { OpenLibraryEditionOptionsAdapter } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary';
import { OPEN_LIBRARY_CAPABILITY } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary';
import { createGoogleBooksDescriptor } from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks/descriptor';
import { createOpenLibraryV1Descriptor, createOpenLibraryV2Descriptor, OPEN_LIBRARY_V2_ADAPTER_VERSION } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary/descriptor';
import type { ProviderDescriptor } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import type { RegistrySnapshot } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import { providerManifestKey, tupleMatches } from '../../supabase/functions/_shared/imageInventory/metadata/providerDescriptor';
import { OPEN_LIBRARY_ADAPTER_VERSION } from '../../supabase/functions/_shared/imageInventory/metadata/openLibrary/normalizer';
import { parseProviderConfigurationSnapshot } from '../../supabase/functions/_shared/imageInventory/runtime/providerConfiguration';
import type { ProtectionState } from '../../supabase/functions/_shared/imageInventory/runtime/providerProtection';
import { createProtectionState, resolveProtectionContact } from '../../supabase/functions/_shared/imageInventory/runtime/providerProtection';
import type { ParsedProtectionPolicy } from '../../supabase/functions/_shared/imageInventory/runtime/providerProtection';
import { GoogleBooksAdapter } from '../../supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter';
import { executeDescriptorEditionOptions, executeEditionOptionsLookup } from '../../supabase/functions/_shared/imageInventory/runtime/metadataEditionOptions';
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
  // Unit B: worker-server contact map (contactId -> contact) for identifying
  // provider User-Agent values. Never logged, persisted or returned.
  providerContacts: Readonly<Record<string, string>>;
}>;

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', pragma: 'no-cache' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const METADATA_JOB_CONCURRENCY = 3;

// U6 fix1 (F9): full contract-tuple equality for adapter-backed execution
// (key, version AND validation/host/schema/normalizer contracts). Exported
// for direct unit tests; bindExecution applies it to every adapter arm.
export function sameContractTuple(
  left: ProviderDescriptor, right: ProviderDescriptor,
): boolean {
  return left.validationContract === right.validationContract
    && left.hostPolicyVersion === right.hostPolicyVersion
    && left.capabilityVersion === right.capabilityVersion
    && left.normalizerVersion === right.normalizerVersion
    && left.payloadSchemaVersion === right.payloadSchemaVersion
    && left.lookupSchemaVersion === right.lookupSchemaVersion;
}

// U6 fix1 (F3): ONE worker-owned protection state object per provider key,
// process-lifetime. Every fenced port for that provider (explicit, bridge,
// fallback) shares it, so pacing/breaker observations span concurrent claims
// and batches. Single-instance rollout only; never durable.
const workerProtectionStates = new Map<string, ProtectionState>();

export function getWorkerProtectionState(providerKey: string): ProtectionState {
  const existing = workerProtectionStates.get(providerKey);
  if (existing !== undefined) return existing;
  const created = createProtectionState();
  workerProtectionStates.set(providerKey, created);
  return created;
}

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
// descriptors (U6: v1 AND v2). A row qualifies only when it is an enabled
// metadata row for that exact installed version whose accepted versions
// contain it, with matchingAllowed/storageAllowed and an authorized explicit
// role or v2 automatic primary role, and whose versionContracts entry matches
// the installed descriptor tuple. Zero or more-than-one qualifying rows bind
// nothing for that version, as does a missing installed entry (fail closed).
// Complete route election and the remaining descriptor checks stay
// resolver-owned (e.g. a secondary without a primary still cannot route), so
// a bound row is not guaranteed routable; election and completion behaviour
// are unchanged.
// v1 rebinds adapter-backed (the boot entry carries no live adapter).
// v2 preserves the installed entry object (spread, including test-only
// observation wrappers) and only flips retention readiness: v2 execution is
// port-native and reads the row policy from the fenced port at invoke time
// (automatic.ts), so no factory replacement — and no wrapper loss — occurs.
export function bindVerifiedRegistryPolicy(
  installed: ReadonlyMap<string, ProviderDescriptor>,
  registry: RegistrySnapshot,
  openLibrary: OpenLibraryEditionOptionsAdapter | null,
): ReadonlyMap<string, ProviderDescriptor> {
  let next = installed;
  for (const version of [OPEN_LIBRARY_ADAPTER_VERSION, OPEN_LIBRARY_V2_ADAPTER_VERSION]) {
    const key = providerManifestKey('open_library', version);
    const installedDescriptor = next.get(key);
    if (installedDescriptor === undefined) continue;
    const qualifying = registry.providers.filter((row) =>
      row.providerKind === 'metadata'
      && row.enabled
      && row.matchingAllowed
      && row.storageAllowed
      && ((row.explicitSearchAllowed === true && row.explicitRole !== null)
        || (version === OPEN_LIBRARY_V2_ADAPTER_VERSION && row.automaticLookupAllowed && row.automaticRole === 'primary'))
      && row.adapterKey === 'open_library'
      && row.adapterVersion === version
      && row.acceptedAdapterVersions.includes(version)
      && tupleMatches(installedDescriptor, row.versionContracts[version]));
    if (qualifying.length !== 1) continue;
    if (!next.has(key)) continue;
    if (version === OPEN_LIBRARY_ADAPTER_VERSION) {
      if (openLibrary === null) continue;
      const copy = new Map(next);
      copy.set(key, createOpenLibraryV1Descriptor({
        adapter: openLibrary, policyVersion: qualifying[0].policyVersion,
      }));
      next = copy;
      continue;
    }
    const bound = installedDescriptor;
    const copy = new Map(next);
    // U5: bind readiness independently for each registry-authorized purpose.
    copy.set(key, {
      ...bound,
      retentionReady: (purpose: Parameters<ProviderDescriptor['retentionReady']>[0]) =>
        bound.purposes.includes(purpose) && (purpose === 'edition_options'
          ? qualifying[0].explicitSearchAllowed && qualifying[0].explicitRole !== null
          : qualifying[0].automaticLookupAllowed && qualifying[0].automaticRole === 'primary'),
    });
    next = copy;
  }
  return next;
}

// U6 fix1 (F6/S4): binds the verified per-job registry policyVersion to the
// installed Google descriptor so an explicitly-elected Google primary carries
// its independent retention verifier requirement (googleBooks/descriptor.ts:
// retentionPolicyVersion gates retentionContract). Same eligibility shape as
// the OL binding (exactly one eligible explicit row, accepted version, tuple
// match); inert while the registry keeps Google explicit off (8b). Google
// FILES are untouched — only worker-side binding.
export function bindGoogleRetentionPolicy(
  installed: ReadonlyMap<string, ProviderDescriptor>,
  registry: RegistrySnapshot,
  primary: MetadataProviderAdapter | null,
  primaryCapability: { adapterKey: string; adapterVersion: string } | null,
): ReadonlyMap<string, ProviderDescriptor> {
  if (primary === null || primaryCapability === null) return installed;
  if (primary.normalizedEditionHostPolicy?.adapterKey !== primaryCapability.adapterKey
    || primaryCapability.adapterKey !== 'google_books') {
    return installed;
  }
  const key = providerManifestKey(primaryCapability.adapterKey, primaryCapability.adapterVersion);
  const installedDescriptor = installed.get(key);
  if (installedDescriptor === undefined) return installed;
  const qualifying = registry.providers.filter((row) =>
    row.providerKind === 'metadata'
    && row.enabled
    && row.matchingAllowed
    && row.storageAllowed
    && row.explicitSearchAllowed === true
    && row.explicitRole !== null
    && row.adapterKey === primaryCapability.adapterKey
    && row.adapterVersion === primaryCapability.adapterVersion
    && row.acceptedAdapterVersions.includes(primaryCapability.adapterVersion)
    && tupleMatches(installedDescriptor, row.versionContracts[primaryCapability.adapterVersion]));
  if (qualifying.length !== 1 || !installed.has(key)) return installed;
  const next = new Map(installed);
  next.set(key, createGoogleBooksDescriptor({
    adapter: primary as unknown as GoogleBooksAdapter,
    retentionPolicyVersion: qualifying[0].policyVersion,
  }));
  return next;
}

// FIX2 D5/D6: durable refusal with the original claim; SQL rejects a lost lease.
async function failAutomaticClaim(context: MetadataJobContext, dependencies: MetadataWorkerDependencies,
  failureKind: 'policy_denied' | 'provider_disabled' = 'policy_denied') {
  const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
    p_job_id: context.jobId, p_worker: dependencies.workerId,
    p_lease_token: context.claimToken, p_attempt_count: context.attempt,
    p_candidate_id: context.candidateId, p_candidate_version: context.candidateVersion,
    p_query_identity: context.queryIdentity, p_failure_kind: failureKind, p_retryable: false,
  });
  if (failed.error) throw new Error('P9_METADATA_COMPLETION_FAILED');
  return completionResult(failed.data);
}

async function processRoutedClaim(
  claim: MetadataClaim,
  dependencies: MetadataWorkerDependencies,
  context: MetadataJobContext,
  installed: ReadonlyMap<string, ProviderDescriptor>,
): Promise<MetadataWorkerResult> {
  // Receipt-first local short-circuit (02c §3.2: resolve local first). A
  // durable local canonical edition resolves before registry/route reads,
  // including keyless runtimes. Local persistence does not require an adapter.
  if (context.purpose === 'automatic' && context.localCanonicalEditionId !== null) {
    const provisional = new SupabaseMetadataProductionGateway(dependencies.serviceClient, {
      worker: dependencies.workerId, context, primary: dependencies.primary,
      adapterKey: dependencies.primaryCapability?.adapterKey ?? '',
      adapterVersion: dependencies.primaryCapability?.adapterVersion ?? '',
      capabilityVersion: dependencies.primaryCapability?.capabilityVersion ?? '',
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
  const automaticRead = context.purpose === 'automatic'
    ? await loadAutomaticEditionFence(dependencies.serviceClient, { jobId: context.jobId,
      worker: dependencies.workerId, leaseToken: context.claimToken, attempt: context.attempt }) : null;
  const automaticFence = automaticRead === null ? null : buildAutomaticFence(context, dependencies.workerId, automaticRead);
  if (context.purpose === 'automatic' && hasPersistedEvidence(context)) {
    const recovered = await recoverAutomaticMetadata(dependencies.serviceClient, automaticFence);
    if (recovered !== null) return recovered;
  }
  if (context.purpose === 'edition_options' && hasPersistedEvidence(context)) {
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
  }
  // Service-only registry read for fresh jobs and M94-bound resumes. A failed read
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
  // Unit B (contact identity): every configured protection contactId must
  // resolve against worker-server configuration BEFORE any admission,
  // begin, reservation or lookup is created. An unresolvable contact reuses
  // the existing route-manual handling (no egress, manual fallback, no new
  // outcome codes).
  const providerContacts = dependencies.providerContacts ?? {};
  {
    // F1: own-key lookup only. An unmapped contactId that names an
    // inherited property ('toString', 'constructor', ...) must miss here
    // and take the route-manual handling below, never the resolver throw
    // (which would surface as stale_claim via the catch-all).
    const missing = registry.providers.some((row) => {
      if (row.protectionPolicy === null) return false;
      const contactId = (row.protectionPolicy as { contactId?: unknown }).contactId;
      if (typeof contactId !== 'string' || !Object.hasOwn(providerContacts, contactId)) {
        return true;
      }
      const contact = (providerContacts as Record<string, unknown>)[contactId];
      return typeof contact !== 'string' || contact.length === 0;
    });
    if (missing) {
      if (context.purpose === 'edition_options' && dependencies.editionOptionsBoundary) {
        return completionResult(await dependencies.editionOptionsBoundary.fail({
          ...editionOptionsFence(context, dependencies.workerId),
          outcome: 'provider_disabled', retryable: false,
        }));
      }
      if (context.purpose === 'edition_options') {
        return { outcome: 'manual_metadata_required' };
      }
      return failAutomaticClaim(context, dependencies, 'provider_disabled');
    }
  }
  // U3 narrow binding: the boot manifest carries no per-job registry policy,
  // so OL retention readiness is false there (openLibrary/descriptor.ts
  // requires a non-null policy version). Rebind the OL descriptor with this
  // job's verified registry policyVersion before routing. The version comes
  // from the parsed service-only snapshot (a validated safe integer >= 1),
  // never a dummy; the adapter is the production fallback instance, never a
  // stub. Unbound entries stay not-ready and the resolver still refuses them;
  // no manifest entry is forced ready. Google binds the same way when an
  // explicitly-eligible row exists (F6/S4; inert in 8b while Google explicit
  // stays off).
  const boundInstalled = bindGoogleRetentionPolicy(
    bindVerifiedRegistryPolicy(installed, registry, dependencies.editionFallback ?? null),
    registry, dependencies.primary, dependencies.primaryCapability,
  );
  let legacyRetry: Awaited<ReturnType<typeof legacyAutomaticRetry>> = null;
  if (context.purpose === 'automatic' && hasPersistedEvidence(context) && automaticRead?.lineage == null) {
    legacyRetry = await legacyAutomaticRetry(dependencies.serviceClient, context);
    const retryKey = legacyRetry?.adapterKey;
    const row = registry.providers.find(item => item.adapterKey === retryKey);
    const descriptor = legacyRetry === null ? null : boundInstalled.get(providerManifestKey(legacyRetry.adapterKey, legacyRetry.adapterVersion));
    if (!legacyRetry || !row || row.protectionPolicy !== null || descriptor?.protocol.kind !== 'single') return failAutomaticClaim(context, dependencies);
  }
  // Automatic and explicit share the same resolved route; invalid routes
  // throw before any egress. Existing context/claim checks are unchanged.
  // M94 supplies historical routing evidence; begin still owns retry authority.
  const route = editionProviderRoute({ context, registry, installed: boundInstalled, resumed: automaticRead?.lineage ?? legacyRetry });
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
    return failAutomaticClaim(context, dependencies, 'provider_disabled');
  }
  // The unbound manifest is never the execution map. Execution binding is
  // version-equality plus a live-adapter contract recheck (F9), never
  // instanceof or provider/version literals: a live adapter executes only the
  // elected row version it was installed for AND whose validation/host/
  // schema/normalizer contract still matches the elected descriptor tuple; any
  // other elected version for a known key (v2+ port-native) executes through
  // a fenced port with no live adapter. The rebound factories below are
  // slot-derived (fallback slot builds v1, primary slot builds Google) from
  // the same live instances the resolver checked — no wrapper is rebuilt for
  // execution (S4: no unbound wrapper can silently drop rows).
  type BoundExecution =
    | Readonly<{ kind: 'adapter'; adapter: MetadataProviderAdapter }>
    | Readonly<{ kind: 'port' }>;
  type LiveEntry = {
    adapter: MetadataProviderAdapter; key: string; version: string;
    rebound: () => ProviderDescriptor | null;
  };
  const live: LiveEntry[] = [];
  const fallbackAdapterForBinding = dependencies.editionFallback ?? null;
  if (fallbackAdapterForBinding !== null
    && typeof fallbackAdapterForBinding.normalizedEditionHostPolicy?.adapterKey === 'string') {
    const fallbackAdapter = fallbackAdapterForBinding;
    live.push({ adapter: fallbackAdapter,
      key: fallbackAdapter.normalizedEditionHostPolicy.adapterKey,
      version: OPEN_LIBRARY_ADAPTER_VERSION,
      rebound: () => createOpenLibraryV1Descriptor({
        adapter: fallbackAdapter as unknown as OpenLibraryEditionOptionsAdapter,
        policyVersion: null,
      }),
    });
  }
  if (dependencies.primary !== null && dependencies.primaryCapability !== null) {
    const primaryAdapter = dependencies.primary;
    live.push({ adapter: primaryAdapter,
      key: dependencies.primaryCapability.adapterKey,
      version: dependencies.primaryCapability.adapterVersion,
      rebound: () => createGoogleBooksDescriptor({
        adapter: primaryAdapter as unknown as GoogleBooksAdapter,
      }),
    });
  }
  const bindExecution = (descriptor: ProviderDescriptor): BoundExecution | null => {
    const entry = live.find((item) => item.key === descriptor.adapterKey
      && item.version === descriptor.adapterVersion);
    if (entry === undefined) {
      if (live.some((item) => item.key === descriptor.adapterKey)) return { kind: 'port' };
      return null;
    }
    // F9: the live adapter's contract must still match the elected tuple;
    // same key/version with a divergent contract refuses (fail closed).
    const rebound = entry.rebound();
    if (rebound === null || rebound.adapterVersion !== descriptor.adapterVersion
      || !sameContractTuple(rebound, descriptor)) {
      return null;
    }
    return { kind: 'adapter', adapter: entry.adapter };
  };
  const bound = bindExecution(route.primary);
  // Capability derives from the selected descriptor and its registry row: the
  // resolver verified registry enabled/matching/storage for this row, so the
  // value below is derived, not forced.
  const selectedRow = registry.providers.find((row) =>
    row.adapterKey === route.primary.adapterKey
    && row.adapterVersion === route.primary.adapterVersion) ?? null;
  // U6 fix1 (F6): the secondary row feeds the fallback port/validation with
  // its own versions, policy, hosts and retention binding — never the
  // primary's configuration.
  const secondaryRow = route.secondary === null ? null : (registry.providers.find((row) =>
    row.adapterKey === route.secondary!.adapterKey
    && row.adapterVersion === route.secondary!.adapterVersion) ?? null);
  // Unit B: resolved transient contacts for the identifying User-Agent,
  // carried OUTSIDE the registry policy objects (which pass through
  // unchanged). NULL policy resolves to NULL (legacy literal); the
  // claim-level check above guarantees every non-NULL policy resolves here.
  const primaryContact = resolveProtectionContact(
    (selectedRow?.protectionPolicy ?? null) as unknown as ParsedProtectionPolicy | null,
    providerContacts,
  );
  const secondaryContact = resolveProtectionContact(
    (secondaryRow?.protectionPolicy ?? null) as unknown as ParsedProtectionPolicy | null,
    providerContacts,
  );
  const capability = {
    adapterKey: route.primary.adapterKey,
    adapterVersion: route.primary.adapterVersion,
    capabilityVersion: route.primary.capabilityVersion,
    enabled: selectedRow !== null && selectedRow.enabled
      && selectedRow.matchingAllowed && selectedRow.storageAllowed,
  } as ProviderCapabilityDeclaration;
  if (bound === null) {
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
  // The gateway primary is vestigial for the explicit port arm (explicit
  // egress never calls invokePrimary); it carries a live adapter when bound
  // and the configured fallback otherwise. Documented, never invoked there.
  const primary: MetadataProviderAdapter = bound.kind === 'adapter' ? bound.adapter
    : (dependencies.editionFallback ?? dependencies.primary) as MetadataProviderAdapter;
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
    schemaVersion: route.primary.lookupSchemaVersion,
    lookupContractVersion: 'p9-metadata-lookup-v1',
    normalizerVersion: route.primary.normalizerVersion,
    routingPolicyVersion: 'p9-metadata-routing-v1',
    selectionPolicyVersion: 'p9-metadata-selection-v1',
    snapshotVersion: 'p9-selected-metadata-v1', cachePolicyVersion: 'p9-metadata-cache-v1',
    cacheNamespace: 'metadata-v1', pricingPolicyVersion: 'metadata-zero-cost-v1',
    revalidationSeconds: 86400,
    // Resolver-selected policy: current on fresh routes, M94 lookup policy on resumes.
    selectedPolicyVersion:
      route.policyVersions[providerManifestKey(capability.adapterKey, capability.adapterVersion)],
    automatic: automaticRead !== null && automaticFence !== null ? {
      read: automaticRead, fence: automaticFence, descriptor: route.primary, installed: boundInstalled, legacyRetry,
      policy: selectedRow?.protectionPolicy ?? null,
      providerContact: primaryContact,
      sharedProtection: getWorkerProtectionState(capability.adapterKey),
    } : undefined,
    // U6: descriptor-driven explicit binding from the verified route. Row
    // hosts/policy ride the parsed snapshot (older/test snapshots omit them:
    // null-tolerated). Transport bounds come from the installed OL adapter's
    // existing constructor-supplied values (S3); without them no port arm is
    // wired and port-native election fails closed below.
    explicitDescriptor: {
      descriptor: route.primary,
      adapter: bound.kind === 'adapter'
        ? bound.adapter as unknown as OpenLibraryEditionOptionsAdapter : null,
      fallbackAdapter: null,
      fallbackRoute: route.secondary === null ? null : {
        adapterKey: route.secondary.adapterKey,
        adapterVersion: route.secondary.adapterVersion,
        capabilityVersion: route.secondary.capabilityVersion,
        // G6: secondary attempt identity, never the primary's tuple.
        normalizerVersion: route.secondary.normalizerVersion,
        lookupSchemaVersion: route.secondary.lookupSchemaVersion,
      },
      // F6: the elected secondary descriptor itself (versions + contracts).
      fallbackDescriptor: route.secondary,
      // F6: secondary port/validation parameters from the SECONDARY row.
      fallbackExplicitHttp: (() => {
        if (route.secondary === null || secondaryRow === null) return undefined;
        const row = secondaryRow as { approvedRequestHosts?: unknown; protectionPolicy?: unknown };
        const hosts = Array.isArray(row.approvedRequestHosts)
          ? (row.approvedRequestHosts as readonly string[]) : undefined;
        const bounds = dependencies.editionFallback?.transportBinding ?? null;
        if (bounds === null) return undefined;
        const fallbackPolicy = dependencies.editionFallback?.normalizedEditionHostPolicy ?? null;
        return {
          policy: (row.protectionPolicy as unknown) ?? null, requestHosts: hosts,
          timeoutMs: bounds.timeoutMs, maxResponseBytes: bounds.maxResponseBytes,
          fetcher: bounds.fetcher,
          retentionPolicyVersion:
            route.policyVersions[providerManifestKey(
              route.secondary.adapterKey, route.secondary.adapterVersion)],
          rowHostPolicy: fallbackPolicy !== null
            && fallbackPolicy.adapterKey === route.secondary.adapterKey ? fallbackPolicy : null,
          providerContact: secondaryContact,
          // G1: provider-scoped (adapterKey only); v1/v2/fallback for the
          // same provider share one pacing/breaker object.
          sharedProtection: getWorkerProtectionState(route.secondary.adapterKey),
        };
      })(),
    },
    explicitHttp: (() => {
      const row = selectedRow as { approvedRequestHosts?: unknown; protectionPolicy?: unknown } | null;
      const hosts = Array.isArray(row?.approvedRequestHosts)
        ? (row.approvedRequestHosts as readonly string[]) : undefined;
      const policyValue = (row?.protectionPolicy as unknown) ?? null;
      const bounds = dependencies.editionFallback?.transportBinding ?? null;
      if (bounds === null) return undefined;
      // Row URL validation uses the installed OL adapter's host policy when
      // its key matches the elected descriptor (generic key equality, no
      // provider literals); port-native rows are validated against the same
      // trust their transport was fenced with.
      const fallbackPolicy = dependencies.editionFallback?.normalizedEditionHostPolicy ?? null;
      return {
        policy: policyValue, requestHosts: hosts,
        timeoutMs: bounds.timeoutMs, maxResponseBytes: bounds.maxResponseBytes,
        fetcher: bounds.fetcher,
        retentionPolicyVersion:
          route.policyVersions[providerManifestKey(capability.adapterKey, capability.adapterVersion)],
        rowHostPolicy: fallbackPolicy !== null
          && fallbackPolicy.adapterKey === route.primary.adapterKey ? fallbackPolicy : null,
        providerContact: primaryContact,
        // F3/G1: provider-scoped shared protection state (worker-owned), keyed
        // by adapterKey only so every version of one provider shares it.
        sharedProtection: getWorkerProtectionState(capability.adapterKey),
      };
    })(),
    editionOptions: context.purpose === 'edition_options' && dependencies.editionOptionsBoundary
      ? { request,boundary: dependencies.editionOptionsBoundary } : undefined,
  });
  if (context.purpose === 'edition_options') {
    const secondary = route.secondary === null ? null : bindExecution(route.secondary);
    const secondaryAdapter = secondary !== null && secondary.kind === 'adapter'
      ? secondary.adapter as unknown as OpenLibraryEditionOptionsAdapter : null;
    const result = await executeDescriptorEditionOptions(context, gateway, {
      descriptor: route.primary,
      adapter: bound.kind === 'adapter'
        ? bound.adapter as unknown as OpenLibraryEditionOptionsAdapter : null,
      fallbackAdapter: secondaryAdapter,
    }, new AbortController().signal);
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
      const result = await processRoutedClaim(claim,dependencies,context,dependencies.installed);
      return context.purpose === 'automatic' && result.outcome === 'stale_claim'
        ? await failAutomaticClaim(context, dependencies) : result;
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
    if (context?.purpose === 'automatic' && dependencies.installed !== undefined) {
      if (error instanceof MetadataAutomaticRpcError && !error.uncertain && error.message === 'P9_STATE_CONFLICT'
        || error instanceof Error && error.message === 'P9_PROVIDER_ROUTE_INVALID') {
        try { return await failAutomaticClaim(context, dependencies); } catch { return { outcome: 'stale_claim' }; }
      }
      // No generic fail/retry after an automatic routed operation. This also
      // intentionally hides programming errors behind stale_claim; the error
      // remains at the throwing boundary, never in the worker result.
      return { outcome: 'stale_claim' };
    }
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
