import fs from 'fs';
import path from 'path';
import { appQueryClient } from '@/lib/queryClient';
import { clearCommerceSession } from '../services/commerceSession';
import { useCommerceStore } from '../store/commerceStore';

describe('Phase 6 commerce logout and persistence boundary', () => {
    it('clears QueryClient customer, Owner, notification, and private presentation data', async () => {
        appQueryClient.setQueryData(['marketplace', 'commerce', 'customer', 'request', 'r1'], { private: true });
        appQueryClient.setQueryData(['marketplace', 'commerce', 'owner', 'request', 'r1'], { owner: true });
        appQueryClient.setQueryData(['notifications', 'u1'], [{ id: 'n1' }]);
        await clearCommerceSession();
        expect(appQueryClient.getQueryCache().getAll()).toHaveLength(0);
    });
    it('clears replacement, clarification, and deep-link memory state', async () => {
        useCommerceStore.getState().setReplacement({ token: 'private', expectedVersion: 1 });
        useCommerceStore.getState().setClarificationDraft('r1', 'private response');
        useCommerceStore.getState().setDeepLinkRequestId('r1');
        await clearCommerceSession();
        expect(useCommerceStore.getState()).toEqual(expect.objectContaining({
            replacement: null, clarificationDrafts: {}, deepLinkRequestId: null,
        }));
    });
    it('does not persist commerce snapshots in AsyncStorage or MMKV', () => {
        const root = path.join(process.cwd(), 'src/features/marketplace/commerce');
        const sources = fs.readdirSync(root, { recursive: true })
            .filter((name) => /\.(ts|tsx)$/.test(String(name)) && !String(name).includes('__tests__'))
            .map((name) => fs.readFileSync(path.join(root, String(name)), 'utf8')).join('\n');
        expect(sources).not.toMatch(/AsyncStorage|MMKV|persist\s*\(/);
    });
    it('continues remaining privacy cleanup when cancellation fails', async () => {
        const cancel = jest.spyOn(appQueryClient, 'cancelQueries').mockRejectedValueOnce(new Error('cancel failed'));
        const clearQueries = jest.spyOn(appQueryClient, 'clear');
        const reset = jest.spyOn(useCommerceStore.getState(), 'reset');

        await expect(clearCommerceSession()).rejects.toThrow('1 step');

        expect(clearQueries).toHaveBeenCalled();
        expect(reset).toHaveBeenCalled();
        cancel.mockRestore();
        clearQueries.mockRestore();
        reset.mockRestore();
    });
});
