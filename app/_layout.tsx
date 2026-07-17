import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AtmosphericBackground } from '@/components/ui/AtmosphericBackground';
import { initSentry, syncSentryUser, trackSentryRoute, maybeSendSentryVerificationEvent, Sentry } from '@/lib/sentry';
import '../global.css';
import { appQueryClient } from '@/lib/queryClient';

initSentry();

function InitialLayout() {
    const { session, isLoading, initialize } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        initialize();
    }, []);

    useEffect(() => {
        syncSentryUser(session?.user?.id ?? null);
    }, [session?.user?.id]);

    useEffect(() => {
        const route = segments.join('/') || 'index';
        trackSentryRoute(route);
    }, [segments]);

    useEffect(() => {
        maybeSendSentryVerificationEvent();
    }, []);

    useEffect(() => {
        if (isLoading) return;

        // Development bypass is handled in render
        if (process.env.EXPO_PUBLIC_DEV_SKIP_AUTH === 'true') {
            return;
        }

        const inAuthGroup = segments[0] === '(auth)';
        const isSetupProfileRoute = segments.join('/') === '(auth)/setup-profile';

        if (!session && !inAuthGroup) {
            // Redirect to login if not authenticated
            router.replace('/(auth)/login');
        } else if (session && inAuthGroup && !isSetupProfileRoute) {
            // Redirect to tabs if authenticated
            router.replace('/(tabs)/library');
        }
    }, [session, segments, isLoading]);

    // Development bypass: Check this flag even if loading is true
    const isDevBypass = process.env.EXPO_PUBLIC_DEV_SKIP_AUTH === 'true';

    if (isLoading && !isDevBypass) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return <Slot />;
}

function ErrorFallback() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#ffffff' }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#111827' }}>
                Something went wrong
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                The app encountered an unexpected error. Please restart the app.
            </Text>
        </View>
    );
}

function RootLayout() {
    return (
        <Sentry.ErrorBoundary fallback={ErrorFallback}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <QueryClientProvider client={appQueryClient}>
                        <AtmosphericBackground>
                            <InitialLayout />
                        </AtmosphericBackground>
                        <StatusBar style="auto" />
                    </QueryClientProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </Sentry.ErrorBoundary>
    );
}

export default Sentry.wrap(RootLayout);

