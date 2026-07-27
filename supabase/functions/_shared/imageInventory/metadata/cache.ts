export type MetadataCacheOutcome = 'positive' | 'negative' | 'ambiguous';

export type MetadataCacheEntry = Readonly<{
  key: string;
  queryKey: string;
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  normalizerVersion: string;
  schemaVersion: string;
  cachePolicyVersion: string;
  reusePolicyVersion: string;
  privacyScope: 'public_bibliographic' | 'store_private';
  storeId: string | null;
  outcome: MetadataCacheOutcome;
  normalizedSnapshot: Readonly<Record<string, unknown>> | null;
  provenance: Readonly<{ attemptId: string }>;
  createdAt: string;
  expiresAt: string;
  invalidatedAt: string | null;
}>;

export function createMetadataCacheEntry(input: MetadataCacheEntry): MetadataCacheEntry {
  const created = Date.parse(input.createdAt);
  const expires = Date.parse(input.expiresAt);
  if (!Number.isFinite(created) || !Number.isFinite(expires) || expires <= created) {
    throw new Error('metadata cache expiry must follow creation');
  }
  if (input.outcome === 'positive' && input.normalizedSnapshot === null) {
    throw new Error('positive metadata cache requires a normalized snapshot');
  }
  if (input.outcome !== 'positive' && input.normalizedSnapshot !== null) {
    throw new Error('non-positive metadata cache cannot carry a selected snapshot');
  }
  for (const value of [
    input.key, input.queryKey, input.adapterKey, input.adapterVersion,
    input.capabilityVersion, input.normalizerVersion, input.schemaVersion,
    input.cachePolicyVersion, input.reusePolicyVersion,
  ]) {
    if (!value.trim()) throw new Error('metadata cache identity versions are required');
  }
  if ((input.privacyScope === 'public_bibliographic') !== (input.storeId === null)) {
    throw new Error('metadata cache privacy scope and store scope are inconsistent');
  }
  return Object.freeze({ ...input });
}

export type MetadataCacheResult =
  | Readonly<{ status: 'hit'; outcome: MetadataCacheOutcome; entry: MetadataCacheEntry }>
  | Readonly<{ status: 'miss' | 'expired' | 'invalidated' | 'incompatible'; outcome: null; entry: null }>;

export function evaluateMetadataCache(
  entry: MetadataCacheEntry | null,
  now: string,
  expected: Readonly<Pick<MetadataCacheEntry,
    'key' | 'queryKey' | 'adapterKey' | 'adapterVersion' | 'capabilityVersion'
    | 'normalizerVersion' | 'schemaVersion' | 'cachePolicyVersion'
    | 'reusePolicyVersion' | 'privacyScope' | 'storeId'>>,
): MetadataCacheResult {
  if (entry === null) return { status: 'miss', outcome: null, entry: null };
  if (Object.entries(expected).some(
    ([key, value]) => entry[key as keyof MetadataCacheEntry] !== value,
  )) return { status: 'incompatible', outcome: null, entry: null };
  if (entry.invalidatedAt !== null) return { status: 'invalidated', outcome: null, entry: null };
  if (Date.parse(entry.expiresAt) <= Date.parse(now)) {
    return { status: 'expired', outcome: null, entry: null };
  }
  return { status: 'hit', outcome: entry.outcome, entry };
}

export type MetadataReuseIdentity = Readonly<{
  lookupId: string;
  queryKey: string;
  providerCacheKey: string;
  routingPolicyVersion: string;
  privacyScope: 'public_bibliographic' | 'store_private';
  reusePolicyVersion: string;
  cacheNamespace: string;
  storeId: string;
}>;

export function planIdenticalQueryReuse(
  leader: MetadataReuseIdentity,
  candidate: MetadataReuseIdentity,
): Readonly<{
  mode: 'leader' | 'follower';
  leaderLookupId: string | null;
  createsProviderCharge: boolean;
}> {
  const samePrivateScope = leader.privacyScope === 'store_private'
    && candidate.privacyScope === 'store_private'
    && leader.storeId === candidate.storeId;
  const privacyCompatible = leader.privacyScope === 'public_bibliographic'
    && candidate.privacyScope === 'public_bibliographic' || samePrivateScope;
  const identical = privacyCompatible
    && leader.queryKey === candidate.queryKey
    && leader.providerCacheKey === candidate.providerCacheKey
    && leader.routingPolicyVersion === candidate.routingPolicyVersion
    && leader.reusePolicyVersion === candidate.reusePolicyVersion
    && leader.cacheNamespace === candidate.cacheNamespace;
  return identical
    ? { mode: 'follower', leaderLookupId: leader.lookupId, createsProviderCharge: false }
    : { mode: 'leader', leaderLookupId: null, createsProviderCharge: true };
}
