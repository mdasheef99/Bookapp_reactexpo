import { useLocalSearchParams } from 'expo-router';
import PublicStoreScreen from '@/features/marketplace/screens/PublicStoreScreen';

export default function PublicStoreRoute() {
    const { storeId, matchContext, searchQuery } = useLocalSearchParams<{
        storeId: string;
        matchContext?: string;
        searchQuery?: string;
    }>();
    if (!storeId) return null;
    return (
        <PublicStoreScreen
            storeId={storeId}
            matchContext={matchContext ?? null}
            searchQuery={searchQuery ?? null}
        />
    );
}
