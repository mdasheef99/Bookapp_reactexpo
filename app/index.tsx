import { Redirect } from 'expo-router';
import { Text, View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function Index() {
    const { session, isLoading } = useAuth();

    // In dev bypass mode with mock session, redirect immediately
    if (process.env.EXPO_PUBLIC_DEV_SKIP_AUTH === 'true') {
        return <Redirect href="/(tabs)/library" />;
    }

    // Show loading while checking auth
    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // If authenticated, go to library
    if (session) {
        return <Redirect href="/(tabs)/library" />;
    }

    // If not authenticated, go to login
    return <Redirect href="/(auth)/login" />;
}
