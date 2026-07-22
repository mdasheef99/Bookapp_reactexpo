import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthInitializationError, useAuthStatus } from '@/features/auth/store/authStore';
import { AuthBootstrapOwner } from '@/application/auth/AuthBootstrapOwner';
import { AtmosphericBackground } from '@/components/ui/AtmosphericBackground';
import { initSentry, syncSentryUser, trackSentryRoute, maybeSendSentryVerificationEvent, Sentry } from '@/lib/sentry';
import '../global.css';
import { appQueryClient } from '@/lib/queryClient';
import { isAuthBypassEnabled } from '@/features/auth/config/authRuntimeConfig';

initSentry();

function InitialLayout() {
    const { session, isLoading, initialize } = useAuth();
    const authStatus = useAuthStatus();
    const initializationError = useAuthInitializationError();
    const segments = useSegments();
    const router = useRouter();

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
        if (isLoading || authStatus === 'initialization-error') return;

        // Development bypass is handled in render
        if (isAuthBypassEnabled) {
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
    }, [session, segments, isLoading, authStatus]);

    // Development bypass: Check this flag even if loading is true
    const isDevBypass = isAuthBypassEnabled;

    if (authStatus === 'initialization-error' && !isDevBypass) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
                    We could not restore your session
                </Text>
                <Text style={{ textAlign: 'center', marginBottom: 16 }}>
                    {initializationError?.message ?? 'Please try again.'}
                </Text>
                <Pressable
                    onPress={() => void initialize()}
                    accessibilityRole="button"
                    accessibilityLabel="Retry session initialization"
                    style={{ paddingHorizontal: 20, paddingVertical: 12 }}
                >
                    <Text style={{ fontWeight: '600' }}>Try again</Text>
                </Pressable>
            </View>
        );
    }

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
                        <AuthBootstrapOwner />
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

