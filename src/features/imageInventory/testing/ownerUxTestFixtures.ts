import type {
    OwnerCandidateDetail,
    OwnerCandidatePage,
    OwnerSessionSummary,
} from '../contracts/ownerUxContracts';

export const testUuid = (digit: number) => (
    `00000000-0000-4000-8000-${String(digit).padStart(12, '0')}`
);

export function candidateDetailFixture(
    overrides: Partial<OwnerCandidateDetail> = {},
): OwnerCandidateDetail {
    const candidateId = testUuid(2);
    return {
        sessionId: testUuid(1),
        candidateId,
        inputId: testUuid(3),
        ordinal: 1,
        candidateState: 'needs_review',
        candidateVersion: 4,
        observed: {
            title: 'ಕನ್ನಡ ಪುಸ್ತಕ',
            authors: ['ಲೇಖಕ ಒಬ್ಬರು'],
            language: 'kn',
            script: 'Knda',
        },
        metadata: {
            state: 'manual',
            revision: 7,
            selectionVersion: null,
            selectionId: null,
            canonicalEditionId: null,
            snapshot: null,
        },
        review: { value: null, reviewVersion: null },
        duplicateAdvice: {
            state: 'none',
            version: null,
            targetInventoryId: null,
            matchReason: null,
            compatibility: null,
            display: null,
            allowedIntents: [],
        },
        variantSummary: { unresolvedCount: 0, proposalVersions: [] },
        attentionCodes: ['metadata_manual_required'],
        readiness: {
            reviewReady: false,
            blockers: [{
                code: 'review_missing',
                candidateId,
                inputId: null,
                field: null,
                safeMessage: 'Review this book.',
            }],
            derivedFromCandidateVersion: 4,
            derivedFromMetadataRevision: 7,
            derivedFromDuplicateAdviceVersion: null,
        },
        allowedActions: ['save_review', 'mark_false', 'add_missed', 'view_readiness'],
        updatedAt: '2026-07-31T00:00:00.000Z',
        ...overrides,
    };
}

export function sessionSummaryFixture(): OwnerSessionSummary {
    return {
        sessionId: testUuid(1),
        status: 'active',
        sessionVersion: 2,
        startedAt: '2026-07-31T00:00:00.000Z',
        updatedAt: '2026-07-31T00:00:00.000Z',
        closedAt: null,
        expiresAt: '2026-08-30T00:00:00.000Z',
        defaults: {
            language: 'en',
            script: null,
            condition: 'good',
            location: 'Shelf A1',
            quantity: 1,
            publication: 'private',
        },
        closeSummary: {
            imagesSubmitted: 1,
            imagesProcessed: 1,
            imagesFailed: 0,
            imagesSkipped: 0,
            candidatesDetected: 1,
            candidatesReviewReady: 0,
            candidatesNeedsReview: 1,
            candidatesFailed: 0,
            falseDetections: 0,
            manualMissedCandidates: 0,
            committedInventoryItems: 0,
            quantitiesAddedToExisting: 0,
            privateItems: 0,
            publishedItems: 0,
            languageSkips: 0,
            candidateCapSkips: 0,
            qualitySkips: 0,
        },
        allInputsTerminal: true,
        closeState: 'closeable',
        presentationRevision: 3,
    };
}

export function candidatePageFixture(
    items: OwnerCandidatePage['items'],
    nextCursor: string | null = null,
): OwnerCandidatePage {
    return {
        items,
        pageInfo: { nextCursor, hasMore: nextCursor !== null },
        scopeVersion: 1,
        sessionVersion: items[0]?.sessionStatus ? 2 : null,
    };
}
