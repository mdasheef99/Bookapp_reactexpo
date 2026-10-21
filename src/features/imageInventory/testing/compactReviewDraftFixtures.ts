// Shared compact-review test fixtures; SDD-1 section 6.
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
export const savedReview: OwnerCandidateReview = {
    originalTitle: 'Saved title',
    authors: ['Saved author'],
    originalLanguage: 'hi',
    script: 'Latn',
    metadataChoice: {
        mode: 'selected',
        selectionId: '00000000-0000-4000-8000-000000000099',
    },
    quantity: 2,
    priceMinor: 30_000,
    baseCondition: 'good',
    damageDisclosure: {
        hasDamage: true,
        damageTypes: ['cover'],
        damageNote: 'Bent corner',
        isSellable: true,
        completeReadableSafe: true,
    },
    shelfLocation: 'Saved shelf',
    notes: { publicNote: null, internalNote: null },
    publicationIntent: 'private',
    duplicateIntent: null,
    originalFieldConfirmation: { title: true, authors: [true] },
    candidateDisposition: 'reviewed',
};

export const defaults = {
    languageHint: 'en',
    condition: 'very_good' as const,
    location: 'Batch shelf',
    priceMinor: 25_000,
    quantity: 1,
    publication: 'publish' as const,
    script: null,
    batchLabel: '',
};

export function card(overrides: Partial<OwnerBatchReviewCard> = {}): OwnerBatchReviewCard {
    return {
        sessionId: '00000000-0000-4000-8000-000000000010',
        candidateId: '00000000-0000-4000-8000-000000000021',
        inputId: '00000000-0000-4000-8000-000000000001',
        ordinal: 1,
        candidateState: 'ready',
        candidateVersion: 2,
        metadataState: 'selected',
        metadataRevision: 3,
        reviewVersion: 1,
        reviewDisposition: 'reviewed',
        observed: {
            title: 'Observed title',
            authors: ['Observed author'],
            language: 'fr',
            script: 'Latn',
        },
        metadataSummary: {
            title: 'Selected title',
            authors: ['Selected author'],
            language: 'de',
            coverReference: null,
            selectionId: savedReview.metadataChoice.selectionId,
        },
        review: savedReview,
        fieldSources: {
            cover: 'missing',
            title: 'matched',
            authors: 'matched',
            language: 'matched',
            condition: 'custom',
            price: 'custom',
            quantity: 'custom',
            location: 'custom',
            publication: 'custom',
            damage: 'custom',
        },
        attentionCodes: [],
        blockers: [],
        reviewReady: true,
        allowedActions: ['save_review', 'add_to_inventory'],
        updatedAt: '2026-08-24T00:00:00.000Z',
        ...overrides,
    };
}

