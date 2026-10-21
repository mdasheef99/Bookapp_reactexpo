import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import {
    buildCompactReview,
    compactReviewDisplay,
    validateCompactReview,
} from '../review/compactReviewDraft';
import { candidateCommitPreparation, candidateCanStartBulkCommit, candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';
import { selectedChoices, pickerCard, pickerDefaults, pickerReview } from '../testing/editionPickerClientFixtures';
import { scriptCard, scriptCases, scriptDefaults, scriptReview } from '../testing/compactScriptFixtures';
import { isLanguageScriptCoherent } from '../contracts/ownerUxValidation';

import { card, defaults, savedReview } from '../testing/compactReviewDraftFixtures';

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

    it('defaults a selected provider snapshot when no saved review exists', () => {
        const value = card({
            review: null,
            reviewVersion: null,
            reviewDisposition: null,
        });
        expect(buildCompactReview(value, defaults, {})).toMatchObject({
            originalTitle: 'Selected title',
            authors: ['Selected author'],
            metadataChoice: {
                mode: 'selected',
                selectionId: savedReview.metadataChoice.selectionId,
            },
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

    it('blocks compact Add when no author is present', () => {
        const base = card();
        const value = card({
            review: null,
            reviewVersion: null,
            reviewDisposition: null,
            metadataState: 'manual',
            metadataSummary: null,
            observed: { ...base.observed, authors: [] },
            fieldSources: { ...base.fieldSources, authors: 'missing' },
        });
        expect(buildCompactReview(value, defaults, {
            metadataChoice: { mode: 'manual', selectionId: null },
        })).toBeNull();
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

// SDD-1 §4: shared Add requirements and chosen-edition identity.
it.each([
    [{ priceMinor: null }, 'Set a whole-rupee selling price.'],
    [{ priceMinor: 0 }, 'Enter a price above ₹0.'],
    [{ baseCondition: undefined }, 'Choose a condition.'],
    [{ quantity: 0 }, 'Set a quantity from 1 to 10,000.'],
    [{ authors: [] }, 'Add an author.'],
] as const)('requires price above zero, condition, quantity and an author for Add: %p', (patch, message) => {
    const value = card({ review: { ...savedReview, ...patch } as OwnerCandidateReview,
        fieldSources: { ...card().fieldSources, authors: 'custom' } });
    const result = validateCompactReview(value, { ...defaults, condition: null,
        priceMinor: 'priceMinor' in patch && patch.priceMinor === null ? null : defaults.priceMinor }, {});
    expect(result.issues.map(issue => issue.safeMessage)).toContain(message);
    expect(result.review).toBeNull();
    const draft = { card: value, edits: {}, acceptedAuthorityKey: candidateCommitAuthorityKey(value) };
    expect(candidateCommitPreparation(draft)).toBeNull();
    expect(candidateCanStartBulkCommit(draft)).toBe(false);
});
it('defaults to manual details only after the lookup ends', () => {
    const value = card({ review: null, reviewVersion: null, metadataState: 'no_match', metadataSummary: null,
        fieldSources: { ...card().fieldSources, title: 'detected', authors: 'detected', language: 'detected' } });
    expect(validateCompactReview(value, defaults, {}).review?.metadataChoice).toEqual({ mode: 'manual', selectionId: null });
    expect(validateCompactReview({ ...value, metadataState: 'pending' }, defaults, {})).toEqual({
        review: null, issues: [{ field: 'metadataChoice', safeMessage: 'Finding the edition…' }],
    });
});
it.each([
    { originalTitle: 'Corrected title' }, { authors: ['Corrected author'] },
    { originalLanguage: 'fr' }, { script: null },
])('an identity edit, including script, turns the edition choice to manual: %p', edits => {
    const choices = selectedChoices({ reviewVersion: 1 });
    const value = pickerCard(choices, { ...pickerReview, priceMinor: 100 });
    const result = validateCompactReview(value, pickerDefaults, edits, choices);
    expect(result.review).not.toBeNull();
    expect(result.review?.metadataChoice).toEqual({ mode: 'manual', selectionId: null });
});
it('keeps an unchanged chosen edition and its selling edits controlled', () => {
    const choices = selectedChoices({ reviewVersion: 1 });
    const value = pickerCard(choices, { ...pickerReview, priceMinor: 100 });
    expect(validateCompactReview(value, pickerDefaults, { quantity: 5 }, choices).review).toMatchObject({
        quantity: 5, metadataChoice: { mode: 'edition_option', selectionId: choices.selection!.selectionId },
    });
});

it('an effective script edit clears the edition before edition choices load', () => {
    const choices = selectedChoices({ reviewVersion: 1 });
    const value = pickerCard(choices, { ...pickerReview, script: null, priceMinor: 100 });
    expect(validateCompactReview(value, pickerDefaults, { script: 'Latn' }).review?.metadataChoice)
        .toEqual({ mode: 'manual', selectionId: null });
});

it.each(['selection', 'session', 'candidate'] as const)('does not trust a stale %s snapshot for the saved edition choice', mismatch => {
    const choices = selectedChoices({ reviewVersion: 1 });
    const value = pickerCard(choices, { ...pickerReview, priceMinor: 100 });
    const stale = { ...choices,
        sessionId: mismatch === 'session' ? card().sessionId : choices.sessionId,
        candidateId: mismatch === 'candidate' ? card().candidateId : choices.candidateId,
        selection: { ...choices.selection!,
            selectionId: mismatch === 'selection' ? card().review!.metadataChoice.selectionId! : choices.selection!.selectionId,
            snapshot: { ...choices.selection!.snapshot, title: 'Edition A' } },
    };
    const result = validateCompactReview(value, pickerDefaults, { originalTitle: 'Edition A' }, stale);
    expect(result.review?.metadataChoice).toEqual({ mode: 'manual', selectionId: null });
    expect(result.review?.script).toBe(pickerReview.script);
    const unowned = { ...pickerCard(choices), observed: { ...pickerCard(choices).observed, script: null } };
    const unownedResult = validateCompactReview(unowned, pickerDefaults,
        { originalTitle: 'Edition A', priceMinor: 100 }, stale);
    // SDD-1 §6 (4b): untrusted choice becomes manual, then derives from the card text.
    expect(unownedResult.review?.metadataChoice).toEqual({ mode: 'manual', selectionId: null });
    expect(unownedResult.review?.script).toBe('Latn');
});

it('keeps a pending card blocked even when stale choices are ready', () => {
    const choices = selectedChoices({ reviewVersion: 1 });
    const value = { ...pickerCard(choices, { ...pickerReview, priceMinor: 100 }), metadataState: 'pending' as const };
    expect(validateCompactReview(value, pickerDefaults, {}, choices)).toEqual({
        review: null, issues: [{ field: 'metadataChoice', safeMessage: 'Finding the edition…' }],
    });
});

// Post-scan SDD-1 §6 Notes (4a), AC4-5: preservation controls, no notes editor.
it('sends empty notes when none are saved', () => {
    const review = buildCompactReview(card({ review: null, reviewVersion: null }), defaults, {});
    expect(review).not.toBeNull();
    expect(review?.notes).toEqual({ publicNote: null, internalNote: null });
});
it('keeps notes already saved', () => {
    const value = card({ review: { ...savedReview, notes: {
        publicNote: 'Owner public note', internalNote: 'Private shelf history',
    } } });
    const review = buildCompactReview(value, defaults, { priceMinor: 4200 });
    expect(review).not.toBeNull();
    expect(review?.notes).toEqual({ publicNote: 'Owner public note', internalNote: 'Private shelf history' });
});

// SDD-1 §6 (4b), AC4-7 / AC4-10. Null remains a successful manual path.
describe('script recomputation', () => {
    it.each(scriptCases)('recomputes script from title, authors and language: $name', input => {
        const value = scriptCard(input);
        const result = validateCompactReview(value, scriptDefaults, {});
        expect(result.issues).toEqual([]);
        expect(result.review?.script).toBe(input.expected);
        expect(candidateCanStartBulkCommit({ card: value, edits: {}, review: result.review!,
            acceptedAuthorityKey: candidateCommitAuthorityKey(value) })).toBe(true);
    });
    it('keeps a null script when nothing fits', () => {
        const result = validateCompactReview(scriptCard(scriptCases[2]), scriptDefaults, {});
        expect(result.review).toMatchObject({ script: null, metadataChoice: { mode: 'manual', selectionId: null } });
        expect(result.issues).toEqual([]);
    });
    it.each([scriptCases[3], scriptCases[4], scriptCases[18]])('keeps a null script when only the app rule fits: $name', input => {
        expect(isLanguageScriptCoherent([input.title, ...input.authors].join(' '), input.language, 'Latn')).toBe(true);
        expect(validateCompactReview(scriptCard(input), scriptDefaults, {}).review).toMatchObject({ script: null });
    });
    it.each(scriptCases.slice(5, 11))('follows the language tag\'s script subtag: $name', input => {
        const result = validateCompactReview(scriptCard(input), scriptDefaults, {});
        expect(result.review?.script).toBe(input.expected);
        expect(result.review?.originalLanguage).toBe(input.language === 'HI-latn' ? 'hi-Latn' : input.language);
    });
    it('keeps the saved script when nothing changed', () => {
        const value = scriptCard();
        value.review = scriptReview({ originalTitle: 'Kamal', authors: ['Amar'], originalLanguage: 'hi-Latn', script: 'Latn' });
        value.fieldSources = { ...value.fieldSources, title: 'custom', authors: 'custom', language: 'custom' };
        expect(validateCompactReview(value, scriptDefaults, {
            originalTitle: '  Kamal  ', authors: [' Amar '], originalLanguage: 'HI-latn', quantity: 4, script: 'Deva',
        }).review).toMatchObject({ script: 'Latn', originalTitle: 'Kamal', authors: ['Amar'], originalLanguage: 'hi-Latn' });
    });
    it.each(['edition_option', 'selected'] as const)('keeps the edition\'s script and choice: %s', mode => {
        for (const script of [null, 'Latn']) {
            const choices = selectedChoices({ reviewVersion: 1 });
            choices.selection = { ...choices.selection!, snapshot: { ...choices.selection!.snapshot, script } };
            const saved = { ...pickerReview, priceMinor: 100, script,
                metadataChoice: { mode, selectionId: choices.selection.selectionId } };
            expect(validateCompactReview(pickerCard(choices, saved), pickerDefaults, {}, choices).review)
                .toMatchObject({ script, metadataChoice: saved.metadataChoice });
        }
    });
    it('recomputes after an identity edit switches to manual', () => {
        const choices = selectedChoices({ reviewVersion: 1 });
        const value = pickerCard(choices, { ...pickerReview, priceMinor: 100 });
        const result = validateCompactReview(value, pickerDefaults, {
            originalTitle: 'कमल', authors: ['अमर A'], originalLanguage: 'hi',
        }, choices);
        expect(result.review).toMatchObject({ script: 'Deva', metadataChoice: { mode: 'manual', selectionId: null } });
    });
    it.each([
        { originalTitle: 'कमल कमल कमल कमल कमल' }, { authors: ['अमर अमर अमर अमर अमर'] }, { originalLanguage: 'hi' },
    ])('recomputes each changed saved identity field: %p', patch => {
        const value = scriptCard();
        value.review = scriptReview({ originalTitle: 'Title', authors: ['Author'], originalLanguage: 'en', script: 'Latn' });
        value.fieldSources = { ...value.fieldSources, title: 'custom', authors: 'custom', language: 'custom' };
        const result = validateCompactReview(value, scriptDefaults, patch);
        // Each independent edit remains valid, selecting a coherent script or null.
        expect(result.review).not.toBeNull();
        expect(result.review?.script).toBe('originalLanguage' in patch ? 'Latn' : null);
    });
    it('does not need another save after saving the recomputed script', () => {
        const value = scriptCard();
        const first = validateCompactReview(value, scriptDefaults, {}).review!;
        expect(first?.script).toBe('Deva');
        const saved: OwnerBatchReviewCard = { ...value, review: first, reviewVersion: 1, reviewReady: true,
            allowedActions: ['save_review', 'add_to_inventory'] as OwnerBatchReviewCard['allowedActions'],
            fieldSources: { ...value.fieldSources, title: 'custom', authors: 'custom', language: 'custom' } };
        const next = validateCompactReview(saved, scriptDefaults, {}).review!;
        expect(next).toEqual(first);
        expect(candidateCommitPreparation({ card: saved, edits: {}, review: next,
            acceptedAuthorityKey: candidateCommitAuthorityKey(saved) })).toMatchObject({ needsSave: false, resave: null });
    });
    it.each([
        { originalTitle: '<b>unsafe</b>' }, { authors: ['\u202Eunsafe'] }, { originalLanguage: 'not_a_tag' },
    ])('lets the schema report invalid normalization without recomputing: %p', edits => {
        expect(() => validateCompactReview(scriptCard(), scriptDefaults, edits)).not.toThrow();
        expect(validateCompactReview(scriptCard(), scriptDefaults, edits).review).toBeNull();
    });
    it.each([
        { title: 'Kannada title with kn gets Knda', input: scriptCases[9] },
        { title: 'Kannada title with kn-IN gets Knda', input: scriptCases[10] },
        { title: 'Telugu title with te gets Telu', input: scriptCases[11] },
        { title: 'Malayalam title with ml gets Mlym', input: scriptCases[12] },
    ])('$title', ({ input }) => {
        expect(validateCompactReview(scriptCard(input), scriptDefaults, {}).review).toMatchObject({ script: input.expected });
    });
});
