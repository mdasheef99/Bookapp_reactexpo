import { useLocalSearchParams } from 'expo-router';
import {
    InvalidInventoryRouteScreen,
    InventorySessionFoundationScreen,
} from '@/features/imageInventory/screens/InventoryFoundationScreens';
import { parseSessionRouteParams } from '@/features/imageInventory/navigation/inventoryRoutes';

export default function InventorySessionRoute() {
    const params = parseSessionRouteParams(useLocalSearchParams());
    return params
        ? <InventorySessionFoundationScreen sessionId={params.sessionId} />
        : <InvalidInventoryRouteScreen />;
}
