import { useLocalSearchParams } from 'expo-router';
import {
    InvalidInventoryRouteScreen,
    InventoryPreviewFoundationScreen,
} from '@/features/imageInventory/screens/InventoryFoundationScreens';
import { parseSessionRouteParams } from '@/features/imageInventory/navigation/inventoryRoutes';

export default function InventoryPreviewRoute() {
    const params = parseSessionRouteParams(useLocalSearchParams());
    return params
        ? <InventoryPreviewFoundationScreen sessionId={params.sessionId} />
        : <InvalidInventoryRouteScreen />;
}
