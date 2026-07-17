import { useLocalSearchParams } from 'expo-router';
import CustomerRequestDetailScreen from '@/features/marketplace/commerce/screens/CustomerRequestDetailScreen';

export default function CustomerRequestDetailRoute() {
    const { requestId } = useLocalSearchParams<{ requestId: string }>();
    return <CustomerRequestDetailScreen requestId={requestId ?? ''} />;
}
