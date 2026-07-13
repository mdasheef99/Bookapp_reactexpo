import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
    notificationKeys,
    useArchiveNotification,
    useMarkNotificationRead,
    useNotificationPreferences,
    useNotifications,
    useUpsertNotificationPreference,
} from '../useNotifications';
import { notificationsService } from '../../services/notificationsService';

jest.mock('../../services/notificationsService', () => ({
    notificationsService: {
        archive: jest.fn(),
        getNotifications: jest.fn(),
        getPreferences: jest.fn(),
        markRead: jest.fn(),
        upsertPreference: jest.fn(),
    },
}));

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });
}

function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

describe('useNotifications hooks', () => {
    beforeAll(() => {
        notifyManager.setNotifyFunction((callback) => {
            act(callback);
        });
    });

    afterAll(() => {
        notifyManager.setNotifyFunction((callback) => {
            callback();
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches the current user notification inbox', async () => {
        const queryClient = createQueryClient();
        const rows = [{ id: 'delivery-1', title: 'Welcome' }];
        (notificationsService.getNotifications as jest.Mock).mockResolvedValue(rows);

        const { result } = renderHook(() => useNotifications('user-1'), {
            wrapper: createWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.data).toEqual(rows));
        expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-1');
    });

    it('does not fetch notifications without a user id', () => {
        const queryClient = createQueryClient();

        renderHook(() => useNotifications(null), {
            wrapper: createWrapper(queryClient),
        });

        expect(notificationsService.getNotifications).not.toHaveBeenCalled();
    });

    it('fetches notification preferences for the current user', async () => {
        const queryClient = createQueryClient();
        const rows = [{ id: 'pref-1', preference_key: 'clubs', channel: 'push', enabled: true }];
        (notificationsService.getPreferences as jest.Mock).mockResolvedValue(rows);

        const { result } = renderHook(() => useNotificationPreferences('user-1'), {
            wrapper: createWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.data).toEqual(rows));
        expect(notificationsService.getPreferences).toHaveBeenCalledWith('user-1');
    });

    it('invalidates the inbox after marking a notification read', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (notificationsService.markRead as jest.Mock).mockResolvedValue({ id: 'delivery-1' });

        const { result } = renderHook(() => useMarkNotificationRead('user-1'), {
            wrapper: createWrapper(queryClient),
        });

        await act(async () => {
            await result.current.mutateAsync('delivery-1');
        });

        expect(notificationsService.markRead).toHaveBeenCalledWith('delivery-1');
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: notificationKeys.inbox('user-1') });
    });

    it('invalidates the inbox after archiving a notification', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (notificationsService.archive as jest.Mock).mockResolvedValue({ id: 'delivery-1' });

        const { result } = renderHook(() => useArchiveNotification('user-1'), {
            wrapper: createWrapper(queryClient),
        });

        await act(async () => {
            await result.current.mutateAsync('delivery-1');
        });

        expect(notificationsService.archive).toHaveBeenCalledWith('delivery-1');
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: notificationKeys.inbox('user-1') });
    });

    it('invalidates preferences after updating one setting', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (notificationsService.upsertPreference as jest.Mock).mockResolvedValue({ id: 'pref-1' });

        const { result } = renderHook(() => useUpsertNotificationPreference('user-1'), {
            wrapper: createWrapper(queryClient),
        });

        await act(async () => {
            await result.current.mutateAsync({
                user_id: 'user-1',
                preference_key: 'clubs',
                channel: 'push',
                enabled: false,
            });
        });

        expect(notificationsService.upsertPreference).toHaveBeenCalledWith({
            user_id: 'user-1',
            preference_key: 'clubs',
            channel: 'push',
            enabled: false,
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: notificationKeys.preferences('user-1') });
    });
});
