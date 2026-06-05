import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

// Web-compatible network status hook
export const useNetworkStatus = () => {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);

    useEffect(() => {
        // For web platform, use navigator.onLine
        const hasWindowNetworkEvents = typeof window !== 'undefined' && typeof window.addEventListener === 'function';

        if (Platform.OS === 'web' || hasWindowNetworkEvents) {
            const browserLocation = typeof window !== 'undefined'
                ? window.location
                : typeof globalThis !== 'undefined'
                    ? globalThis.location
                    : undefined;
            const locationText = `${browserLocation?.hostname ?? ''} ${browserLocation?.href ?? ''}`;
            const isLocalPreview = /(^|\s|\/\/)(localhost|127\.0\.0\.1|\[::1\]|::1)(:|\/|\s|$)/.test(locationText);
            const handleOnline = () => setIsConnected(true);
            const handleOffline = () => setIsConnected(isLocalPreview ? true : false);

            // Set initial value
            setIsConnected(isLocalPreview || typeof navigator === 'undefined' ? true : navigator.onLine);

            // Add event listeners
            if (hasWindowNetworkEvents) {
                window.addEventListener('online', handleOnline);
                window.addEventListener('offline', handleOffline);

                return () => {
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                };
            }
        } else {
            // For native platforms, use NetInfo dynamically
            let unsubscribe: (() => void) | undefined;

            (async () => {
                try {
                    const NetInfo = await import('@react-native-community/netinfo');
                    unsubscribe = NetInfo.default.addEventListener((state) => {
                        setIsConnected(state.isConnected);
                    });

                    const initialState = await NetInfo.default.fetch();
                    setIsConnected(initialState.isConnected);
                } catch (err) {
                    console.warn('NetInfo not available:', err);
                    setIsConnected(true); // Assume connected if NetInfo fails
                }
            })();

            return () => {
                if (unsubscribe) unsubscribe();
            };
        }
    }, []);

    return {
        isConnected,
        isOffline: isConnected === false,
    };
};
