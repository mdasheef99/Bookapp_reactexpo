import { Stack } from 'expo-router';

export default function StoreViewLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Store View' }} />
            <Stack.Screen name="[inventoryId]" options={{ title: 'Book details' }} />
        </Stack>
    );
}
