import { Stack } from 'expo-router';

export default function InventoryScanLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Scan book spines' }} />
            <Stack.Screen name="preview" options={{ title: 'Image preview' }} />
            <Stack.Screen name="[sessionId]" options={{ headerShown: false }} />
        </Stack>
    );
}
