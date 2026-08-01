import {
    coalesceOwnerUxRefresh,
    invalidateOwnerUxRefreshScope,
    resetOwnerUxRefreshCoalescerForTests,
    useOwnerUxOfflineGate,
} from '../offline/ownerUxOfflineGate';
import { act, renderHook, waitFor } from '@testing-library/react-native';

describe('Phase 9 Unit 6F authoritative reconnect refresh', () => {
    beforeEach(resetOwnerUxRefreshCoalescerForTests);

    it('coalesces simultaneous foreground, reconnect, and manual refresh triggers', async () => {
        let resolve!: (value: boolean) => void;
        const task = jest.fn(() => new Promise<boolean>((done) => { resolve = done; }));
        const first = coalesceOwnerUxRefresh('owner:store:session', task);
        const second = coalesceOwnerUxRefresh('owner:store:session', task);
        expect(task).toHaveBeenCalledTimes(1);
        resolve(true);
        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        task.mockResolvedValue(true);
        await coalesceOwnerUxRefresh('owner:store:session', task);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('does not share authority across identity or session scopes', async () => {
        const task = jest.fn().mockResolvedValue(true);
        await Promise.all([
            coalesceOwnerUxRefresh('owner-a:store:session', task),
            coalesceOwnerUxRefresh('owner-b:store:session', task),
        ]);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('does not let an old in-flight generation suppress a required same-scope refetch', async () => {
        let resolveOld!: (value: boolean) => void;
        const oldTask = jest.fn(() => new Promise<boolean>((resolve) => { resolveOld = resolve; }));
        const nextTask = jest.fn().mockResolvedValue(true);
        const old = coalesceOwnerUxRefresh('owner:store:session', oldTask);

        invalidateOwnerUxRefreshScope('owner:store:session');
        await expect(coalesceOwnerUxRefresh('owner:store:session', nextTask)).resolves.toBe(true);
        expect(nextTask).toHaveBeenCalledTimes(1);
        resolveOld(true);
        await expect(old).resolves.toBe(true);
    });
});

describe('Phase 9 Unit 6F reconnect authority generations', () => {
    beforeEach(resetOwnerUxRefreshCoalescerForTests);

    it('revokes fetched authority offline and requires a successful reconnect receipt', async () => {
        let resolveRefresh!: (value: boolean) => void;
        const refresh = jest.fn(() => new Promise<boolean>((resolve) => { resolveRefresh = resolve; }));
        const hook = renderHook<
            ReturnType<typeof useOwnerUxOfflineGate>,
            { isOffline: boolean }
        >(
            ({ isOffline }: { isOffline: boolean }) => useOwnerUxOfflineGate({
                scope: 'owner:store:session:candidate', isOffline, refresh,
                hasAuthoritativeData: true, currentAuthorityVerified: true,
            }),
            { initialProps: { isOffline: false } },
        );
        expect(hook.result.current.canMutate).toBe(true);
        hook.rerender({ isOffline: true });
        expect(hook.result.current.canMutate).toBe(false);
        hook.rerender({ isOffline: false });
        expect(hook.result.current.canMutate).toBe(false);
        expect(hook.result.current.authorityState).toBe('REFRESHING');
        await act(async () => resolveRefresh(true));
        await waitFor(() => expect(hook.result.current.canMutate).toBe(true));
        expect(hook.result.current.authorityState).toBe('AUTHORITATIVE');
    });

    it('keeps retained data read-only after reconnect failure', async () => {
        const refresh = jest.fn().mockResolvedValue(false);
        const hook = renderHook<
            ReturnType<typeof useOwnerUxOfflineGate>,
            { isOffline: boolean }
        >(
            ({ isOffline }: { isOffline: boolean }) => useOwnerUxOfflineGate({
                scope: 'owner:store:session:candidate', isOffline, refresh,
                hasAuthoritativeData: true, currentAuthorityVerified: true,
            }),
            { initialProps: { isOffline: true } },
        );
        hook.rerender({ isOffline: false });
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(hook.result.current.authorityState).toBe('ERROR_READ_ONLY'));
        expect(hook.result.current.canMutate).toBe(false);
    });

    it('does not inherit authority across a scope change and ignores an older same-scope receipt', async () => {
        const resolvers: Array<(value: boolean) => void> = [];
        const refresh = jest.fn(() => new Promise<boolean>((resolve) => { resolvers.push(resolve); }));
        const hook = renderHook<
            ReturnType<typeof useOwnerUxOfflineGate>,
            { scope: string }
        >(
            ({ scope }: { scope: string }) => useOwnerUxOfflineGate({
                scope, isOffline: false, refresh,
                hasAuthoritativeData: true, currentAuthorityVerified: true,
            }),
            { initialProps: { scope: 'owner:store:session-a:candidate-a' } },
        );
        expect(hook.result.current.canMutate).toBe(true);
        hook.rerender({ scope: 'owner:store:session-b:candidate-a' });
        expect(hook.result.current.canMutate).toBe(false);
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
        hook.rerender({ scope: 'owner:store:session-a:candidate-a' });
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
        await act(async () => resolvers[0](true));
        expect(hook.result.current.canMutate).toBe(false);
        await act(async () => resolvers[1](true));
        await waitFor(() => expect(hook.result.current.canMutate).toBe(true));
    });

    it('remounts with retained cache read-only until the current fetch succeeds', async () => {
        let resolveRefresh!: (value: boolean) => void;
        const refresh = jest.fn(() => new Promise<boolean>((resolve) => { resolveRefresh = resolve; }));
        const hook = renderHook(() => useOwnerUxOfflineGate({
            scope: 'owner:store:session:candidate', isOffline: false, refresh,
            hasAuthoritativeData: true, currentAuthorityVerified: false,
        }));
        expect(hook.result.current.canMutate).toBe(false);
        await act(async () => resolveRefresh(true));
        await waitFor(() => expect(hook.result.current.canMutate).toBe(true));
    });

    it('invalidates current authority when a current query errors with retained cache', () => {
        const hook = renderHook<
            ReturnType<typeof useOwnerUxOfflineGate>,
            { hasAuthoritativeData: boolean }
        >(
            ({ hasAuthoritativeData }: { hasAuthoritativeData: boolean }) => useOwnerUxOfflineGate({
                scope: 'owner:store:session:candidate', isOffline: false,
                refresh: jest.fn().mockResolvedValue(false),
                hasAuthoritativeData, currentAuthorityVerified: true,
            }),
            { initialProps: { hasAuthoritativeData: true } },
        );
        expect(hook.result.current.canMutate).toBe(true);
        hook.rerender({ hasAuthoritativeData: false });
        expect(hook.result.current.canMutate).toBe(false);
        expect(hook.result.current.authorityState).not.toBe('AUTHORITATIVE');
    });
});
