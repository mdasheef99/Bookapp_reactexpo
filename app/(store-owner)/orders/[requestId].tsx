import { useLocalSearchParams } from 'expo-router';
import OwnerOrderDetailScreen from '@/features/marketplace/commerce/screens/OwnerOrderDetailScreen';

export default function OwnerOrderDetailRoute() {
    const { requestId } = useLocalSearchParams<{ requestId: string }>();
    return <OwnerOrderDetailScreen requestId={requestId ?? ''} />;
}
