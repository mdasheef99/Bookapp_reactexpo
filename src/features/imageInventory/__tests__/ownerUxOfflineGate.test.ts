import {
    coalesceOwnerUxRefresh,
    invalidateOwnerUxRefreshScope,
    resetOwnerUxRefreshCoalescerForTests,
} from '../offline/ownerUxOfflineGate';

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
