import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RootLayout from '../_layout';

jest.mock('../../global.css', () => ({}));

const mockReplace = jest.fn();
const mockInitialize = jest.fn();
let mockSegments: string[] = [];
let mockAuthState = {
    session: null as { user: { id: string } } | null,
    isLoading: false,
    initialize: mockInitialize,
};

jest.mock('expo-router', () => ({
    Slot: () => null,
    useRouter: () => ({ replace: mockReplace }),
    useSegments: () => mockSegments,
}));

jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => mockAuthState,
}));

jest.mock('@/components/ui/AtmosphericBackground', () => ({
    AtmosphericBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/sentry', () => ({
    initSentry: jest.fn(),
    syncSentryUser: jest.fn(),
    trackSentryRoute: jest.fn(),
    maybeSendSentryVerificationEvent: jest.fn(),
    Sentry: {
        ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        wrap: (Component: React.ComponentType) => Component,
    },
}));

describe('Root auth routing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSegments = [];
        mockAuthState = {
            session: null,
            isLoading: false,
            initialize: mockInitialize,
        };
        delete process.env.EXPO_PUBLIC_DEV_SKIP_AUTH;
    });

    it('allows authenticated users to stay on setup-profile after OTP', async () => {
        mockSegments = ['(auth)', 'setup-profile'];
        mockAuthState = {
            session: { user: { id: 'user-1' } },
            isLoading: false,
            initialize: mockInitialize,
        };

        render(<RootLayout />);

        await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects authenticated users away from other auth screens', async () => {
        mockSegments = ['(auth)', 'login'];
        mockAuthState = {
            session: { user: { id: 'user-1' } },
            isLoading: false,
            initialize: mockInitialize,
        };

        render(<RootLayout />);

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/library'));
    });

    it('allows authenticated users to stay in the Store Owner route group', async () => {
        mockSegments = ['(store-owner)'];
        mockAuthState = {
            session: { user: { id: 'user-1' } },
            isLoading: false,
            initialize: mockInitialize,
        };

        render(<RootLayout />);

        await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
        expect(mockReplace).not.toHaveBeenCalled();
    });
});
