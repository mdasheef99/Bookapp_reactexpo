import { useLocalSearchParams } from 'expo-router';
import {
    InvalidInventoryRouteScreen,
    InventoryCandidateFoundationScreen,
} from '@/features/imageInventory/screens/InventoryFoundationScreens';
import { parseCandidateRouteParams } from '@/features/imageInventory/navigation/inventoryRoutes';

export default function InventoryCandidateRoute() {
    const params = parseCandidateRouteParams(useLocalSearchParams());
    return params
        ? (
            <InventoryCandidateFoundationScreen
                sessionId={params.sessionId}
                candidateId={params.candidateId}
            />
        )
        : <InvalidInventoryRouteScreen />;
}
