import { Stack } from 'expo-router';

export default function ClubsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="[clubId]/index" />
            <Stack.Screen name="[clubId]/applications" />
            <Stack.Screen name="[clubId]/events" />
            <Stack.Screen name="[clubId]/events/create" />
            <Stack.Screen name="[clubId]/events/[eventId]/edit" />
            <Stack.Screen name="[clubId]/invite" />
            <Stack.Screen name="[clubId]/manage" />
            <Stack.Screen name="[clubId]/nominate" />
        </Stack>
    );
}