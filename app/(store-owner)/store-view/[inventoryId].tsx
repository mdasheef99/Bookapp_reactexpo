import { useLocalSearchParams } from 'expo-router';
import { StoreViewDetailScreen } from '@/features/storeView/screens/StoreViewDetailScreen';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export default function StoreViewDetailRoute() {
    const { inventoryId } = useLocalSearchParams<{ inventoryId?: string | string[] }>();
    const valid = typeof inventoryId === 'string' && UUID.test(inventoryId);
    return <StoreViewDetailScreen inventoryId={valid ? inventoryId : 'invalid'} />;
}
