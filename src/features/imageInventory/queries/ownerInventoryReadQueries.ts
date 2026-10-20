import {
    OWNER_INVENTORY_CONTRACT_VERSION,
    type OwnerInventoryFilters,
} from '../api/ownerInventoryReadService';
import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';

type NormalizedFilters = Required<OwnerInventoryFilters>;

function normalizeFilters(filters: OwnerInventoryFilters = {}): NormalizedFilters {
    return {
        query: filters.query?.trim() ?? '',
        condition: filters.condition ?? 'all',
        visibilityStatus: filters.visibilityStatus ?? 'all',
        quantityState: filters.quantityState ?? 'all',
        entryMethod: filters.entryMethod ?? 'all',
        dateAdded: filters.dateAdded ?? 'all',
        publicationStatus: filters.publicationStatus ?? 'all',
    };
}

function keyFilters(filters: OwnerInventoryFilters = {}) {
    const normalized = normalizeFilters(filters);
    return {
        ...normalized,
        query: normalized.query.toLocaleLowerCase(),
    };
}

export const ownerInventoryReadKeys = {
    all: [...imageInventoryKeys.all, 'ownerRead', OWNER_INVENTORY_CONTRACT_VERSION] as const,
    list: (identity: ImageInventoryIdentity, filters: OwnerInventoryFilters = {}) => {
        const normalized = keyFilters(filters);
        return [
            ...imageInventoryKeys.identity(identity),
            'ownerRead',
            OWNER_INVENTORY_CONTRACT_VERSION,
            normalized.query,
            normalized.condition,
            normalized.visibilityStatus,
            normalized.quantityState,
            normalized.entryMethod,
            normalized.dateAdded,
            normalized.publicationStatus,
        ] as const;
    },
};
