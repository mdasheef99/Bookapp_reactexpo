import {
    buildReviewInput,
    createReviewDraft,
    reviewDraftFingerprint,
} from '../review/reviewForm';
import { candidateDetailFixture, sessionSummaryFixture, testUuid } from '../testing/ownerUxTestFixtures';

describe('Phase 9 Unit 6D strict review form model', () => {
    it('starts from original Unicode evidence and session defaults without transliteration', () => {
        const draft = createReviewDraft(candidateDetailFixture(), sessionSummaryFixture().defaults);
        expect(draft).toMatchObject({
            originalTitle: 'ಕನ್ನಡ ಪುಸ್ತಕ',
            authors: ['ಲೇಖಕ ಒಬ್ಬರು'],
            originalLanguage: 'kn',
            script: 'Knda',
            metadataMode: 'manual',
            quantity: '1',
            priceMinor: '',
            baseCondition: 'good',
            shelfLocation: 'Shelf A1',
            publicationIntent: 'private',
        });
        expect(draft.originalFieldConfirmation).toEqual({ title: false, authors: [false] });
    });

    it('normalizes trim/NFC while preserving script and accepts every exact reviewed field', () => {
        const draft = createReviewDraft(candidateDetailFixture(), sessionSummaryFixture().defaults);
        Object.assign(draft, {
            originalTitle: '  ಕನ್ನಡ ಪುಸ್ತಕ  ',
            titleConfirmed: true,
            priceMinor: '12500',
            hasDamage: true,
            damageTypes: ['cover'],
            damageNote: '  ಸಣ್ಣ ಗುರುತು  ',
            publicNote: '  Original script preserved  ',
            internalNote: '',
        });
        draft.originalFieldConfirmation = { title: true, authors: [true] };

        const result = buildReviewInput(draft);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.originalTitle).toBe('ಕನ್ನಡ ಪುಸ್ತಕ');
        expect(result.data.authors).toEqual(['ಲೇಖಕ ಒಬ್ಬರು']);
        expect(result.data.damageDisclosure.damageNote).toBe('ಸಣ್ಣ ಗುರುತು');
        expect(result.data.notes.internalNote).toBeNull();
    });

    it.each([
        ['fractional quantity', { quantity: '1.5' }],
        ['unsafe quantity', { quantity: '10001' }],
        ['publish without positive price', { publicationIntent: 'publish', priceMinor: '0' }],
        ['legacy condition', { baseCondition: 'fair' }],
        ['damage without detail', { hasDamage: true, damageTypes: [], damageNote: '' }],
        ['unconfirmed title', { titleConfirmed: false }],
        ['active content', { originalTitle: '<script>bad</script>' }],
    ])('rejects %s', (_label, patch) => {
        const draft = createReviewDraft(candidateDetailFixture(), sessionSummaryFixture().defaults);
        Object.assign(draft, {
            priceMinor: '100',
            ...patch,
        });
        draft.originalFieldConfirmation = { title: true, authors: [true] };
        if ('titleConfirmed' in patch) {
            draft.originalFieldConfirmation.title = Boolean(patch.titleConfirmed);
        }
        expect(buildReviewInput(draft).success).toBe(false);
    });

    it('treats legacy duplicate advice and intent as non-authoritative', () => {
        const detail = candidateDetailFixture({
            duplicateAdvice: {
                state: 'possible_match',
                version: 3,
                targetInventoryId: testUuid(8),
                matchReason: 'strong_original_match',
                compatibility: {
                    sameLanguage: true,
                    sameFormat: true,
                    sameCondition: true,
                    samePrice: true,
                    noCopySpecificDamageOrNote: true,
                },
                display: {
                    title: 'Existing',
                    authors: ['Author'],
                    isbn10: null,
                    isbn13: null,
                    language: 'en',
                    format: null,
                    condition: 'good',
                    priceMinor: 100,
                    availableQuantity: 1,
                    hasDamage: false,
                    hasApprovedPublicCopyPhoto: false,
                    hasCopySpecificNote: false,
                    location: 'A1',
                },
                allowedIntents: ['increment_quantity', 'create_separate'],
            },
            readiness: {
                reviewReady: false,
                blockers: [],
                derivedFromCandidateVersion: 4,
                derivedFromMetadataRevision: 7,
                derivedFromDuplicateAdviceVersion: 3,
            },
        });
        const draft = createReviewDraft(detail, sessionSummaryFixture().defaults);
        draft.priceMinor = '100';
        draft.originalFieldConfirmation = { title: true, authors: [true] };
        expect(buildReviewInput(draft).success).toBe(true);

        const before = reviewDraftFingerprint(draft);
        draft.duplicateIntent = {
            action: 'increment_quantity',
            targetInventoryId: testUuid(8),
            adviceVersion: 3,
        };
        const result = buildReviewInput(draft);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.duplicateIntent).toBeNull();
        expect(reviewDraftFingerprint(draft)).toBe(before);
    });

    it('forces mould or contamination to unsafe, unsellable, and private', () => {
        const draft = createReviewDraft(candidateDetailFixture(), sessionSummaryFixture().defaults);
        Object.assign(draft, {
            priceMinor: '100',
            hasDamage: true,
            damageTypes: ['mould_or_contamination'],
            damageNote: 'Visible mould on the cover.',
            isSellable: true,
            completeReadableSafe: true,
            publicationIntent: 'publish',
        });
        draft.originalFieldConfirmation = { title: true, authors: [true] };

        const result = buildReviewInput(draft);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.damageDisclosure).toMatchObject({
            isSellable: false,
            completeReadableSafe: false,
        });
        expect(result.data.publicationIntent).toBe('private');
    });

});
