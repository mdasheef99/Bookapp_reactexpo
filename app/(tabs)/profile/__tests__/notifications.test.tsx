import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NotificationsScreen from '../notifications';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockMarkRead = jest.fn();
const mockArchive = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({
    router: {
        push: (...args: unknown[]) => mockPush(...args),
        replace: (...args: unknown[]) => mockReplace(...args),
    },
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/notifications/hooks/useNotifications', () => ({
    useArchiveNotification: () => ({ mutate: mockArchive }),
    useMarkNotificationRead: () => ({ mutateAsync: mockMarkRead }),
    useNotifications: () => ({
        isLoading: false,
        data: [
            {
                id: 'delivery-1',
                event_id: 'event-1',
                recipient_user_id: 'reader-1',
                category: 'transaction',
                channel: 'in_app',
                title: 'Exchange approved',
                body: 'Your book exchange was approved.',
                deep_link: '/(tabs)/exchange/transaction/txn-1',
                status: 'pending',
                provider_message_id: null,
                error_code: null,
                error_message: null,
                sent_at: null,
                read_at: null,
                archived_at: null,
                created_at: '2026-06-06T09:00:00.000Z',
                updated_at: '2026-06-06T09:00:00.000Z',
            },
        ],
    }),
}));

describe('NotificationsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMarkRead.mockResolvedValue({ id: 'delivery-1' });
    });

    it('renders the notification inbox and opens a deep link', async () => {
        const { getByText } = render(<NotificationsScreen />);

        expect(getByText('Exchange approved')).toBeOnTheScreen();
        expect(getByText('Your book exchange was approved.')).toBeOnTheScreen();

        fireEvent.press(getByText('Exchange approved'));

        await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith({
            id: 'delivery-1',
            source: 'legacy',
        }));
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/exchange/transaction/txn-1');
    });
});
