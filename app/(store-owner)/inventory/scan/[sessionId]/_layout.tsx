import { Stack } from 'expo-router';

export default function InventorySessionLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Scan session' }} />
            <Stack.Screen name="candidate/[candidateId]" options={{ title: 'Book review' }} />
            <Stack.Screen name="missed" options={{ title: 'Add missed book' }} />
            <Stack.Screen name="summary" options={{ title: 'Session summary' }} />
        </Stack>
    );
}
