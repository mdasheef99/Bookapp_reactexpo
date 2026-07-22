import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import RootLayout from '../_layout';

jest.mock('../../global.css', () => ({}));

const mockReplace = jest.fn();
const mockInitialize = jest.fn();
const mockSignOut = jest.fn();
const mockRetryBlockedSessionTransition = jest.fn();
let mockSegments: string[] = [];
let mockAuthState = {
    session: null as { user: { id: string } } | null,
    isLoading: false,
    initialize: mockInitialize,
    signOut: mockSignOut,
};
let mockAuthStatus = 'unauthenticated';
let mockInitializationError: { message: string } | null = null;

jest.mock('expo-router', () => ({
    Slot: () => null,
    useRouter: () => ({ replace: mockReplace }),
    useSegments: () => mockSegments,
}));

jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => mockAuthState,
}));
jest.mock('@/features/auth/store/authStore', () => ({
    useAuthStatus: () => mockAuthStatus,
    useAuthInitializationError: () => mockInitializationError,
}));
jest.mock('@/application/auth/AuthBootstrapOwner', () => ({
    AuthBootstrapOwner: () => null,
}));
jest.mock('@/application/auth/sessionCoordinator', () => ({
    retryBlockedSessionTransition: () => mockRetryBlockedSessionTransition(),
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
            signOut: mockSignOut,
        };
        mockAuthStatus = 'unauthenticated';
        mockInitializationError = null;
        delete process.env.EXPO_PUBLIC_DEV_SKIP_AUTH;
    });

    it('allows authenticated users to stay on setup-profile after OTP', async () => {
        mockSegments = ['(auth)', 'setup-profile'];
        mockAuthState = {
            session: { user: { id: 'user-1' } },
            isLoading: false,
            initialize: mockInitialize,
            signOut: mockSignOut,
        };

        render(<RootLayout />);

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects authenticated users away from other auth screens', async () => {
        mockSegments = ['(auth)', 'login'];
        mockAuthState = {
            session: { user: { id: 'user-1' } },
            isLoading: false,
            initialize: mockInitialize,
            signOut: mockSignOut,
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
            signOut: mockSignOut,
        };

        render(<RootLayout />);

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('shows a recoverable initialization error instead of routing as a guest', async () => {
        mockAuthStatus = 'initialization-error';
        mockInitializationError = { message: 'Unable to restore your session. Please try again.' };

        const { getByText } = render(<RootLayout />);
        expect(getByText('We could not restore your session')).toBeOnTheScreen();
        expect(mockReplace).not.toHaveBeenCalled();

        fireEvent.press(getByText('Try again'));
        await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
    });

    it('keeps cleanup failure blocked and exposes a reachable retry action', async () => {
        mockAuthStatus = 'session-cleanup-error';
        mockInitializationError = { message: 'Unable to safely switch accounts. Please try again.' };

        const { getByText } = render(<RootLayout />);
        expect(getByText('We could not safely switch accounts')).toBeOnTheScreen();
        expect(mockReplace).not.toHaveBeenCalled();

        fireEvent.press(getByText('Try again'));
        await waitFor(() => expect(mockRetryBlockedSessionTransition).toHaveBeenCalledTimes(1));
    });

    it('keeps incomplete logout blocked and retries local session deletion', async () => {
        mockAuthStatus = 'logout-error';
        mockInitializationError = { message: 'Sign out is incomplete. Please try again.' };

        const { getByText } = render(<RootLayout />);
        expect(getByText('We could not finish signing out')).toBeOnTheScreen();
        expect(mockReplace).not.toHaveBeenCalled();

        fireEvent.press(getByText('Try again'));
        await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    });

    it('contains a rejected logout retry on the recoverable error screen', async () => {
        mockAuthStatus = 'logout-error';
        mockInitializationError = { message: 'Sign out is incomplete. Please try again.' };
        mockSignOut.mockRejectedValueOnce(new Error('storage failed again'));

        const { getByText } = render(<RootLayout />);
        fireEvent.press(getByText('Try again'));

        await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
        expect(getByText('We could not finish signing out')).toBeOnTheScreen();
    });

    it('contains a rejected cleanup retry on the recoverable error screen', async () => {
        mockAuthStatus = 'session-cleanup-error';
        mockInitializationError = { message: 'Unable to safely switch accounts. Please try again.' };
        mockRetryBlockedSessionTransition.mockRejectedValueOnce(new Error('cleanup failed again'));

        const { getByText } = render(<RootLayout />);
        fireEvent.press(getByText('Try again'));

        await waitFor(() => expect(mockRetryBlockedSessionTransition).toHaveBeenCalledTimes(1));
        expect(getByText('We could not safely switch accounts')).toBeOnTheScreen();
    });
});
