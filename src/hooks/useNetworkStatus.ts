import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

// Web-compatible network status hook
export const useNetworkStatus = () => {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);

    useEffect(() => {
        // For web platform, use navigator.onLine
        if (Platform.OS === 'web') {
            const handleOnline = () => setIsConnected(true);
            const handleOffline = () => setIsConnected(false);

            // Set initial value
            setIsConnected(typeof navigator !== 'undefined' ? navigator.onLine : true);

            // Add event listeners
            if (typeof window !== 'undefined') {
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
