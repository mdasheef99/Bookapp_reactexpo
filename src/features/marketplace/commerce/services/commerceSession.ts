import { appQueryClient } from '@/lib/queryClient';
import { useCommerceStore } from '../store/commerceStore';

export async function clearCommerceSession() {
    const failures: unknown[] = [];
    try {
        await appQueryClient.cancelQueries();
    } catch (error) {
        failures.push(error);
    }
    for (const cleanup of [
        () => appQueryClient.getMutationCache().clear(),
        () => appQueryClient.clear(),
        () => useCommerceStore.getState().reset(),
    ]) {
        try {
            cleanup();
        } catch (error) {
            failures.push(error);
        }
    }
    if (failures.length > 0) {
        throw new Error(`User-scoped cleanup failed in ${failures.length} step(s).`);
    }
}
