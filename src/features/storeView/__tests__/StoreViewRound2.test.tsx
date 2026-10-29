import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor as waitForBase } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { StoreViewMediaClientError, storeViewMediaService } from '../api/storeViewMediaService';
import { StoreViewManagementClientError } from '../api/storeViewManagementService';
import { publicationService } from '@/features/imageInventory/api/publicationService';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewMediaCommands } from '../queries/storeViewMediaCommands';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';
import { StoreViewEditModal } from '../components/StoreViewEditModal';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-image-picker', () => ({
    getMediaLibraryPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('../queries/storeViewManagementQueries', () => ({ useStoreViewManagementCommands: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => {
    const actual = jest.requireActual('../queries/storeViewQueries');
    return { ...actual, useStoreViewDetail: jest.fn() };
});
jest.mock('../queries/storeViewMediaCommands', () => ({ useStoreViewMediaCommands: jest.fn() }));
// NOTE: useStoreViewMedia is intentionally REAL here so R3 can assert when
// the media fetch starts. Only the service transport is mocked.
jest.mock('../api/storeViewMediaService', () => {
    const actual = jest.requireActual('../api/storeViewMediaService');
    return {
        ...actual,
        storeViewMediaService: { ...actual.storeViewMediaService, read: jest.fn() },
    };
});
jest.mock('../queries/storeViewHistoryQueries', () => {
    const actual = jest.requireActual('../queries/storeViewHistoryQueries');
    return {
        ...actual,
        useStoreViewHistory: () => ({ isPending: false, isError: false, data: null }),
    };
});
jest.mock('@/features/imageInventory/api/publicationService', () => {
    const actual = jest.requireActual('@/features/imageInventory/api/publicationService');
    return {
        ...actual,
        publicationService: { ...actual.publicationService, submitPublicCopyMedia: jest.fn() },
    };
});
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', bgCard: '#fff', bgPrimary: '#fafafa', bgSecondary: '#eee', border: '#ddd',
        error: '#b91c1c', success: '#15803d', textPrimary: '#111',
        textSecondary: '#555', textTertiary: '#777',
    } }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const linkA = '00000000-0000-4000-8000-000000000011';
const linkB = '00000000-0000-4000-8000-000000000012';
const capabilityA = '00000000-0000-4000-8000-000000000021';
const assetA = '00000000-0000-4000-8000-000000000031';

const detailRefetch = jest.fn();
const managementMutate = jest.fn();
const mediaMutate = jest.fn();
const mediaRead = storeViewMediaService.read as jest.Mock;

function book(version: number, overrides: Record<string, unknown> = {}) {
    return {
        identity: { inventoryId },
        presentation: {
            title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
            publicDescription: 'Public copy.', condition: 'good', publicConditionNote: 'Light wear.',
            hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
            sellingPriceMinor: 35000,
        },
        stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] },
        capabilities: ['edit_details', 'manage_photos'],
        versions: { inventoryVersion: version, publicationIntentVersion: 2 },
        mediaSummary: { approvedCount: 2 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
        ...overrides,
    } as any;
}

function photo(linkId: string, order: number) {
    return {
        linkId,
        mediaAssetId: '00000000-0000-4000-8000-000000000041',
        role: 'actual_copy', publicOrder: order, approvalStatus: 'approved',
        approvedAt: '2026-01-01T00:00:00.000Z', url: 'https://example.com/photo.jpg', width: 100, height: 100,
    };
}

function mediaData() {
    return { inventoryId, media: [photo(linkA, 1), photo(linkB, 2)], pendingReplacements: [] };
}

function waitFor(expectation: () => void) {
    return waitForBase(expectation, { timeout: 8000 });
}

// Tests chain several 8s waits; the 5s Jest default cut them off under load.
jest.setTimeout(30000);

function renderDetail() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: 0, gcTime: 60_000 },
            mutations: { retry: false },
        },
    });
    const screen = render(
        <QueryClientProvider client={client}>
            <StoreViewDetailContent identity={identity} inventoryId={inventoryId} />
        </QueryClientProvider>,
    );
    return { screen, client };
}

function conflictError() {
    return new StoreViewManagementClientError('P9_VERSION_CONFLICT', false, 'This book changed.');
}

function accessLostMediaError() {
    return new StoreViewMediaClientError('P9_OWNER_NOT_AUTHORIZED', false, 'Manage Photos is unavailable.', 403);
}

async function flush(times = 50) {
    await act(async () => {
        for (let index = 0; index < times; index += 1) {
            await Promise.resolve();
        }
    });
}

async function advance(ms: number) {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(ms);
    });
    await flush();
}

/** waitFor equivalent for fake-timer tests: polls with microtask flushes. */
async function flushUntil(fn: () => void, rounds = 40) {
    for (let index = 0; index < rounds; index += 1) {
        try {
            fn();
            return;
        } catch {
            // eslint-disable-next-line no-await-in-loop
            await flush(10);
        }
    }
    fn();
}

function openEditor(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByTestId('store-view-edit'));
}

function openPhotos(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByTestId('store-view-manage-photos'));
}

function removeEnabled(screen: ReturnType<typeof render>, index: number): boolean {
    return screen.getByTestId(`store-view-media-remove-${index}`).props.accessibilityState?.disabled !== true;
}

beforeEach(() => {
    // mockReset (not just clearAllMocks) so one-shot implementations from a
    // previous test can never leak into the next one.
    jest.clearAllMocks();
    detailRefetch.mockReset();
    mediaRead.mockReset();
    managementMutate.mockReset();
    mediaMutate.mockReset();
    (publicationService.submitPublicCopyMedia as jest.Mock).mockReset();
    jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
    (useStoreViewDetail as jest.Mock).mockReturnValue({
        isPending: false, isError: false, data: book(3), refetch: detailRefetch,
    });
    detailRefetch.mockResolvedValue({ data: book(3), error: null });
    mediaRead.mockResolvedValue(mediaData());
    (useStoreViewManagementCommands as jest.Mock).mockReturnValue({
        mutateAsync: managementMutate, isPending: false,
    });
    (useStoreViewMediaCommands as jest.Mock).mockReturnValue({
        mutateAsync: mediaMutate, isPending: false,
    });
    (usePublicationCommands as jest.Mock).mockReturnValue({
        mutateAsync: jest.fn().mockResolvedValue({}), isPending: false,
    });
    managementMutate.mockResolvedValue({ outcome: 'details_updated' });
    mediaMutate.mockResolvedValue({
        inventoryVersion: 4, publicationIntentVersion: 2,
        publicRevisionNumber: null, removedMediaAssetId: assetA, outcome: 'media_removed',
    });
    (publicationService.submitPublicCopyMedia as jest.Mock).mockResolvedValue({ mediaLinkId: linkB });
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe('R1 edit modal keeps comma authors unsent', () => {
    it('stored ["Doe, Jane"], edit only the shelf location, authors are not sent', async () => {
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: false,
            data: book(3, {
                presentation: { ...book(3).presentation, authors: ['Doe, Jane'] },
            }),
            refetch: detailRefetch,
        });
        const { screen } = renderDetail();
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-shelf-location'), 'B2');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(1));
        expect(managementMutate).toHaveBeenLastCalledWith({
            kind: 'save', inventoryId, inventoryVersion: 3, changes: { shelfLocation: 'B2' },
        });
    });
});

describe('R2 edited set stays fixed across rebases', () => {
    it('a title that matched remotely still conflicts when changed remotely later', async () => {
        managementMutate.mockRejectedValue(conflictError());
        // First refresh: title already matches what the owner typed; price changed remotely.
        detailRefetch.mockResolvedValueOnce({
            data: book(4, {
                presentation: { ...book(4).presentation, title: 'T1', sellingPriceMinor: 40000 },
            }),
            error: null,
        });
        // Second refresh: title changed remotely again.
        detailRefetch.mockResolvedValueOnce({
            data: book(5, {
                presentation: { ...book(5).presentation, title: 'T2', sellingPriceMinor: 40000 },
            }),
            error: null,
        });
        const { screen } = renderDetail();
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'T1');
        fireEvent.changeText(screen.getByTestId('store-view-edit-price-minor'), '111');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(
            screen.getByTestId('store-view-edit-conflict-sellingPriceMinor'),
        ).toBeTruthy());
        // Both fields were changed on both sides (title coincidentally to
        // the same value), so both are marked; the owner's values are kept.
        expect(screen.getByTestId('store-view-edit-conflict-title')).toBeTruthy();
        expect(screen.getByDisplayValue('T1')).toBeTruthy();
        fireEvent.press(screen.getByTestId('store-view-edit-keep-mine-sellingPriceMinor'));
        fireEvent.press(screen.getByTestId('store-view-edit-keep-mine-title'));
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(2));
        expect(managementMutate).toHaveBeenLastCalledWith({
            kind: 'save', inventoryId, inventoryVersion: 4, changes: { title: 'T1', sellingPriceMinor: 111 },
        });
        // The later remote title change must show a conflict again: title
        // stayed in the fixed edited set even though it matched the first
        // refresh. (Without the fix it drops out and is silently overwritten.)
        await waitFor(() => expect(screen.getByTestId('store-view-edit-conflict-title')).toBeTruthy());
        expect(screen.getByText('Changed by someone else to T2')).toBeTruthy();
        expect(screen.getByDisplayValue('T1')).toBeTruthy();
    });
});

describe('R4 recovery never overwrites the queued draft', () => {
    it('a keystroke attempted with the recovery completion in one act() cannot clobber the draft', async () => {        managementMutate.mockRejectedValueOnce(conflictError());
        let resolveRefresh!: (value: unknown) => void;
        detailRefetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveRefresh = resolve; }),
        );
        const { screen } = renderDetail();
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'First');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(detailRefetch).toHaveBeenCalled());
        const refreshed = book(4, {
            presentation: { ...book(4).presentation, sellingPriceMinor: 40000 },
        });
        // Inputs are locked while recovering (R5), so the attempted
        // keystroke cannot apply — and the recovery must preserve the
        // pre-recovery draft ('First'), rebasing only the untouched price.
        // Without the fix the keystroke applies and the recovery (reading a
        // render-assigned ref) overwrites it.
        act(() => {
            fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'First plus more');
            resolveRefresh({ data: refreshed, error: null });
        });
        await waitFor(() => expect(screen.getByText(/kept — check them and save again/i)).toBeTruthy());
        expect(screen.getByDisplayValue('First')).toBeTruthy();
        await waitFor(() => expect(screen.getByDisplayValue('40000')).toBeTruthy());
    });

    it('R4 mechanism: a draft change racing the recovery completion is rebased from, not overwritten', async () => {
        managementMutate.mockRejectedValueOnce(conflictError());
        let resolveRefresh!: (value: unknown) => void;
        detailRefetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveRefresh = resolve; }),
        );
        const { screen } = renderDetail();
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'First');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(detailRefetch).toHaveBeenCalled());
        const refreshed = book(4, {
            presentation: { ...book(4).presentation, sellingPriceMinor: 40000 },
        });
        // The recovery completion is queued first; the draft change lands
        // after it with no render in between (the locked event gate is
        // bypassed by invoking the wired handler directly). Refs are
        // assigned synchronously at event time, so the recovery rebases
        // from 'First plus more'. With render-assigned refs it would read
        // the stale 'First' and overwrite the queued change.
        resolveRefresh({ data: refreshed, error: null });
        screen.getByTestId('store-view-edit-title').props.onChangeText('First plus more');
        await waitFor(() => expect(screen.getByText(/kept — check them and save again/i)).toBeTruthy());
        await waitFor(() => expect(screen.getByDisplayValue('First plus more')).toBeTruthy());
        await waitFor(() => expect(screen.getByDisplayValue('40000')).toBeTruthy());
    });
});

describe('R5 inputs are non-editable while saving or recovering', () => {
    it('title is editable={false} while the save is pending', async () => {
        let resolveSave!: (value: unknown) => void;
        managementMutate.mockImplementationOnce(
            () => new Promise((resolve) => { resolveSave = resolve; }),
        );
        const { screen } = renderDetail();
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await flush();
        expect(screen.getByTestId('store-view-edit-title').props.editable).toBe(false);
        resolveSave({ outcome: 'details_updated' });
        await waitFor(() => expect(screen.getByText('Changes saved.')).toBeTruthy());
    });
});

describe('R6a background detail access loss', () => {
    it('a background 403 with cached data shows the error page', async () => {
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: true, data: book(3),
            error: new StoreViewManagementClientError(
                'P9_OWNER_NOT_AUTHORIZED', false, 'Store View management is unavailable.', 403,
            ),
            refetch: detailRefetch,
        });
        const { screen } = renderDetail();
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
    });

    it('a temporary background error keeps the cached book on screen', async () => {
        (useStoreViewDetail as jest.Mock).mockReturnValue({
            isPending: false, isError: true, data: book(3),
            error: new Error('network down'),
            refetch: detailRefetch,
        });
        const { screen } = renderDetail();
        await flush();
        expect(screen.queryByText('Store View unavailable')).toBeNull();
        expect(screen.getByText('The Bookshop')).toBeTruthy();
    });
});

describe('R6b photo post-command media refetch access loss', () => {
    it('routes an access-loss refetch after remove to the access-lost path', async () => {
        const { screen } = renderDetail();
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        mediaRead.mockRejectedValueOnce(accessLostMediaError());
        fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
        fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
        expect(screen.queryByTestId('store-view-media-retry')).toBeNull();
    });
});

describe('R9 late failures route late access loss out', () => {
    it('edit: a late access-loss rejection after the timeout closes to the error page', async () => {
        jest.useFakeTimers();
        try {
            managementMutate.mockRejectedValueOnce(conflictError());
            let rejectRefresh!: (reason: unknown) => void;
            detailRefetch.mockImplementationOnce(
                () => new Promise((_resolve, reject) => { rejectRefresh = reject; }),
            );
            const { screen } = renderDetail();
            openEditor(screen);
            fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
            await advance(15_000);
            expect(screen.getByText("You're offline. Your edits are kept.")).toBeTruthy();
            act(() => {
                rejectRefresh(accessLostMediaError());
            });
            await flush();
            expect(screen.getByText('Store View unavailable')).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });

    it('photo: a late access-loss rejection after the confirm timeout closes to the error page', async () => {
        jest.useFakeTimers();
        try {
            let rejectDetail!: (reason: unknown) => void;
            detailRefetch.mockImplementationOnce(
                () => new Promise((_resolve, reject) => { rejectDetail = reject; }),
            );
            const { screen } = renderDetail();
            openPhotos(screen);
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
            await advance(15_000);
            expect(screen.getByTestId('store-view-media-retry')).toBeTruthy();
            act(() => {
                rejectDetail(accessLostMediaError());
            });
            await flush();
            expect(screen.getByText('Store View unavailable')).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('R10 per-attempt fencing within an opening', () => {
    it("edit: A's late v4 is ignored and B's v5 is used", async () => {
        jest.useFakeTimers();
        try {
            managementMutate.mockRejectedValue(conflictError());
            let resolveA!: (value: unknown) => void;
            let resolveB!: (value: unknown) => void;
            detailRefetch
                .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
                .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));
            const { screen } = renderDetail();
            openEditor(screen);
            fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalledTimes(1));
            await advance(15_000);
            // Retry B starts.
            fireEvent.press(screen.getByTestId('store-view-edit-retry-refresh'));
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalledTimes(2));
            resolveB({
                data: book(5, { presentation: { ...book(5).presentation, title: 'Remote B' } }),
                error: null,
            });
            await flushUntil(() => expect(
                screen.getByTestId('store-view-edit-conflict-title'),
            ).toBeTruthy());
            expect(screen.getByText('Changed by someone else to Remote B')).toBeTruthy();
            // A's late v4 must be ignored.
            act(() => {
                resolveA({
                    data: book(4, { presentation: { ...book(4).presentation, title: 'Remote A' } }),
                    error: null,
                });
            });
            await flush();
            expect(screen.queryByText('Changed by someone else to Remote A')).toBeNull();
            expect(screen.getByDisplayValue('My title')).toBeTruthy();
            fireEvent.press(screen.getByTestId('store-view-edit-keep-mine-title'));
            managementMutate.mockResolvedValueOnce({ outcome: 'details_updated' });
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
            await flushUntil(() => expect(managementMutate).toHaveBeenCalledTimes(2));
            expect(managementMutate).toHaveBeenLastCalledWith({
                kind: 'save', inventoryId, inventoryVersion: 5, changes: { title: 'My title' },
            });
        } finally {
            jest.useRealTimers();
        }
    });

    it("photo: A's late v3 is ignored and B's v9 is used", async () => {
        jest.useFakeTimers();
        try {
            let resolveA!: (value: unknown) => void;
            let resolveB!: (value: unknown) => void;
            detailRefetch
                .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
                .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));
            const { screen } = renderDetail();
            openPhotos(screen);
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalledTimes(1));
            await advance(15_000);
            expect(screen.getByTestId('store-view-media-retry')).toBeTruthy();
            fireEvent.press(screen.getByTestId('store-view-media-retry'));
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalledTimes(2));
            resolveB({ data: book(9), error: null });
            await flushUntil(() => expect(removeEnabled(screen, 0)).toBe(true));
            act(() => {
                resolveA({ data: book(3), error: null });
            });
            await flush();
            fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
            fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
            await flushUntil(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
            expect(mediaMutate).toHaveBeenLastCalledWith({
                kind: 'remove', inventoryId, inventoryVersion: 9, linkId: linkA,
            });
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('R3 media reads wait for the confirmed detail version', () => {
    it('cold cache: no media fetch starts before the detail read resolves', async () => {
        let resolveDetail!: (value: unknown) => void;
        detailRefetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveDetail = resolve; }),
        );
        const { screen } = renderDetail();
        openPhotos(screen);
        await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
        // The detail read is still in flight: the media transport must be untouched.
        expect(mediaRead).not.toHaveBeenCalled();
        await flush();
        expect(mediaRead).not.toHaveBeenCalled();
        resolveDetail({ data: book(3), error: null });
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        expect(mediaRead).toHaveBeenCalled();
    });
});

describe('R11 no post-await work after unmount', () => {
    function renderEditModal(handlers: {
        onSave: jest.Mock; onRefreshBook: jest.Mock; onAccessLost: jest.Mock; onSaved: jest.Mock;
    }) {
        return render(
            <StoreViewEditModal
                visible
                detail={book(3)}
                identity={identity}
                submitting={false}
                error={null}
                onDismiss={() => undefined}
                onSave={handlers.onSave}
                onRefreshBook={handlers.onRefreshBook}
                onAccessLost={handlers.onAccessLost}
                onSaved={handlers.onSaved}
            />,
        );
    }

    it('edit: a late already-saved refresh after unmount never calls onSaved', async () => {
        const onSave = jest.fn(async () => ({ ok: false, code: 'P9_VERSION_CONFLICT', message: '', httpStatus: null }));
        let resolveRefresh!: (value: unknown) => void;
        const onRefreshBook = jest.fn(
            () => new Promise((resolve) => { resolveRefresh = resolve; }),
        );
        const onAccessLost = jest.fn();
        const onSaved = jest.fn();
        const screen = renderEditModal({ onSave, onRefreshBook, onAccessLost, onSaved });
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Same new title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(onRefreshBook).toHaveBeenCalled());
        screen.unmount();
        resolveRefresh({
            ok: true,
            detail: book(4, {
                presentation: { ...book(4).presentation, title: 'Same new title' },
            }),
        });
        await flush();
        expect(onSaved).not.toHaveBeenCalled();
        expect(onAccessLost).not.toHaveBeenCalled();
    });

    it('edit: a late access-loss refresh after unmount never calls onAccessLost', async () => {
        const onSave = jest.fn(async () => ({ ok: false, code: 'P9_VERSION_CONFLICT', message: '', httpStatus: null }));
        let resolveRefresh!: (value: unknown) => void;
        const onRefreshBook = jest.fn(
            () => new Promise((resolve) => { resolveRefresh = resolve; }),
        );
        const onAccessLost = jest.fn();
        const onSaved = jest.fn();
        const screen = renderEditModal({ onSave, onRefreshBook, onAccessLost, onSaved });
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(onRefreshBook).toHaveBeenCalled());
        screen.unmount();
        resolveRefresh({ ok: false, offline: false, code: 'P9_OWNER_NOT_AUTHORIZED', httpStatus: 403 });
        await flush();
        expect(onAccessLost).not.toHaveBeenCalled();
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('photo: a late detail version after unmount never refetches media', async () => {
        let resolveDetail!: (value: unknown) => void;
        detailRefetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveDetail = resolve; }),
        );
        const { screen } = renderDetail();
        openPhotos(screen);
        await waitFor(() => expect(detailRefetch).toHaveBeenCalled());
        const mediaCalls = mediaRead.mock.calls.length;
        screen.unmount();
        resolveDetail({ data: book(5), error: null });
        await flush();
        expect(mediaRead.mock.calls.length).toBe(mediaCalls);
    });
});

describe('R12 recovering never sticks across reopen', () => {
    it('close mid-recovery, reopen, Save is enabled again', async () => {
        managementMutate.mockRejectedValueOnce(conflictError());
        // The recovery stays in flight the whole time: it is never resolved.
        detailRefetch.mockImplementationOnce(
            () => new Promise(() => undefined),
        );
        const { screen } = renderDetail();
        openEditor(screen);
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(detailRefetch).toHaveBeenCalled());
        // Close while the recovery is in flight, then reopen.
        fireEvent.press(screen.getByText('Cancel'));
        openEditor(screen);
        expect(screen.queryByText('Refreshing…')).toBeNull();
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Retyped');
        expect(
            screen.getByTestId('store-view-save-changes').props.accessibilityState.disabled,
        ).toBe(false);
    });
});

describe('R13 late edit refresh reuses the prompt outcome handling', () => {
    it('a late no-changes refresh shows "Nothing was saved"', async () => {
        jest.useFakeTimers();
        try {
            managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError(
                'P9_NO_CHANGES', false, 'There are no changes to save.',
            ));
            let resolveRefresh!: (value: unknown) => void;
            detailRefetch.mockImplementationOnce(
                () => new Promise((resolve) => { resolveRefresh = resolve; }),
            );
            const { screen } = renderDetail();
            openEditor(screen);
            fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
            await advance(15_000);
            act(() => {
                resolveRefresh({
                    data: book(4, {
                        presentation: { ...book(4).presentation, title: 'Remote title' },
                    }),
                    error: null,
                });
            });
            await flush();
            expect(screen.getByText('Nothing was saved. Try again.')).toBeTruthy();
            expect(screen.getByDisplayValue('My title')).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });

    it('a late already-saved refresh closes with the already-saved message', async () => {
        jest.useFakeTimers();
        try {
            managementMutate.mockRejectedValueOnce(conflictError());
            let resolveRefresh!: (value: unknown) => void;
            detailRefetch.mockImplementationOnce(
                () => new Promise((resolve) => { resolveRefresh = resolve; }),
            );
            const { screen } = renderDetail();
            openEditor(screen);
            fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Same new title');
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
            await advance(15_000);
            act(() => {
                resolveRefresh({
                    data: book(4, {
                        presentation: { ...book(4).presentation, title: 'Same new title' },
                    }),
                    error: null,
                });
            });
            await flush();
            expect(screen.getByText('These changes are already saved.')).toBeTruthy();
            expect(screen.queryByTestId('store-view-save-changes')).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('R15 post-command media refetches are bounded', () => {
    it('a stalled refetch after remove falls back to the failed-confirm state with Retry', async () => {
        jest.useFakeTimers();
        try {
            const { screen } = renderDetail();
            openPhotos(screen);
            await flushUntil(() => expect(removeEnabled(screen, 0)).toBe(true));
            mediaRead.mockImplementationOnce(() => new Promise(() => undefined));
            fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
            fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
            await flushUntil(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
            await advance(15_000);
            expect(screen.getByTestId('store-view-media-retry')).toBeTruthy();
            expect(screen.getByText("Couldn't refresh this book. Try again.")).toBeTruthy();
            expect(screen.queryByText('Photo removed.')).toBeNull();
            // Retry re-confirms and re-enables the actions.
            fireEvent.press(screen.getByTestId('store-view-media-retry'));
            await flushUntil(() => expect(removeEnabled(screen, 0)).toBe(true));
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('R16 a failed add re-confirms', () => {
    it('a picker failure re-reads detail and media before showing the message', async () => {
        const picker = jest.requireMock('expo-image-picker') as {
            getMediaLibraryPermissionsAsync: jest.Mock;
            launchImageLibraryAsync: jest.Mock;
        };
        picker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: false });
        picker.launchImageLibraryAsync.mockRejectedValueOnce(new Error('picker exploded'));
        const { screen } = renderDetail();
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        const detailCalls = detailRefetch.mock.calls.length;
        const mediaCalls = mediaRead.mock.calls.length;
        fireEvent.press(screen.getByTestId('store-view-media-add-photo'));
        // The failure re-confirms: both refetch counts grow, then the message shows.
        await waitFor(() => expect(detailRefetch.mock.calls.length).toBeGreaterThan(detailCalls));
        await waitFor(() => expect(mediaRead.mock.calls.length).toBeGreaterThan(mediaCalls));
        await waitFor(() => expect(screen.getByText('picker exploded')).toBeTruthy());
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
    });
});

describe('R17 a 15s stall shows the offline message', () => {
    it('edit: a stalled conflict recovery shows the offline text', async () => {
        jest.useFakeTimers();
        try {
            managementMutate.mockRejectedValueOnce(conflictError());
            detailRefetch.mockImplementationOnce(() => new Promise(() => undefined));
            const { screen } = renderDetail();
            openEditor(screen);
            fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'My title');
            fireEvent.press(screen.getByTestId('store-view-save-changes'));
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
            await advance(15_000);
            expect(screen.getByText("You're offline. Your edits are kept.")).toBeTruthy();
            expect(screen.getByDisplayValue('My title')).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });

    it('photo: a stalled confirm shows the offline text', async () => {
        jest.useFakeTimers();
        try {
            detailRefetch.mockImplementationOnce(() => new Promise(() => undefined));
            const { screen } = renderDetail();
            openPhotos(screen);
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
            await advance(15_000);
            expect(screen.getByText("You're offline. The photo buttons are disabled.")).toBeTruthy();
            expect(screen.getByTestId('store-view-media-retry')).toBeTruthy();
            // Nothing was ever confirmed, so no photo actions are available.
            expect(screen.queryByTestId('store-view-media-remove-0')).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('R19 a failed install re-confirms with counts and disabled actions', () => {
    it('failed install grows refetch counts and disables actions while re-confirming', async () => {
        const pending = [{
            capabilityId: capabilityA, role: 'damage', order: 3, state: 'approved',
            operationKind: 'add', targetLinkId: null,
            sourceMediaAssetId: assetA, mediaAssetId: assetA, safeErrorCode: null,
        }];
        // NOTE: the real media hook is in use, so the pending list must come
        // from the service transport.
        mediaRead.mockResolvedValue({ inventoryId, media: [photo(linkA, 1), photo(linkB, 2)], pendingReplacements: pending });
        (publicationService.submitPublicCopyMedia as jest.Mock).mockRejectedValueOnce(new Error('upload exploded'));
        let resolveConfirmDetail!: (value: unknown) => void;
        const { screen } = renderDetail();
        openPhotos(screen);
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
        // The re-confirm detail read stays pending so the disabled-while-
        // confirming state is observable.
        detailRefetch.mockImplementationOnce(
            () => new Promise((resolve) => { resolveConfirmDetail = resolve; }),
        );
        const detailCalls = detailRefetch.mock.calls.length;
        const mediaCalls = mediaRead.mock.calls.length;
        fireEvent.press(screen.getByTestId(`store-view-media-install-${capabilityA}`));
        await waitFor(() => expect(detailRefetch.mock.calls.length).toBeGreaterThan(detailCalls));
        // While re-confirming, the actions are disabled with the loading text.
        expect(removeEnabled(screen, 0)).toBe(false);
        expect(screen.getByText('Loading the latest photos…')).toBeTruthy();
        resolveConfirmDetail({ data: book(5), error: null });
        await waitFor(() => expect(mediaRead.mock.calls.length).toBeGreaterThan(mediaCalls));
        await waitFor(() => expect(screen.getByText('upload exploded')).toBeTruthy());
        await waitFor(() => expect(removeEnabled(screen, 0)).toBe(true));
    });
});

describe('R21 modal-level late confirm uses the confirmed version', () => {
    it('detail times out, resolves late, media is re-read, next remove sends the late version', async () => {
        jest.useFakeTimers();
        try {
            let resolveDetail!: (value: unknown) => void;
            detailRefetch.mockImplementationOnce(
                () => new Promise((resolve) => { resolveDetail = resolve; }),
            );
            const mediaCalls = mediaRead.mock.calls.length;
            const { screen } = renderDetail();
            openPhotos(screen);
            await flushUntil(() => expect(detailRefetch).toHaveBeenCalled());
            // The confirm times out first.
            await advance(15_000);
            expect(screen.getByTestId('store-view-media-retry')).toBeTruthy();
            // The detail resolves late with v5; the media list is re-read
            // after it and the modal becomes ready again.
            act(() => {
                resolveDetail({ data: book(5), error: null });
            });
            await flushUntil(() => expect(mediaRead.mock.calls.length).toBeGreaterThan(mediaCalls));
            await flushUntil(() => expect(removeEnabled(screen, 0)).toBe(true));
            fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
            fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
            await flushUntil(() => expect(mediaMutate).toHaveBeenCalledTimes(1));
            expect(mediaMutate).toHaveBeenLastCalledWith({
                kind: 'remove', inventoryId, inventoryVersion: 5, linkId: linkA,
            });
        } finally {
            jest.useRealTimers();
        }
    });
});
