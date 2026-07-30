import { decodeOwnerUxResponse } from '../contracts/ownerUxContracts';

const uuid = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

describe('Phase 9 Unit 6C safe input contract', () => {
    it('decodes only the bounded Owner input presentation', () => {
        expect(decodeOwnerUxResponse('list_scan_inputs', {
            contractVersion: 'phase9-owner-ux-v1',
            data: {
                items: [{
                    inputId: uuid(1),
                    ordinal: 1,
                    sourceKind: 'camera',
                    inputState: 'processing',
                    inputVersion: 2,
                    presentationState: 'finding_books',
                    safeCode: null,
                    retryState: 'server_retrying',
                    terminal: false,
                    polling: true,
                    detectedCandidateCount: null,
                    acceptedCandidateCount: null,
                    createdAt: '2026-07-31T00:00:00.000Z',
                    updatedAt: '2026-07-31T00:01:00.000Z',
                }],
                pageInfo: { nextCursor: null, hasMore: false },
                sessionVersion: 3,
                presentationRevision: 4,
            },
        }).items[0].presentationState).toBe('finding_books');
    });

    it.each([
        { jobId: uuid(2) },
        { signedUrl: 'https://private.example' },
        { inputState: 'uploading' },
        { terminal: true, polling: true },
    ])('rejects raw, local-only, or contradictory input progress', (change) => {
        const item = {
            inputId: uuid(1),
            ordinal: 1,
            sourceKind: 'gallery',
            inputState: 'ready',
            inputVersion: 2,
            presentationState: 'ready',
            safeCode: null,
            retryState: 'none',
            terminal: true,
            polling: false,
            detectedCandidateCount: 1,
            acceptedCandidateCount: 1,
            createdAt: '2026-07-31T00:00:00.000Z',
            updatedAt: '2026-07-31T00:01:00.000Z',
            ...change,
        };
        expect(() => decodeOwnerUxResponse('list_scan_inputs', {
            contractVersion: 'phase9-owner-ux-v1',
            data: {
                items: [item],
                pageInfo: { nextCursor: null, hasMore: false },
                sessionVersion: 3,
                presentationRevision: 4,
            },
        })).toThrow();
    });
});
