import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import ExchangeScreen from '../index';
import CreateListingScreen from '../create';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaType: { Images: 'Images' },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#818CF8',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
}));
jest.mock('@tanstack/react-query', () => ({
    useQuery: jest.fn(),
}));
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: {
        getProfile: jest.fn(),
    },
}));
jest.mock('@/features/books/services/booksService', () => ({
    booksService: {
        getUserLibrary: jest.fn(),
    },
}));
jest.mock('@/features/exchange/hooks/useListings', () => ({
    useBrowseListings: jest.fn(() => ({
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
    })),
    useCreateListing: jest.fn(() => ({
        mutate: jest.fn(),
        isPending: false,
    })),
}));

describe('exchange delivery capabilities', () => {
    const mockBrowseListings = jest.requireMock('@/features/exchange/hooks/useListings').useBrowseListings as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockBrowseListings.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
            isRefetching: false,
        });
        (useQuery as jest.Mock).mockImplementation(({ queryKey }) => {
            if (queryKey[0] === 'profile') {
                return { data: { city: 'Delhi' }, isLoading: false, isError: false };
            }
            if (queryKey[0] === 'library') {
                return {
                    data: [
                        {
                            id: 'user-book-1',
                            book: { id: 'book-1', title: 'Atomic Habits', cover_url: null },
                        },
                    ],
                    isLoading: false,
                    isError: false,
                };
            }
            return { data: undefined, isLoading: false, isError: false };
        });
    });

    it('hides unsupported shipping delivery filters on the exchange browse screen', () => {
        const { getByText, queryByText } = render(<ExchangeScreen />);

        expect(getByText(/Meetup/)).toBeOnTheScreen();
        expect(queryByText(/Porter/)).toBeNull();
        expect(queryByText(/Dunzo/)).toBeNull();
    });

    it('hides listings that do not have any enabled delivery method', () => {
        mockBrowseListings.mockReturnValue({
            data: [
                {
                    id: 'listing-meetup',
                    condition: 'good',
                    delivery_options: ['meetup', 'porter'],
                    photos: [],
                    book: { title: 'Requestable Book', authors: ['Reader One'], cover_url: null },
                },
                {
                    id: 'listing-porter',
                    condition: 'good',
                    delivery_options: ['porter'],
                    photos: [],
                    book: { title: 'Shipping Only Book', authors: ['Reader Two'], cover_url: null },
                },
            ],
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
            isRefetching: false,
        });

        const { getByText, queryByText } = render(<ExchangeScreen />);

        expect(getByText('Requestable Book')).toBeOnTheScreen();
        expect(queryByText('Shipping Only Book')).toBeNull();
        expect(queryByText(/Porter/)).toBeNull();
    });

    it('only offers supported delivery methods when creating a listing', () => {
        const { getByText, queryByText } = render(<CreateListingScreen />);

        expect(getByText(/Meetup/)).toBeOnTheScreen();
        expect(queryByText(/Porter/)).toBeNull();
        expect(queryByText(/Dunzo/)).toBeNull();
    });
});
