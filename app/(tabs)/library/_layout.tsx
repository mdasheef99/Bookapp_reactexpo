import { Stack } from 'expo-router';

export default function LibraryLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="search" />
            <Stack.Screen name="[bookId]" options={{ animation: 'fade' }} />
            <Stack.Screen name="notes" options={{ animation: 'none' }} />
            <Stack.Screen name="note" options={{ animation: 'none' }} />
            <Stack.Screen name="note-compose" options={{ gestureEnabled: false, animation: 'none' }} />
        </Stack>
    );
}
