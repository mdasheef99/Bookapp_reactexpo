import type { PropsWithChildren, ReactElement } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { createCaptureAttempt } from '@/features/imageInventory/capture/captureIds';
import { imageInventoryKeys } from '@/features/imageInventory/queries/ownerUxQueries';
import { ownerInventoryReadKeys } from '@/features/imageInventory/queries/ownerInventoryReadQueries';
import { storeViewManagementService } from '../api/storeViewManagementService';
import { storeViewMediaService } from '../api/storeViewMediaService';
import { STORE_VIEW_FILTERS } from '../contracts/storeViewContracts';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewMediaCommands } from '../queries/storeViewMediaCommands';
import { storeViewKeys } from '../queries/storeViewQueries';
import { storeViewMediaKeys } from '../queries/storeViewMediaQueries';
import { storeViewHistoryKeys } from '../queries/storeViewHistoryQueries';
import { storeViewFamilyPrefixes } from '../queries/storeViewInvalidation';
import {
    invalidateStoreViewAfterMedia,
    invalidateStoreViewAfterSave,
} from '../queries/storeViewInvalidation';

jest.mock('@/features/imageInventory/capture/captureIds', () => ({
    createCaptureAttempt: jest.fn(),
}));
jest.mock('../api/storeViewManagementService', () => ({
    storeViewManagementService: { save: jest.fn(), adjustStock: jest.fn() },
}));
jest.mock('../api/storeViewMediaService', () => ({
    storeViewMediaService: { reorder: jest.fn(), remove: jest.fn(), replace: jest.fn() },
}));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const otherIdentity = { userId: 'owner-b', storeId: 'store-b' };
const unresolved = { userId: 'unresolved', storeId: 'unresolved' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const otherInventoryId = '00000000-0000-4000-8000-000000000009';

function setup() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity, gcTime: 60_000 },
            mutations: { retry: false },
        },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

function SeedQuery({ queryKey, fetch }: { queryKey: readonly unknown[]; fetch: jest.Mock }) {
    useQuery({ queryKey, queryFn: fetch });
    return null;
}

/** Mounts one live query per key under a single provider; returns per-key fetch counters. */
function seedQueries(wrapper: (props: PropsWithChildren) => ReactElement) {
    const counters = new Map<string, jest.Mock>();
    const keys: ReadonlyArray<readonly unknown[]> = [
        ...STORE_VIEW_FILTERS.map((filter) => storeViewKeys.page(identity, filter)),
        storeViewKeys.detail(identity, inventoryId),
        storeViewMediaKeys.detail(identity, inventoryId),
        storeViewHistoryKeys.detail(identity, inventoryId),
        ownerInventoryReadKeys.list(identity, {}),
        storeViewKeys.page(otherIdentity, 'all'),
        storeViewKeys.detail(otherIdentity, otherInventoryId),
        storeViewMediaKeys.detail(otherIdentity, otherInventoryId),
        storeViewHistoryKeys.detail(otherIdentity, otherInventoryId),
        ownerInventoryReadKeys.list(otherIdentity, {}),
        storeViewKeys.page(unresolved, 'all'),
        storeViewKeys.detail(unresolved, 'unresolved'),
        storeViewMediaKeys.detail(unresolved, 'unresolved'),
        storeViewHistoryKeys.detail(unresolved, 'unresolved'),
        ownerInventoryReadKeys.list(unresolved, {}),
    ];
    for (const queryKey of keys) {
        counters.set(JSON.stringify(queryKey), jest.fn(async () => ({ ok: true })));
    }
    const Provided = wrapper;
    const tree = render(
        <Provided>
            {keys.map((queryKey) => (
                <SeedQuery
                    key={JSON.stringify(queryKey)}
                    queryKey={queryKey}
                    fetch={counters.get(JSON.stringify(queryKey))!}
                />
            ))}
        </Provided>,
    );
    return {
        calls: (queryKey: readonly unknown[]) => counters.get(JSON.stringify(queryKey))!.mock.calls.length,
        unmount: () => tree.unmount(),
    };
}

async function settled() {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('Slice 0a §3.1 identity-scoped Store View invalidation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createCaptureAttempt as jest.Mock).mockReturnValue({
            key: 'store-view-command:attempt-1',
            commandId: '00000000-0000-4000-8000-000000000002',
        });
        (storeViewManagementService.save as jest.Mock).mockResolvedValue({ outcome: 'details_updated' });
        (storeViewManagementService.adjustStock as jest.Mock).mockResolvedValue({ outcome: 'stock_adjusted' });
        (storeViewMediaService.reorder as jest.Mock).mockResolvedValue({ outcome: 'media_reordered' });
        (storeViewMediaService.remove as jest.Mock).mockResolvedValue({ outcome: 'media_removed' });
        (storeViewMediaService.replace as jest.Mock).mockResolvedValue({ outcome: 'media_replaced' });
    });

    it('refreshes the current identity page, detail, history and owner-read on save but leaves media alone', async () => {
        const { client, wrapper } = setup();
        const seeded = seedQueries(wrapper);
        const hook = renderHook(() => useStoreViewManagementCommands(identity), { wrapper });
        await settled();
        await act(async () => hook.result.current.mutateAsync({
            kind: 'save', inventoryId, inventoryVersion: 3, changes: { title: 'Updated title' },
        }));
        const pageKey = storeViewKeys.page(identity, 'all');
        await waitFor(() => expect(seeded.calls(pageKey)).toBeGreaterThan(1));
        for (const filter of STORE_VIEW_FILTERS) {
            expect(seeded.calls(storeViewKeys.page(identity, filter))).toBeGreaterThan(1);
        }
        expect(seeded.calls(storeViewKeys.detail(identity, inventoryId))).toBeGreaterThan(1);
        expect(seeded.calls(storeViewHistoryKeys.detail(identity, inventoryId))).toBeGreaterThan(1);
        expect(seeded.calls(ownerInventoryReadKeys.list(identity, {}))).toBeGreaterThan(1);
        expect(seeded.calls(storeViewMediaKeys.detail(identity, inventoryId))).toBe(1);
        expect(seeded.calls(storeViewKeys.detail(otherIdentity, otherInventoryId))).toBe(1);
        expect(seeded.calls(ownerInventoryReadKeys.list(otherIdentity, {}))).toBe(1);
        expect(seeded.calls(storeViewKeys.page(unresolved, 'all'))).toBe(1);
        hook.unmount();
        seeded.unmount();
        client.clear();
    });

    it('refreshes the current identity page, detail, media, history and owner-read on stock', async () => {
        const { client, wrapper } = setup();
        const seeded = seedQueries(wrapper);
        const hook = renderHook(() => useStoreViewManagementCommands(identity), { wrapper });
        await settled();
        await act(async () => hook.result.current.mutateAsync({
            kind: 'stock', inventoryId, inventoryVersion: 4, delta: -1,
        }));
        await waitFor(() => expect(
            seeded.calls(storeViewHistoryKeys.detail(identity, inventoryId)),
        ).toBeGreaterThan(1));
        expect(seeded.calls(storeViewKeys.detail(identity, inventoryId))).toBeGreaterThan(1);
        expect(seeded.calls(ownerInventoryReadKeys.list(identity, {}))).toBeGreaterThan(1);
        expect(seeded.calls(storeViewKeys.detail(otherIdentity, otherInventoryId))).toBe(1);
        hook.unmount();
        seeded.unmount();
        client.clear();
    });

    it('refreshes every current-identity family including owner-read on photo reorder', async () => {
        const { client, wrapper } = setup();
        const seeded = seedQueries(wrapper);
        const hook = renderHook(() => useStoreViewMediaCommands(identity), { wrapper });
        await settled();
        await act(async () => hook.result.current.mutateAsync({
            kind: 'reorder', inventoryId, inventoryVersion: 3,
            orderedLinkIds: ['00000000-0000-4000-8000-000000000003'],
        }));
        await waitFor(() => expect(
            seeded.calls(storeViewMediaKeys.detail(identity, inventoryId)),
        ).toBeGreaterThan(1));
        expect(seeded.calls(storeViewKeys.detail(identity, inventoryId))).toBeGreaterThan(1);
        expect(seeded.calls(storeViewHistoryKeys.detail(identity, inventoryId))).toBeGreaterThan(1);
        expect(seeded.calls(ownerInventoryReadKeys.list(identity, {}))).toBeGreaterThan(1);
        expect(seeded.calls(storeViewMediaKeys.detail(otherIdentity, otherInventoryId))).toBe(1);
        expect(seeded.calls(storeViewHistoryKeys.detail(unresolved, 'unresolved'))).toBe(1);
        hook.unmount();
        seeded.unmount();
        client.clear();
    });

    it('refreshes media, history and owner-read on photo remove and replace', async () => {
        const { client, wrapper } = setup();
        const seeded = seedQueries(wrapper);
        const hook = renderHook(() => useStoreViewMediaCommands(identity), { wrapper });
        await settled();
        await act(async () => hook.result.current.mutateAsync({
            kind: 'remove', inventoryId, inventoryVersion: 5,
            linkId: '00000000-0000-4000-8000-000000000004',
        }));
        await waitFor(() => expect(
            seeded.calls(storeViewMediaKeys.detail(identity, inventoryId)),
        ).toBeGreaterThan(1));
        expect(seeded.calls(ownerInventoryReadKeys.list(identity, {}))).toBeGreaterThan(1);
        await act(async () => hook.result.current.mutateAsync({
            kind: 'replace', inventoryId, inventoryVersion: 6,
            capabilityId: '00000000-0000-4000-8000-000000000005',
            mediaAssetId: '00000000-0000-4000-8000-000000000006',
            targetLinkId: '00000000-0000-4000-8000-000000000004',
        }));
        await waitFor(() => expect(
            seeded.calls(storeViewHistoryKeys.detail(identity, inventoryId)),
        ).toBeGreaterThan(2));
        expect(seeded.calls(storeViewMediaKeys.detail(otherIdentity, otherInventoryId))).toBe(1);
        hook.unmount();
        seeded.unmount();
        client.clear();
    });

    it('emits only prefixes of keys produced by the Store View and owner-read factories', () => {
        const factories: Array<readonly unknown[]> = [
            ...STORE_VIEW_FILTERS.map((filter) => storeViewKeys.page(identity, filter)),
            storeViewKeys.detail(identity, inventoryId),
            storeViewMediaKeys.detail(identity, inventoryId),
            storeViewHistoryKeys.detail(identity, inventoryId),
            ownerInventoryReadKeys.list(identity, {}),
        ];
        const prefixes = Object.values(storeViewFamilyPrefixes(identity));
        expect(prefixes.length).toBeGreaterThan(0);
        for (const prefix of prefixes) {
            expect(factories.some((key) => key.length >= prefix.length
                && (prefix as readonly unknown[]).every((part, index) => key[index] === part))).toBe(true);
        }
        // The bare *.all keys carry no identity and match nothing stored.
        for (const all of [storeViewKeys.all, storeViewMediaKeys.all, storeViewHistoryKeys.all]) {
            expect(prefixes.some((prefix) => (prefix as readonly unknown[])
                .every((part, index) => (all as readonly unknown[])[index] === part))).toBe(false);
        }
    });

    it('never invalidates the shared image-inventory root', async () => {        const { client, wrapper } = setup();
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        const hook = renderHook(() => useStoreViewManagementCommands(identity), { wrapper });
        await act(async () => hook.result.current.mutateAsync({
            kind: 'save', inventoryId, inventoryVersion: 3, changes: { title: 'Updated title' },
        }));
        const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify((arg as { queryKey: unknown }).queryKey));
        expect(keys.some((key) => key === JSON.stringify(imageInventoryKeys.all))).toBe(false);
        hook.unmount();
        client.clear();
    });

    it('R14: invalidates families in parallel so one stalled family cannot block the others', async () => {
        const seen: string[][] = [];
        const stalled = new Promise<void>(() => undefined);
        const client = {
            invalidateQueries: jest.fn((arg: { queryKey: readonly unknown[] }) => {
                seen.push([...arg.queryKey] as string[]);
                // The first family stalls forever; the rest resolve.
                return seen.length === 1 ? stalled : Promise.resolve();
            }),
        } as unknown as QueryClient;
        const pending = invalidateStoreViewAfterSave(client, identity);
        // Sequential awaits would still be parked on the first family here.
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(client.invalidateQueries).toHaveBeenCalledTimes(3);
        const mediaPending = invalidateStoreViewAfterMedia(client, identity);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(client.invalidateQueries).toHaveBeenCalledTimes(7);
        // Keep the stalled promises from surfacing as unhandled work.
        void pending.catch(() => undefined);
        void mediaPending.catch(() => undefined);
    });
});
