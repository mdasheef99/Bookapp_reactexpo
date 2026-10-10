import { Stack } from 'expo-router';

export default function MarketplaceLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="cart" />
            <Stack.Screen name="book/[listingId]" />
            <Stack.Screen name="requests/index" />
            <Stack.Screen name="requests/[requestId]" />
            <Stack.Screen name="store/[storeId]" />
        </Stack>
    );
}
