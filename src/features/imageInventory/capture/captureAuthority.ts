import {
    getResolvedImageInventoryIdentity,
    type ImageInventoryIdentity,
} from '../queries/ownerUxQueries';

export const captureDefaults = {
    language: 'en',
    script: 'Latn',
    condition: 'good' as const,
};

export function hasCurrentCaptureIdentity(expected: ImageInventoryIdentity): boolean {
    const current = getResolvedImageInventoryIdentity();
    return current?.userId === expected.userId && current.storeId === expected.storeId;
}
