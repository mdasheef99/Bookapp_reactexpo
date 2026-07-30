import { Stack } from 'expo-router';

export default function InventoryLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Inventory' }} />
            <Stack.Screen name="reviews" options={{ title: 'Needs review' }} />
            <Stack.Screen name="scan" options={{ headerShown: false }} />
        </Stack>
    );
}
