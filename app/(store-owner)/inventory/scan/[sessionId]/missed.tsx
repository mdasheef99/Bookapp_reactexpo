import { useLocalSearchParams } from 'expo-router';
import {
    InvalidInventoryRouteScreen,
    InventoryMissedFoundationScreen,
} from '@/features/imageInventory/screens/InventoryFoundationScreens';
import { parseSessionRouteParams } from '@/features/imageInventory/navigation/inventoryRoutes';

export default function InventoryMissedRoute() {
    const params = parseSessionRouteParams(useLocalSearchParams());
    return params
        ? <InventoryMissedFoundationScreen sessionId={params.sessionId} />
        : <InvalidInventoryRouteScreen />;
}
