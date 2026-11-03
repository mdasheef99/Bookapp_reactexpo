import {
    buildEditedChanges,
    buildStoreViewChanges,
    computeEditedSet,
    createStoreViewEditDraft,
    validateStoreViewEditDraft,
} from '../forms/storeViewEditForm';
import { item as baseItem } from './storeViewContracts.test';

const detail = {
    ...baseItem,
    privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
    stock: { quantityTotal: 2, quantityAvailable: 2, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
    historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
} as any;

describe('Unit 7C WU3 Store View edit form', () => {
    it('initializes every frozen editable field and returns no changes for a no-op', () => {
        const draft = createStoreViewEditDraft(detail);
        expect(draft).toMatchObject({
            title: detail.presentation.title,
            authors: 'Penelope Fitzgerald',
            language: 'en',
            sellingPriceMinor: '350',
            shelfLocation: 'A3',
            internalNotes: 'Owner note',
        });
        expect(buildStoreViewChanges(detail, draft)).toEqual({});
    });

    it('emits only changed allowed fields and normalizes nullable text', () => {
        const draft = createStoreViewEditDraft(detail);
        draft.title = 'Updated title';
        draft.authors = 'First Author, Second Author';
        draft.publicDescription = '';
        draft.internalNotes = 'Updated owner note';
        expect(buildStoreViewChanges(detail, draft)).toEqual({
            title: 'Updated title',
            authors: ['First Author', 'Second Author'],
            publicDescription: null,
            internalNotes: 'Updated owner note',
        });
    });

    it('validates price and damage without inventing publication policy', () => {
        const draft = createStoreViewEditDraft(detail);
        draft.sellingPriceMinor = '-1';
        expect(validateStoreViewEditDraft(draft)).toMatch(/whole rupees/i);
        draft.sellingPriceMinor = '350';
        draft.hasDamage = true;
        draft.damageTypes = [];
        draft.damageNote = '';
        expect(validateStoreViewEditDraft(draft)).toMatch(/damage type/i);
        draft.damageTypes = ['cover'];
        draft.damageNote = 'Scuffed cover';
        expect(validateStoreViewEditDraft(draft)).toBeNull();
    });

    it('lets an untouched null language save with only a title edit', () => {
        const nullLanguage = {
            ...detail,
            presentation: { ...detail.presentation, language: null },
        } as any;
        const draft = createStoreViewEditDraft(nullLanguage);
        expect(draft.language).toBe('');
        draft.title = 'Updated title';
        const edited = computeEditedSet(nullLanguage, draft);
        expect([...edited]).toEqual(['title']);
        expect(validateStoreViewEditDraft(draft, edited)).toBeNull();
        expect(buildEditedChanges(nullLanguage, draft, edited)).toEqual({ title: 'Updated title' });
    });

    it('still rejects a typed invalid language', () => {
        const draft = createStoreViewEditDraft(detail);
        draft.language = 'xx!';
        const edited = computeEditedSet(detail, draft);
        expect(edited.has('language')).toBe(true);
        expect(validateStoreViewEditDraft(draft, edited)).toMatch(/valid language code/i);
    });

    it('rejects clearing a language that was set', () => {
        const draft = createStoreViewEditDraft(detail);
        draft.language = '';
        const edited = computeEditedSet(detail, draft);
        expect(edited.has('language')).toBe(true);
        expect(validateStoreViewEditDraft(draft, edited)).toMatch(/valid language code/i);
    });

    it('keeps rejecting an empty language when no edited set is passed', () => {
        const draft = createStoreViewEditDraft(detail);
        draft.language = '';
        expect(validateStoreViewEditDraft(draft)).toMatch(/valid language code/i);
    });
});
