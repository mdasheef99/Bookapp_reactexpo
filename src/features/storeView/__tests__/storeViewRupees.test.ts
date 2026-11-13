import type { StoreViewDetail } from '../contracts/storeViewContracts';
import { buildStoreViewChanges, createStoreViewEditDraft, computeEditedSet, validateStoreViewEditDraft } from '../forms/storeViewEditForm';

const detail = (price = 35000): StoreViewDetail => ({
    identity: { inventoryId: '00000000-0000-4000-8000-000000000001' },
    presentation: { title: 'Book', authors: ['Author'], language: 'en', publicDescription: null,
        sellingPriceMinor: price, condition: 'good', publicConditionNote: null, hasDamage: false,
        damageTypes: [], damageNote: null, isSellable: true },
    privateOperations: { shelfLocation: null, internalNotes: null },
    stockSummary: { quantityAvailable: 1, stockState: 'available' },
    stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
    lifecycle: { publicationState: 'private', effectiveState: 'private', visibilityStatus: 'draft' },
    attention: { attentionState: 'none', attentionReasons: [] },
    capabilities: ['edit_details'], versions: { inventoryVersion: 1, publicationIntentVersion: 1 },
    mediaSummary: { approvedCount: 0 }, publicState: null,
    historySummary: { publicRevisionCount: 0, latestPublicRevision: null },
});

describe('Slice 1a rupee entry', () => {
    it.each([[25000, '250'], [25050, '250.50'], [113, '1.13'], [2147483647, '21474836.47']])('prefills %i paise exactly as %s rupees', (price, text) => {
        expect(createStoreViewEditDraft(detail(price)).sellingPriceMinor).toBe(text);
    });
    it.each([['250', 25000], ['0', 0], ['21474836', 2147483600]])('sends %s rupees as %i paise', (text, price) => {
        const book = detail();
        const draft = { ...createStoreViewEditDraft(book), sellingPriceMinor: text };
        expect(validateStoreViewEditDraft(draft)).toBeNull();
        expect(buildStoreViewChanges(book, draft)).toEqual({ sellingPriceMinor: price });
    });
    it.each(['1e2', '250.0', '-5', '250.5', '   ', ' 250', '250 ', '0250', '21474837'])('rejects edited %j', (text) => {
        const draft = { ...createStoreViewEditDraft(detail()), sellingPriceMinor: text };
        expect(validateStoreViewEditDraft(draft)).toBe('Enter the price in whole rupees, for example 250.');
    });
    it.each([25050, 113, 2147483647])('does not validate or send untouched %i paise with a title edit', (price) => {
        const book = detail(price);
        const draft = { ...createStoreViewEditDraft(book), title: 'New title' };
        expect(validateStoreViewEditDraft(draft, computeEditedSet(book, draft))).toBeNull();
        expect(buildStoreViewChanges(book, draft)).toEqual({ title: 'New title' });
    });
});
