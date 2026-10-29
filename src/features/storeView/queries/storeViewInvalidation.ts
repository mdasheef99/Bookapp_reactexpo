import type { QueryClient } from '@tanstack/react-query';
import { imageInventoryKeys, type ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';

/**
 * Identity-scoped Store View invalidation prefixes (§3.1).
 *
 * Stored queries are keyed under the owner's identity
 * (`[...imageInventoryKeys.identity(identity), '<family>', version, ...]`),
 * so refreshes must invalidate those prefixes. The bare `*.all` keys
 * (`[...root, '<family>', version]`, no identity) match nothing stored and
 * must not be used here.
 */
export function storeViewFamilyPrefixes(identity: ImageInventoryIdentity) {
    const base = imageInventoryKeys.identity(identity);
    return {
        storeView: [...base, 'storeView'],
        storeViewMedia: [...base, 'storeViewMedia'],
        storeViewHistory: [...base, 'storeViewHistory'],
        ownerRead: [...base, 'ownerRead'],
    } as const;
}

export type StoreViewFamilyPrefixes = ReturnType<typeof storeViewFamilyPrefixes>;

/** After a successful save or stock adjustment: page + detail, history, owner-read. */
export async function invalidateStoreViewAfterSave(
    client: QueryClient,
    identity: ImageInventoryIdentity,
): Promise<void> {
    const prefixes = storeViewFamilyPrefixes(identity);
    // R14: invalidate families in parallel so one stalled family can't block
    // the others.
    await Promise.all([
        client.invalidateQueries({ queryKey: prefixes.storeView }),
        client.invalidateQueries({ queryKey: prefixes.storeViewHistory }),
        client.invalidateQueries({ queryKey: prefixes.ownerRead }),
    ]);
}

/** After a successful photo reorder / remove / replace / add: page + detail, media, history, owner-read. */
export async function invalidateStoreViewAfterMedia(
    client: QueryClient,
    identity: ImageInventoryIdentity,
): Promise<void> {
    const prefixes = storeViewFamilyPrefixes(identity);
    // R14: invalidate families in parallel so one stalled family can't block
    // the others.
    await Promise.all([
        client.invalidateQueries({ queryKey: prefixes.storeView }),
        client.invalidateQueries({ queryKey: prefixes.storeViewMedia }),
        client.invalidateQueries({ queryKey: prefixes.storeViewHistory }),
        client.invalidateQueries({ queryKey: prefixes.ownerRead }),
    ]);
}
