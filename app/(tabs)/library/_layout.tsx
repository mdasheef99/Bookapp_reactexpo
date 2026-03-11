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
            <Stack.Screen name="[bookId]" />
            <Stack.Screen name="notes" />
        </Stack>
    );
}
