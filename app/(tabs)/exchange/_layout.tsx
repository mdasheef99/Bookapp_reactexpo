import { Stack } from 'expo-router';

export default function ExchangeLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="create" />
            <Stack.Screen name="my-transactions" />
            <Stack.Screen name="[listingId]" />
            <Stack.Screen name="transaction" />
        </Stack>
    );
}

