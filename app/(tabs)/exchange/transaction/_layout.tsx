import { Stack } from 'expo-router';

export default function TransactionLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="[transactionId]" />
        </Stack>
    );
}

