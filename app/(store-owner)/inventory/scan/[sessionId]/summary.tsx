import { useLocalSearchParams } from 'expo-router';
import {
    InvalidInventoryRouteScreen,
    InventorySummaryFoundationScreen,
} from '@/features/imageInventory/screens/InventoryFoundationScreens';
import { parseSessionRouteParams } from '@/features/imageInventory/navigation/inventoryRoutes';

export default function InventorySummaryRoute() {
    const params = parseSessionRouteParams(useLocalSearchParams());
    return params
        ? <InventorySummaryFoundationScreen sessionId={params.sessionId} />
        : <InvalidInventoryRouteScreen />;
}
