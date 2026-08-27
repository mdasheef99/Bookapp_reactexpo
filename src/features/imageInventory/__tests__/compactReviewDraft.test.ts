import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import {
    buildCompactReview,
    compactReviewDisplay,
} from '../review/compactReviewDraft';

const savedReview: OwnerCandidateReview = {
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

const defaults = {
    languageHint: 'en',
    condition: 'very_good' as const,
    location: 'Batch shelf',
    priceMinor: 25_000,
    quantity: 1,
    publication: 'publish' as const,
    script: null,
    batchLabel: '',
};

function card(overrides: Partial<OwnerBatchReviewCard> = {}): OwnerBatchReviewCard {
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

function expectDisplayAndSave(
    value: OwnerBatchReviewCard,
    field: keyof ReturnType<typeof compactReviewDisplay>,
    expected: unknown,
    edits: Parameters<typeof compactReviewDisplay>[2] = {},
) {
    const display = compactReviewDisplay(value, defaults, edits);
    const review = buildCompactReview(value, defaults, edits);
    expect(display[field]).toEqual(expected);
    expect(review).not.toBeNull();
    const reviewField = {
        title: 'originalTitle',
        authors: 'authors',
        language: 'originalLanguage',
        condition: 'baseCondition',
        priceMinor: 'priceMinor',
        quantity: 'quantity',
        location: 'shelfLocation',
        publication: 'publicationIntent',
        damage: 'damageDisclosure',
    }[field];
    expect(review?.[reviewField as keyof OwnerCandidateReview]).toEqual(expected);
}

describe('Phase 9 Unit 6G compact draft field/source authority', () => {
    it('uses observed language when the server source is detected', () => {
        expectDisplayAndSave(card({
            fieldSources: { ...card().fieldSources, language: 'detected' },
        }), 'language', 'fr');
    });

    it('uses the session hint when language source is default', () => {
        expectDisplayAndSave(card({
            fieldSources: { ...card().fieldSources, language: 'default' },
        }), 'language', 'en');
    });

    it.each([
        ['title', 'Observed title'],
        ['authors', ['Observed author']],
    ] as const)('uses observed %s when the server source is detected', (field, expected) => {
        expectDisplayAndSave(card({
            fieldSources: { ...card().fieldSources, [field]: 'detected' },
        }), field, expected);
    });

    it.each([
        ['title', 'Saved title'],
        ['authors', ['Saved author']],
        ['language', 'hi'],
    ] as const)('uses the saved %s when the server source is custom', (field, expected) => {
        expectDisplayAndSave(card({
            fieldSources: { ...card().fieldSources, [field]: 'custom' },
        }), field, expected);
    });

    it.each([
        ['title', 'Selected title'],
        ['authors', ['Selected author']],
        ['language', 'de'],
    ] as const)('uses selected %s when the server source is matched', (field, expected) => {
        expectDisplayAndSave(card({
            review: null,
            reviewVersion: null,
            reviewDisposition: null,
            fieldSources: { ...card().fieldSources, [field]: 'matched' },
        }), field, expected, {
            metadataChoice: { mode: 'selected', selectionId: savedReview.metadataChoice.selectionId },
        });
    });

    it('keeps every saved commercial value identical between display and strict Save', () => {
        expectDisplayAndSave(card(), 'condition', 'good');
        expectDisplayAndSave(card(), 'priceMinor', 30_000);
        expectDisplayAndSave(card(), 'quantity', 2);
        expectDisplayAndSave(card(), 'location', 'Saved shelf');
        expectDisplayAndSave(card(), 'publication', 'private');
        expectDisplayAndSave(card(), 'damage', savedReview.damageDisclosure);
    });

    it('blocks strict Save when a missing identity source has no usable value', () => {
        const value = card({
            review: null,
            reviewVersion: null,
            reviewDisposition: null,
            metadataState: 'pending',
            metadataSummary: null,
            fieldSources: {
                ...card().fieldSources,
                title: 'missing', authors: 'missing', language: 'missing',
            },
        });
        expect(compactReviewDisplay(value, defaults, {})).toMatchObject({
            title: '', authors: [], language: '',
        });
        expect(buildCompactReview(value, defaults, {})).toBeNull();
    });

    it('uses only applicable session defaults for non-metadata fields', () => {
        const value = card({
            review: null,
            reviewVersion: null,
            fieldSources: {
                ...card().fieldSources,
                condition: 'default', price: 'default', location: 'default',
                publication: 'default', quantity: 'default', damage: 'default',
            },
        });
        const display = compactReviewDisplay(value, defaults, {});
        expect(display).toMatchObject({
            condition: 'very_good', priceMinor: 25_000, location: 'Batch shelf',
            publication: 'publish', quantity: 1,
            damage: {
                hasDamage: false, damageTypes: [], damageNote: null,
                isSellable: true, completeReadableSafe: true,
            },
        });
        const review = buildCompactReview(value, defaults, {
            metadataChoice: { mode: 'selected', selectionId: savedReview.metadataChoice.selectionId },
        });
        expect(review).toMatchObject({
            baseCondition: 'very_good', priceMinor: 25_000, shelfLocation: 'Batch shelf',
            publicationIntent: 'publish', quantity: 1,
            damageDisclosure: display.damage,
        });
    });
});
