import type { PropsWithChildren } from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { onlineManager, QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { publicationService } from '@/features/imageInventory/api/publicationService';
import { StoreViewMediaClientError, storeViewMediaService } from '../api/storeViewMediaService';
import { storeViewManagementService } from '../api/storeViewManagementService';
import { StoreViewManagePhotosModal } from '../components/StoreViewManagePhotosModal';
import { StoreViewEditModal } from '../components/StoreViewEditModal';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';
import { useStoreViewDetail, storeViewKeys } from '../queries/storeViewQueries';
import { storeViewMediaKeys } from '../queries/storeViewMediaQueries';
import { storeViewHistoryKeys } from '../queries/storeViewHistoryQueries';
import { useStoreViewMediaCommands } from '../queries/storeViewMediaCommands';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-image-picker', () => ({
    getMediaLibraryPermissionsAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
    randomUUID: () => '00000000-0000-4000-8000-000000000099',
    CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digestStringAsync: jest.fn(),
}));
jest.mock('../api/storeViewMediaService', () => {
    const actual = jest.requireActual('../api/storeViewMediaService');
    return { ...actual, storeViewMediaService: { read: jest.fn(), remove: jest.fn(), reorder: jest.fn(), replace: jest.fn() } };
});
jest.mock('../api/storeViewManagementService', () => {
    const actual = jest.requireActual('../api/storeViewManagementService');
    return { ...actual, storeViewManagementService: { save: jest.fn(), adjustStock: jest.fn() } };
});
jest.mock('@/features/imageInventory/api/publicationService', () => {
    const actual = jest.requireActual('@/features/imageInventory/api/publicationService');
    return { ...actual, publicationService: {
        ...actual.publicationService, preparePublicCopyUpload: jest.fn(),
        readPublicCopyStatus: jest.fn(), submitPublicCopyMedia: jest.fn(),
    } };
});
jest.mock('../queries/storeViewQueries', () => {
    const actual = jest.requireActual('../queries/storeViewQueries');
    return { ...actual, useStoreViewDetail: jest.fn() };
});
jest.mock('../queries/storeViewHistoryQueries', () => {
    const actual = jest.requireActual('../queries/storeViewHistoryQueries');
    return { ...actual, useStoreViewHistory: () => ({ isPending: false, isError: false, data: null }) };
});
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({
    usePublicationCommands: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    accent: '#123', bgPrimary: '#fff', border: '#ddd', textPrimary: '#111', textSecondary: '#555',
} }) }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: PropsWithChildren) => <>{children}</> }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: PropsWithChildren) => <>{children}</> }));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const linkId = '00000000-0000-4000-8000-000000000011';
function book(version = 3) {
    return {
        identity: { inventoryId },
        presentation: { title: 'Book', authors: ['Author'], language: 'en', publicDescription: '',
            condition: 'good', publicConditionNote: '', hasDamage: false, damageTypes: [], damageNote: null,
            isSellable: true, sellingPriceMinor: 35000 },
        versions: { inventoryVersion: version, publicationIntentVersion: 2 },
        stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] }, capabilities: ['edit_details', 'manage_photos'],
        mediaSummary: { approvedCount: 1 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Private' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
    } as any;
}
function photos(url = 'https://example.com/current.jpg') {
    return { inventoryId, media: [{ linkId, mediaAssetId: linkId, role: 'actual_copy', publicOrder: 1,
        approvalStatus: 'approved', approvedAt: null, url, width: 100, height: 100 }], pendingReplacements: [] } as any;
}
function deferred<T = any>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
async function flush() {
    await act(async () => {
        for (let i = 0; i < 80; i += 1) await Promise.resolve();
        await jest.advanceTimersByTimeAsync(0);
    });
}
async function advance(ms: number) {
    await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
    await flush();
}
function disabled(screen: ReturnType<typeof render>, id: string) {
    return screen.getByTestId(id).props.accessibilityState?.disabled === true;
}
const clients: QueryClient[] = [];
function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
    clients.push(client);
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return { client, wrapper };
}
function photoModal() {
    const { client, wrapper } = setup();
    const onConfirmBook = jest.fn().mockResolvedValue({ ok: true, detail: book() });
    const onAccessLost = jest.fn(() => {
        client.removeQueries({ queryKey: storeViewKeys.detail(identity, inventoryId) });
        client.removeQueries({ queryKey: storeViewMediaKeys.detail(identity, inventoryId) });
        client.removeQueries({ queryKey: storeViewHistoryKeys.detail(identity, inventoryId) });
    });
    const element = (visible: boolean) => <StoreViewManagePhotosModal identity={identity} inventoryId={inventoryId}
        visible={visible} onDismiss={jest.fn()} onConfirmBook={onConfirmBook} onAccessLost={onAccessLost} />;
    const screen = render(element(true), { wrapper });
    return { screen, client, onConfirmBook, onAccessLost, reopen: () => { screen.rerender(element(false)); screen.rerender(element(true)); } };
}
function remove(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByTestId('store-view-media-remove-0'));
    fireEvent.press(screen.getByTestId('store-view-media-confirm-remove'));
}
function stallActiveDetail(client: QueryClient) {
    const fetch = jest.fn(() => new Promise(() => undefined));
    const observer = new QueryObserver(client, { queryKey: storeViewKeys.detail(identity, inventoryId),
        queryFn: fetch, initialData: book(), staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => undefined);
    return { fetch, unsubscribe };
}
function editor(onSave = jest.fn().mockResolvedValue({ ok: true }), onRefreshBook = jest.fn()) {
    const onSaved = jest.fn();
    const element = (visible: boolean) => <StoreViewEditModal visible={visible} detail={book()} identity={identity}
        submitting={false} error={null} onDismiss={jest.fn()} onSave={onSave} onRefreshBook={onRefreshBook}
        onAccessLost={jest.fn()} onSaved={onSaved} />;
    const screen = render(element(true));
    const save = (title: string) => {
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), title);
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
    };
    return { screen, save, onSaved, reopen: () => { screen.rerender(element(false)); screen.rerender(element(true)); } };
}
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    [storeViewMediaService, storeViewManagementService, publicationService, ImagePicker].forEach((service) => {
        Object.values(service).forEach((method) => { if (jest.isMockFunction(method)) method.mockReset(); });
    });
    (Crypto.digestStringAsync as jest.Mock).mockReset();
    jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
    (storeViewMediaService.read as jest.Mock).mockResolvedValue(photos());
    (storeViewMediaService.remove as jest.Mock).mockResolvedValue({ inventoryVersion: 4 });
    (storeViewManagementService.save as jest.Mock).mockResolvedValue({ inventoryVersion: 4 });
    (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [
        { uri: 'file:///photo.jpg', mimeType: 'image/jpeg', fileSize: 1000, width: 100, height: 100 },
    ] });
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('digest');
    (publicationService.submitPublicCopyMedia as jest.Mock).mockResolvedValue({ mediaLinkId: linkId });
    (useStoreViewDetail as jest.Mock).mockReturnValue({ isPending: false, data: book(), error: null, refetch: jest.fn() });
});
afterEach(() => {
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
    jest.useRealTimers();
});

// The 5s Jest default cut the first (cold-start) test off under load.
jest.setTimeout(30000);

it('F1 cold-cache Retry starts a fresh media request after its detail read and uses its result', async () => {
    const old = deferred();
    const read = storeViewMediaService.read as jest.Mock;
    read.mockImplementation(() => old.promise);
    const { screen, onConfirmBook } = photoModal();
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    await advance(15_000);
    expect(screen.getByTestId('store-view-media-retry')).toBeTruthy();
    const beforeRetry = read.mock.calls.length;
    onConfirmBook.mockImplementationOnce(async () => {
        expect(read).toHaveBeenCalledTimes(beforeRetry);
        return { ok: true, detail: book(9) };
    });
    read.mockResolvedValueOnce(photos('https://example.com/fresh.jpg'));
    fireEvent.press(screen.getByTestId('store-view-media-retry'));
    await flush();
    expect(read).toHaveBeenCalledTimes(beforeRetry + 1);
    expect(disabled(screen, 'store-view-media-remove-0')).toBe(false);
    expect(screen.UNSAFE_getByType('Image' as any).props.source.uri).toBe('https://example.com/fresh.jpg');
    old.resolve(photos('https://example.com/stale.jpg'));
    await flush();
    expect(screen.UNSAFE_getByType('Image' as any).props.source.uri).toBe('https://example.com/fresh.jpg');
    remove(screen);
    await flush();
    expect(storeViewMediaService.remove).toHaveBeenCalledWith(expect.objectContaining({ expectedInventoryVersion: 9 }));
});

it.each(['management', 'media'] as const)('F2 %s mutateAsync resolves while an active invalidation refetch stalls', async (kind) => {
    const { client, wrapper } = setup();
    const stalled = stallActiveDetail(client);
    const hook = renderHook(() => kind === 'management'
        ? useStoreViewManagementCommands(identity) : useStoreViewMediaCommands(identity), { wrapper });
    let completed = false;
    act(() => {
        const mutate = hook.result.current.mutateAsync as (command: any) => Promise<unknown>;
        void mutate(kind === 'management'
            ? { kind: 'save', inventoryId, inventoryVersion: 3, changes: { title: 'New' } }
            : { kind: 'remove', inventoryId, inventoryVersion: 3, linkId }).then(() => { completed = true; });
    });
    await flush();
    expect(stalled.fetch).toHaveBeenCalledTimes(1);
    expect(completed).toBe(true);
    stalled.unsubscribe();
});

it('F2 detail save closes the edit modal while its follow-up detail refetch never resolves', async () => {
    const { wrapper } = setup();
    const refetch = jest.fn(() => new Promise(() => undefined));
    (useStoreViewDetail as jest.Mock).mockReturnValue({ isPending: false, data: book(), error: null, refetch });
    const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />, { wrapper });
    fireEvent.press(screen.getByTestId('store-view-edit'));
    fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'Updated title');
    fireEvent.press(screen.getByTestId('store-view-save-changes'));
    await flush();
    expect(storeViewManagementService.save).toHaveBeenCalledWith(expect.objectContaining({
        expectedInventoryVersion: 3, changes: { title: 'Updated title' },
    }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('store-view-action-feedback').props.children).toBe('Changes saved. Updating details…');
    expect(screen.queryByTestId('store-view-save-changes')).toBeNull();
    expect(screen.getByTestId('store-view-edit')).toBeDisabled();
});

it('F2 detail stock shows success and closes the stock sheet while its follow-up detail refetch never resolves', async () => {
    const { wrapper } = setup();
    const refetch = jest.fn(() => new Promise(() => undefined));
    (useStoreViewDetail as jest.Mock).mockReturnValue({ isPending: false,
        data: { ...book(), capabilities: ['adjust_stock'] }, error: null, refetch });
    (storeViewManagementService.adjustStock as jest.Mock).mockResolvedValue({ inventoryVersion: 4 });
    const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />, { wrapper });
    fireEvent.press(screen.getByTestId('store-view-adjust-stock'));
    fireEvent.changeText(screen.getByTestId('store-view-stock-delta'), '2');
    fireEvent.press(screen.getByTestId('store-view-apply-stock'));
    await flush();
    expect(storeViewManagementService.adjustStock).toHaveBeenCalledWith(expect.objectContaining({
        expectedInventoryVersion: 3, delta: 2,
    }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('store-view-action-feedback').props.children).toBe('Stock updated. Updating details…');
    expect(screen.queryByTestId('store-view-apply-stock')).toBeNull();
    expect(screen.getByTestId('store-view-adjust-stock')).toBeDisabled();
});

it('F2 photo command reaches ready while invalidation detail refetch stalls', async () => {
    const { screen, client } = photoModal();
    await flush();
    const stalled = stallActiveDetail(client);
    remove(screen);
    await flush();
    expect(stalled.fetch).toHaveBeenCalled();
    expect(screen.getByText('Photo removed.')).toBeTruthy();
    expect(disabled(screen, 'close-store-view-manage-photos')).toBe(false);
    stalled.unsubscribe();
});

it('F2 photo add reaches ready while invalidation detail refetch stalls', async () => {
    (publicationService.preparePublicCopyUpload as jest.Mock).mockResolvedValue({ capabilityId: 'cap',
        upload: () => ({ promise: Promise.resolve() }), complete: async () => ({ state: 'approved', mediaAssetId: 'asset' }) });
    const { screen, client } = photoModal();
    await flush();
    const stalled = stallActiveDetail(client);
    fireEvent.press(screen.getByTestId('store-view-media-add-photo'));
    await flush();
    expect(stalled.fetch).toHaveBeenCalled();
    expect(screen.getByText('Approved sanitized public-copy photo linked.')).toBeTruthy();
    expect(disabled(screen, 'close-store-view-manage-photos')).toBe(false);
    stalled.unsubscribe();
});

it.each(['resolve', 'reject'] as const)('F3 old remove %s after close and reopen leaves the new opening unchanged', async (outcome) => {
    const old = deferred();
    (storeViewMediaService.remove as jest.Mock).mockReturnValueOnce(old.promise);
    const { screen, reopen, onConfirmBook } = photoModal();
    await flush();
    remove(screen);
    await flush();
    reopen();
    await flush();
    if (outcome === 'resolve') old.resolve({ inventoryVersion: 99 });
    else old.reject(new Error('old remove failed'));
    await flush();
    expect(screen.queryByTestId('store-view-media-message')).toBeNull();
    expect(onConfirmBook).toHaveBeenCalledTimes(2);
    expect(disabled(screen, 'store-view-media-remove-0')).toBe(false);
    remove(screen);
    await flush();
    expect(storeViewMediaService.remove).toHaveBeenLastCalledWith(expect.objectContaining({ expectedInventoryVersion: 3 }));
});

it.each(['permission', 'requestPermission', 'picker', 'digest', 'prepare', 'upload', 'complete', 'status'] as const)(
    'F3 close or unmount during upload %s stops subsequent service calls', async (stage) => {
        const pending = deferred();
        const upload = jest.fn(() => ({ promise: Promise.resolve() }));
        const complete = jest.fn().mockResolvedValue({ state: 'processing', mediaAssetId: 'asset' });
        const prepared = { capabilityId: 'cap', upload, complete };
        const prepare = publicationService.preparePublicCopyUpload as jest.Mock;
        const status = publicationService.readPublicCopyStatus as jest.Mock;
        prepare.mockResolvedValue(prepared);
        status.mockResolvedValue({ state: 'approved', mediaAssetId: 'asset' });
        const stages: Record<typeof stage, jest.Mock> = {
            permission: ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock,
            requestPermission: ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock,
            picker: ImagePicker.launchImageLibraryAsync as jest.Mock,
            digest: Crypto.digestStringAsync as jest.Mock, prepare, upload, complete, status,
        };
        if (stage === 'requestPermission') (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock)
            .mockResolvedValue({ granted: false, canAskAgain: true });
        if (stage === 'upload') upload.mockReturnValue({ promise: pending.promise });
        else stages[stage].mockReturnValue(pending.promise);
        const { screen, reopen, onConfirmBook } = photoModal();
        await flush();
        fireEvent.press(screen.getByTestId('store-view-media-add-photo'));
        await flush();
        expect(stages[stage]).toHaveBeenCalledTimes(1);
        const after = ['permission', 'requestPermission', 'picker', 'digest', 'prepare', 'upload', 'complete', 'status']
            .slice(['permission', 'requestPermission', 'picker', 'digest', 'prepare', 'upload', 'complete', 'status'].indexOf(stage) + 1)
            .filter((name) => !(stage === 'permission' && name === 'requestPermission'));
        if (stage === 'upload' || stage === 'status') screen.unmount();
        else reopen();
        const confirms = onConfirmBook.mock.calls.length;
        pending.resolve(stage === 'permission' || stage === 'requestPermission' ? { granted: true }
            : stage === 'picker' ? { canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg', fileSize: 1000, width: 100, height: 100 }] }
                : stage === 'digest' ? 'digest' : stage === 'prepare' ? prepared
                    : stage === 'complete' || stage === 'status' ? { state: 'approved', mediaAssetId: 'asset' } : undefined);
        await flush();
        after.forEach((name) => expect(stages[name as typeof stage]).not.toHaveBeenCalled());
        expect(publicationService.submitPublicCopyMedia).not.toHaveBeenCalled();
        expect(onConfirmBook).toHaveBeenCalledTimes(confirms);
    },
);

it('F4 late media 403 after timeout routes access loss and removes private caches', async () => {
    const late = deferred();
    const { screen, client, onAccessLost } = photoModal();
    await flush();
    client.setQueryData(storeViewKeys.detail(identity, inventoryId), book());
    client.setQueryData(storeViewHistoryKeys.detail(identity, inventoryId), { private: 'history' });
    (storeViewMediaService.read as jest.Mock).mockReturnValue(late.promise);
    remove(screen);
    await flush();
    await advance(15_000);
    expect(screen.getByTestId('store-view-media-retry')).toBeTruthy();
    late.reject(new StoreViewMediaClientError('P9_OWNER_NOT_AUTHORIZED', false, 'Denied', 403));
    await flush();
    expect(onAccessLost).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(storeViewKeys.detail(identity, inventoryId))).toBeUndefined();
    expect(client.getQueryData(storeViewMediaKeys.detail(identity, inventoryId))).toBeUndefined();
    expect(client.getQueryData(storeViewHistoryKeys.detail(identity, inventoryId))).toBeUndefined();
});

it('F5 old successful save follow-up cannot close a reopened typed draft', async () => {
    const followUp = deferred();
    const save = jest.fn(async () => { await followUp.promise; return { ok: true }; });
    const editing = editor(save);
    editing.save('First title');
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    editing.reopen();
    fireEvent.changeText(editing.screen.getByTestId('store-view-edit-title'), 'New draft');
    followUp.resolve(undefined);
    await flush();
    expect(editing.onSaved).not.toHaveBeenCalled();
    expect(editing.screen.getByDisplayValue('New draft')).toBeTruthy();
    expect(disabled(editing.screen, 'store-view-save-changes')).toBe(false);
});

it('F6 initial detail 403 without cached detail removes seeded media and history', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(storeViewMediaKeys.detail(identity, inventoryId), photos());
    client.setQueryData(storeViewHistoryKeys.detail(identity, inventoryId), { private: 'history' });
    (useStoreViewDetail as jest.Mock).mockReturnValue({ isPending: false, data: undefined,
        error: { httpStatus: 403 }, refetch: jest.fn() });
    const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />, { wrapper });
    await flush();
    expect(screen.getByText('Store View unavailable')).toBeTruthy();
    expect(client.getQueryData(storeViewMediaKeys.detail(identity, inventoryId))).toBeUndefined();
    expect(client.getQueryData(storeViewHistoryKeys.detail(identity, inventoryId))).toBeUndefined();
});

it.each(['stall', 'failure', 'access-loss'] as const)('F7 processing upload bounds its media refresh on %s', async (outcome) => {
    (publicationService.preparePublicCopyUpload as jest.Mock).mockResolvedValue({ capabilityId: 'cap',
        upload: () => ({ promise: Promise.resolve() }), complete: async () => ({ state: 'processing', mediaAssetId: 'asset' }) });
    (publicationService.readPublicCopyStatus as jest.Mock).mockResolvedValue({ state: 'processing', mediaAssetId: 'asset' });
    const { screen, onAccessLost } = photoModal();
    await flush();
    const read = storeViewMediaService.read as jest.Mock;
    if (outcome === 'stall') read.mockReturnValue(new Promise(() => undefined));
    else read.mockRejectedValue(outcome === 'access-loss'
        ? new StoreViewMediaClientError('P9_OWNER_NOT_AUTHORIZED', false, 'Denied', 403) : new Error('temporary'));
    fireEvent.press(screen.getByTestId('store-view-media-add-photo'));
    await flush();
    await advance(15_000);
    expect(disabled(screen, 'close-store-view-manage-photos')).toBe(false);
    expect(screen.getByText('Photo uploaded. Safety processing is running; check again shortly.')).toBeTruthy();
    expect(onAccessLost).toHaveBeenCalledTimes(outcome === 'access-loss' ? 1 : 0);
});

it('F8 old recovery timeout cannot unlock inputs or Save during a newer recovery', async () => {
    const old = deferred();
    const newer = deferred();
    const refresh = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
    const editing = editor(jest.fn().mockResolvedValue({ ok: false, code: 'P9_VERSION_CONFLICT' }), refresh);
    editing.save('First title');
    await flush();
    editing.reopen();
    editing.save('Second title');
    await flush();
    expect(refresh).toHaveBeenCalledTimes(2);
    setTimeout(() => old.resolve({ ok: false, offline: true }), 15_000);
    await advance(15_000);
    expect(disabled(editing.screen, 'store-view-save-changes')).toBe(true);
    expect(editing.screen.getByTestId('store-view-edit-title').props.editable).toBe(false);
    newer.resolve({ ok: true, detail: book(4) });
    await flush();
    expect(editing.screen.getByTestId('store-view-edit-title').props.editable).toBe(true);
});
