import { useLocalSearchParams } from 'expo-router';
import PublicStoreScreen from '@/features/marketplace/screens/PublicStoreScreen';

export default function PublicStoreRoute() {
    const { storeId } = useLocalSearchParams<{ storeId: string }>();
    if (!storeId) return null;
    return <PublicStoreScreen storeId={storeId} />;
}
