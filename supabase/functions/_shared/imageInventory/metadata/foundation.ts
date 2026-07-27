import { MetadataCacheEntry, evaluateMetadataCache } from './cache';
import {
  LocalCanonicalEdition,
  LocalCanonicalResolution,
  localCanonicalResolution,
} from './localResolution';

export type MetadataFoundationPlan =
  | Readonly<{
    outcome: 'local_canonical_match';
    local: LocalCanonicalResolution;
    cacheStatus: 'not_checked';
    reserveProviderUsage: false;
  }>
  | Readonly<{
    outcome: 'cache_hit';
    local: LocalCanonicalResolution;
    cacheStatus: 'hit';
    cacheOutcome: MetadataCacheEntry['outcome'];
    reserveProviderUsage: false;
  }>
  | Readonly<{
    outcome: 'external_lookup_required';
    local: LocalCanonicalResolution;
    cacheStatus: 'miss' | 'expired' | 'invalidated' | 'incompatible';
    reserveProviderUsage: true;
  }>;

export function planMetadataFoundation(input: Parameters<typeof localCanonicalResolution>[0], editions:
readonly LocalCanonicalEdition[], cache: MetadataCacheEntry | null, now: string,
expectedCache: Parameters<typeof evaluateMetadataCache>[2]): MetadataFoundationPlan {
  const local = localCanonicalResolution(input, editions);
  if (local.outcome === 'local_canonical_match') {
    return { outcome: local.outcome, local, cacheStatus: 'not_checked', reserveProviderUsage: false };
  }
  const cached = evaluateMetadataCache(cache, now, expectedCache);
  if (cached.status === 'hit') {
    return {
      outcome: 'cache_hit',
      local,
      cacheStatus: 'hit',
      cacheOutcome: cached.outcome,
      reserveProviderUsage: false,
    };
  }
  return {
    outcome: 'external_lookup_required',
    local,
    cacheStatus: cached.status,
    reserveProviderUsage: true,
  };
}
