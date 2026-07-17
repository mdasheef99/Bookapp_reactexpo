import { appQueryClient } from '@/lib/queryClient';
import { useCommerceStore } from '../store/commerceStore';

export async function clearCommerceSession() {
    await appQueryClient.cancelQueries();
    appQueryClient.getMutationCache().clear();
    appQueryClient.clear();
    useCommerceStore.getState().reset();
}
