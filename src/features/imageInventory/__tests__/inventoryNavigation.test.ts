import {
    inventoryRoutes,
    parseSessionRouteParams,
} from '../navigation/inventoryRoutes';

const sessionId = '00000000-0000-4000-8000-000000000001';

describe('Phase 9 Unit 6B typed inventory navigation', () => {
    it('builds only the approved nested route paths with opaque identifiers', () => {
        expect(inventoryRoutes.root()).toBe('/(store-owner)/inventory');
        expect(inventoryRoutes.scan()).toBe('/(store-owner)/inventory/scan');
        expect(inventoryRoutes.preview(sessionId)).toEqual({
            pathname: '/(store-owner)/inventory/scan/preview',
            params: { sessionId },
        });
        expect(inventoryRoutes.session(sessionId)).toBe(
            `/(store-owner)/inventory/scan/${sessionId}`,
        );
        expect(inventoryRoutes.missed(sessionId)).toBe(
            `/(store-owner)/inventory/scan/${sessionId}/missed`,
        );
        expect(inventoryRoutes.summary(sessionId)).toBe(
            `/(store-owner)/inventory/scan/${sessionId}/summary`,
        );
    });

    it('accepts one UUID per dynamic route parameter', () => {
        expect(parseSessionRouteParams({ sessionId })).toEqual({ sessionId });
    });

    it.each([
        {},
        { sessionId: 'not-a-uuid' },
        { sessionId: [sessionId] },
        { sessionId: '' },
        { sessionId, storeId: 'private-client-hint' },
    ])('rejects a missing, malformed, or repeated session parameter: %p', (params) => {
        expect(parseSessionRouteParams(params)).toBeNull();
    });

    // Post-scan SDD-1 §6 (4a), AC4-1.
    it.each(['candidate', 'reviews'])('has no candidate or reviews helper: %s', (name) => {
        expect(inventoryRoutes).not.toHaveProperty(name);
    });
});
