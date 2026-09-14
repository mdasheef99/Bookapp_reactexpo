import type { MetadataProductionGateway } from './metadataProductionComposition';

export async function persistCacheAfterTerminal(
  gateway: MetadataProductionGateway,
  input: Parameters<MetadataProductionGateway['persistCache']>[0],
): Promise<void> {
  try {
    await gateway.persistCache(input);
  } catch {
    // Cache is derived reuse state and cannot reverse durable terminalization.
  }
}

export async function persistRepresentativeCoverAfterTerminal(
  gateway: MetadataProductionGateway,
  input: Parameters<MetadataProductionGateway['persistRepresentativeCover']>[0],
): Promise<void> {
  try { await gateway.persistRepresentativeCover(input); } catch {
    // Optional owner-private presentation data cannot reverse accepted metadata.
    console.warn('[phase9] representative-cover persistence failed', {
      lookupId: input.lookupId,
      attemptId: input.attemptId,
      errorCode: 'P9_REPRESENTATIVE_COVER_PERSISTENCE_FAILED',
    });
  }
}
