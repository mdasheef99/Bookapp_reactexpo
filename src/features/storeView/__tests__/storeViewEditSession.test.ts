import {
    buildEditedChanges,
    computeEditedSet,
    createStoreViewEditDraft,
    editFieldEquals,
    readDetailField,
} from '../forms/storeViewEditForm';
import {
    editIdentityChanged,
    isEditAccessLost,
    rebaseEditDraft,
    refreshEditBaseline,
    resolveEditConflict,
} from '../state/storeViewEditRebase';

const inventoryId = '00000000-0000-4000-8000-000000000001';

function detail(overrides: Record<string, unknown> = {}) {
    return {
        identity: { inventoryId },
        presentation: {
            title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
            publicDescription: 'A public description.', condition: 'good',
            publicConditionNote: 'Light wear.', hasDamage: false,
            damageTypes: [], damageNote: null, isSellable: true,
            sellingPriceMinor: 35000,
        },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] },
        capabilities: ['edit_details'],
        versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
        mediaSummary: { approvedCount: 1 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
        ...overrides,
    } as any;
}

function withPresentation(base: any, presentation: Record<string, unknown>) {
    return detail({ presentation: { ...base.presentation, ...presentation } });
}

describe('Slice 0a §3.2 server-normalized edit comparison', () => {
    it('treats whitespace-only differences as already saved', () => {
        const base = detail();
        const draft = createStoreViewEditDraft(base);
        draft.title = 'The Bookshop ';
        expect(editFieldEquals('title', base, draft)).toBe(true);
        expect(computeEditedSet(base, draft).size).toBe(0);
        expect(buildEditedChanges(base, draft, computeEditedSet(base, draft))).toEqual({});
    });

    it('normalizes language underscores exactly like the save RPC', () => {
        const base = detail();
        const draft = createStoreViewEditDraft(base);
        draft.language = 'hi_Latn';
        expect(editFieldEquals('language', base, draft)).toBe(false);
        const changed = withPresentation(base, { language: 'hi-Latn' });
        expect(editFieldEquals('language', changed, draft)).toBe(true);
    });

    it('treats empty nullable text as null', () => {
        const base = detail();
        const draft = createStoreViewEditDraft(base);
        draft.publicDescription = '   ';
        expect(editFieldEquals('publicDescription', base, draft)).toBe(false);
        const nulled = withPresentation(base, { publicDescription: null });
        expect(editFieldEquals('publicDescription', nulled, draft)).toBe(true);
    });

    it('expands an edited damage field to the whole group when sending', () => {
        const damaged = withPresentation(detail(), {
            hasDamage: true, damageTypes: ['cover'], damageNote: 'Scuffed cover',
        });
        const draft = createStoreViewEditDraft(damaged);
        draft.damageNote = 'Scuffed cover, spine crease';
        const edited = computeEditedSet(damaged, draft);
        expect([...edited].sort()).toEqual(['damageNote', 'damageTypes', 'hasDamage']);
        expect(buildEditedChanges(damaged, draft, edited)).toEqual({
            hasDamage: true,
            damageTypes: ['cover'],
            damageNote: 'Scuffed cover, spine crease',
        });
    });

    it('sends only edited fields against the baseline', () => {
        const base = detail();
        const draft = createStoreViewEditDraft(base);
        draft.title = 'Updated title';
        expect(buildEditedChanges(base, draft, computeEditedSet(base, draft))).toEqual({
            title: 'Updated title',
        });
    });

    it('R1: keeps the original author array when authors contain commas', () => {
        const base = withPresentation(detail(), { authors: ['Doe, Jane'] });
        const draft = createStoreViewEditDraft(base);
        // Only the shelf location changed; the authors text is untouched.
        draft.shelfLocation = 'B2';
        const edited = computeEditedSet(base, draft);
        expect(edited.has('authors')).toBe(false);
        const changes = buildEditedChanges(base, draft, edited);
        expect('authors' in changes).toBe(false);
        expect(changes).toEqual({ shelfLocation: 'B2' });
    });

    it('R1: sends parsed authors only after the owner edits the authors text', () => {
        const base = withPresentation(detail(), { authors: ['Doe, Jane'] });
        const draft = createStoreViewEditDraft(base);
        expect(editFieldEquals('authors', base, draft)).toBe(true);
        draft.authors = 'Doe, Jane, Smith, John';
        expect(editFieldEquals('authors', base, draft)).toBe(false);
        expect(buildEditedChanges(base, draft, computeEditedSet(base, draft))).toEqual({
            authors: ['Doe', 'Jane', 'Smith', 'John'],
        });
    });
});

describe('Slice 0a §3.2 conflict rebase', () => {
    it('takes untouched fields from the refresh and keeps edited ones', () => {
        const base = detail();
        const draft = createStoreViewEditDraft(base);
        draft.title = 'My title';
        const edited = computeEditedSet(base, draft);
        const refreshed = withPresentation(base, {
            sellingPriceMinor: 40000,
            versions: undefined,
        });
        (refreshed as any).versions = { inventoryVersion: 4, publicationIntentVersion: 2 };
        const rebased = rebaseEditDraft({ draft, editedSet: edited, refreshed, baseline: base });
        expect(rebased.conflicts).toEqual([]);
        expect(rebased.alreadySaved).toBe(false);
        expect(rebased.draft.sellingPriceMinor).toBe('40000');
        expect(rebased.draft.title).toBe('My title');
    });

    it('marks a field both sides changed and blocks save until resolved', () => {
        const base = detail();
        const draft = createStoreViewEditDraft(base);
        draft.sellingPriceMinor = '99900';
        const edited = computeEditedSet(base, draft);
        const refreshed = withPresentation(base, { sellingPriceMinor: 40000 });
        (refreshed as any).versions = { inventoryVersion: 4, publicationIntentVersion: 2 };
        const rebased = rebaseEditDraft({ draft, editedSet: edited, refreshed, baseline: base });
        expect(rebased.conflicts).toEqual(['sellingPriceMinor']);
        expect(rebased.draft.sellingPriceMinor).toBe('99900');
        const theirs = resolveEditConflict({
            draft: rebased.draft, refreshed, field: 'sellingPriceMinor', choice: 'theirs',
        });
        expect(theirs.sellingPriceMinor).toBe('40000');
        const mine = resolveEditConflict({
            draft: rebased.draft, refreshed, field: 'sellingPriceMinor', choice: 'mine',
        });
        expect(mine.sellingPriceMinor).toBe('99900');
    });

    it('marks the damage group when the remote side changed any member', () => {
        const damaged = withPresentation(detail(), {
            hasDamage: true, damageTypes: ['cover'], damageNote: 'Scuffed',
        });
        const draft = createStoreViewEditDraft(damaged);
        draft.damageNote = 'Scuffed badly';
        const edited = computeEditedSet(damaged, draft);
        const refreshed = withPresentation(damaged, { damageTypes: ['cover', 'pages'] });
        (refreshed as any).versions = { inventoryVersion: 4, publicationIntentVersion: 2 };
        const rebased = rebaseEditDraft({ draft, editedSet: edited, refreshed, baseline: damaged });
        expect(rebased.conflicts.sort()).toEqual(['damageNote', 'damageTypes', 'hasDamage']);
        const theirs = resolveEditConflict({
            draft: rebased.draft, refreshed, field: 'damageTypes', choice: 'theirs',
        });
        expect(theirs.damageTypes).toEqual(['cover', 'pages']);
        expect(theirs.damageNote).toBe('Scuffed');
    });

    it('reports already-saved when every edited field equals the refresh', () => {
        const base = detail();
        const draft = createStoreViewEditDraft(base);
        draft.title = 'Same new title';
        const edited = computeEditedSet(base, draft);
        const refreshed = withPresentation(base, { title: 'Same new title' });
        (refreshed as any).versions = { inventoryVersion: 4, publicationIntentVersion: 2 };
        const rebased = rebaseEditDraft({ draft, editedSet: edited, refreshed, baseline: base });
        expect(rebased.alreadySaved).toBe(true);
    });

    it('reads stored detail fields for remote labels', () => {
        const base = detail();
        expect(readDetailField(base, 'shelfLocation')).toBe('A3');
        expect(readDetailField(base, 'internalNotes')).toBe('Owner note');
    });
});

describe('Slice 0a §3.2 access-lost classification', () => {
    it.each([
        ['P9_AUTH_REQUIRED', null],
        ['P9_OWNER_NOT_AUTHORIZED', null],
        ['P9_NOT_FOUND', null],
    ])('treats %s as access lost', (code, httpStatus) => {
        expect(isEditAccessLost({ code, httpStatus })).toBe(true);
    });

    it.each([[401], [403]])('treats HTTP %s without an app error body as access lost', (httpStatus) => {
        expect(isEditAccessLost({ code: 'P9_INTERNAL_ERROR', httpStatus })).toBe(true);
        expect(isEditAccessLost({ code: null, httpStatus })).toBe(true);
    });

    it('keeps retryable failures on the temporary path', () => {
        expect(isEditAccessLost({ code: 'P9_INTERNAL_ERROR', httpStatus: null })).toBe(false);
        expect(isEditAccessLost({ code: 'P9_VERSION_CONFLICT', httpStatus: 500 })).toBe(false);
    });

    it('treats a user or store change as access lost', () => {
        const identity = { userId: 'owner-a', storeId: 'store-a' };
        expect(editIdentityChanged(identity, { userId: 'owner-a', storeId: 'store-a' })).toBe(false);
        expect(isEditAccessLost({ identityChanged: true })).toBe(true);
        expect(editIdentityChanged(identity, { userId: 'owner-b', storeId: 'store-a' })).toBe(true);
        expect(editIdentityChanged(identity, { userId: 'owner-a', storeId: 'store-b' })).toBe(true);
    });
});

describe('Slice 0a §3.2 refresh with offline and timeout', () => {
    it('reports offline without calling refresh', async () => {
        const refresh = jest.fn(async () => detail());
        const result = await refreshEditBaseline({ isOnline: false, refresh });
        expect(result).toEqual({ ok: false, offline: true });
        expect(refresh).not.toHaveBeenCalled();
    });

    it('succeeds when the refresh completes in time', async () => {
        const refreshed = detail();
        const result = await refreshEditBaseline({
            isOnline: true, refresh: async () => refreshed, timeoutMs: 1000,
        });
        expect(result).toEqual({ ok: true, detail: refreshed });
    });

    it('times out slowly but still accepts the late refresh', async () => {
        const refreshed = detail();
        let resolve!: (value: unknown) => void;
        const refresh = jest.fn(async (): Promise<any> => new Promise((done) => { resolve = done; }));
        const onLate = jest.fn();
        const pending = refreshEditBaseline({ isOnline: true, refresh, onLate, timeoutMs: 10 });
        const timedOut = await pending;
        // R17 (old behaviour was offline:false): a 15s stall shows
        // "You're offline. Your edits are kept."
        expect(timedOut).toEqual({ ok: false, offline: true });
        resolve(refreshed);
        await new Promise((done) => setTimeout(done, 0));
        expect(onLate).toHaveBeenCalledWith(refreshed);
    });

    it('R9: reports a late failure through onLateFailure instead of swallowing it', async () => {
        let reject!: (reason: unknown) => void;
        const refresh = jest.fn(
            async (): Promise<any> => new Promise((_done, fail) => { reject = fail; }),
        );
        const failure = new Error('forbidden') as Error & { code: string; httpStatus: number };
        failure.code = 'P9_OWNER_NOT_AUTHORIZED';
        failure.httpStatus = 403;
        const onLateFailure = jest.fn();
        const pending = refreshEditBaseline({
            isOnline: true, refresh, timeoutMs: 10, onLateFailure,
        });
        expect(await pending).toEqual({ ok: false, offline: true });
        reject(failure);
        await new Promise((done) => setTimeout(done, 0));
        expect(onLateFailure).toHaveBeenCalledWith({
            ok: false, offline: false, code: 'P9_OWNER_NOT_AUTHORIZED', httpStatus: 403,
        });
    });

    it('treats a failed refresh as a temporary failure', async () => {
        const result = await refreshEditBaseline({
            isOnline: true,
            refresh: async () => { throw new Error('network down'); },
            timeoutMs: 1000,
        });
        expect(result).toEqual({ ok: false, offline: false });
    });

    it('keeps the error code and HTTP status of a failed refresh (C2)', async () => {
        const failure = new Error('forbidden') as Error & { code: string; httpStatus: number };
        failure.code = 'P9_OWNER_NOT_AUTHORIZED';
        failure.httpStatus = 403;
        const result = await refreshEditBaseline({
            isOnline: true,
            refresh: async () => { throw failure; },
            timeoutMs: 1000,
        });
        expect(result).toEqual({ ok: false, offline: false, code: 'P9_OWNER_NOT_AUTHORIZED', httpStatus: 403 });
        if (!result.ok && !result.offline) {
            expect(isEditAccessLost({ code: result.code ?? null, httpStatus: result.httpStatus ?? null })).toBe(true);
        } else {
            throw new Error('expected a failed refresh result');
        }
    });

    it('clears the 15s timer once the refresh settles (C11)', async () => {
        jest.useFakeTimers();
        try {
            const refreshed = detail();
            const pending = refreshEditBaseline({ isOnline: true, refresh: async () => refreshed });
            const result = await pending;
            expect(result).toEqual({ ok: true, detail: refreshed });
            expect(jest.getTimerCount()).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });
});
