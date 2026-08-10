import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { ownerUxService, type CloseScanSessionRequest } from '../api/ownerUxService';
import {
    coordinateImageInventoryIdentity,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import { useCloseOwnerInventorySession } from '../queries/ownerUxCloseQueries';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('../api/ownerUxService', () => {
    const actual = jest.requireActual('../api/ownerUxService');
    return { ...actual, ownerUxService: { ...actual.ownerUxService, closeSession: jest.fn() } };
});

const closeSession = ownerUxService.closeSession as jest.Mock;
const identity = { userId: 'owner-a', storeId: 'store-a' };
const request: CloseScanSessionRequest = {
    sessionId: testUuid(1),
    expectedSessionVersion: 2,
    idempotencyKey: 'close-session:fixed-command-0001',
    commandId: testUuid(9),
};

describe('Phase 9 Unit 6F Close request authority fence', () => {
    let client: QueryClient;
    let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        resetImageInventoryIdentityForTests(identity);
    });

    afterEach(() => client.clear());

    it('uses always-online execution with retry disabled and aborts transport on unmount', async () => {
        closeSession.mockImplementation((_command: CloseScanSessionRequest, signal: AbortSignal) => (
            new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
        ));
        const hook = renderHook(
            () => useCloseOwnerInventorySession(identity, request.sessionId),
            { wrapper },
        );
        let pending!: Promise<unknown>;
        act(() => { pending = hook.result.current.mutateAsync(request); });
        const rejection = expect(pending).rejects.toThrow('aborted');
        await waitFor(() => expect(closeSession).toHaveBeenCalledTimes(1));
        const signal = closeSession.mock.calls[0][1] as AbortSignal;
        expect(client.getMutationCache().getAll()[0].options).toMatchObject({
            networkMode: 'always', retry: false,
        });
        hook.unmount();
        expect(signal.aborted).toBe(true);
        await rejection;
    });

    it('aborts an in-flight Close when the Owner/store authority changes', async () => {
        closeSession.mockImplementation((_command: CloseScanSessionRequest, signal: AbortSignal) => (
            new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
        ));
        const hook = renderHook(
            () => useCloseOwnerInventorySession(identity, request.sessionId),
            { wrapper },
        );
        let pending!: Promise<unknown>;
        act(() => { pending = hook.result.current.mutateAsync(request); });
        const rejection = expect(pending).rejects.toThrow('aborted');
        await waitFor(() => expect(closeSession).toHaveBeenCalledTimes(1));
        await act(async () => coordinateImageInventoryIdentity({ userId: 'owner-b', storeId: 'store-b' }, client));
        expect((closeSession.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
        await rejection;
        hook.unmount();
    });
});
