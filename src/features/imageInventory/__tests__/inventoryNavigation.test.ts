import {
    inventoryRoutes,
    parseCandidateRouteParams,
    parseSessionRouteParams,
} from '../navigation/inventoryRoutes';

const sessionId = '00000000-0000-4000-8000-000000000001';
const candidateId = '00000000-0000-4000-8000-000000000002';

describe('Phase 9 Unit 6B typed inventory navigation', () => {
    it('builds only the approved nested route paths with opaque identifiers', () => {
        expect(inventoryRoutes.root()).toBe('/(store-owner)/inventory');
        expect(inventoryRoutes.reviews()).toBe('/(store-owner)/inventory/reviews');
        expect(inventoryRoutes.scan()).toBe('/(store-owner)/inventory/scan');
        expect(inventoryRoutes.preview(sessionId)).toEqual({
            pathname: '/(store-owner)/inventory/scan/preview',
            params: { sessionId },
        });
        expect(inventoryRoutes.session(sessionId)).toBe(
            `/(store-owner)/inventory/scan/${sessionId}`,
        );
        expect(inventoryRoutes.candidate(sessionId, candidateId)).toBe(
            `/(store-owner)/inventory/scan/${sessionId}/candidate/${candidateId}`,
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
        expect(parseCandidateRouteParams({ sessionId, candidateId })).toEqual({
            sessionId,
            candidateId,
        });
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

    it.each([
        { sessionId, candidateId: undefined },
        { sessionId, candidateId: 'not-a-uuid' },
        { sessionId: 'not-a-uuid', candidateId },
        { sessionId, candidateId: [candidateId] },
    ])('rejects invalid candidate identity without partial recovery: %p', (params) => {
        expect(parseCandidateRouteParams(params)).toBeNull();
    });
});
