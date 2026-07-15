import { useLocalSearchParams } from 'expo-router';
import PublicBookOffersScreen from '@/features/marketplace/screens/PublicBookOffersScreen';

export default function PublicBookOffersRoute() {
    const { listingId } = useLocalSearchParams<{ listingId: string }>();
    if (!listingId) return null;
    return <PublicBookOffersScreen listingId={listingId} />;
}
