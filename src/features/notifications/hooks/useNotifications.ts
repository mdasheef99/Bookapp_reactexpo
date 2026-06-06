import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notificationsService';
import type { NotificationPreference } from '../types';

export const notificationKeys = {
    all: ['notifications'] as const,
    inbox: (userId: string) => [...notificationKeys.all, 'inbox', userId] as const,
    preferences: (userId: string) => [...notificationKeys.all, 'preferences', userId] as const,
};

export function useNotifications(userId?: string | null) {
    return useQuery({
        queryKey: notificationKeys.inbox(userId ?? 'anonymous'),
        queryFn: () => notificationsService.getNotifications(userId as string),
        enabled: Boolean(userId),
    });
}

export function useNotificationPreferences(userId?: string | null) {
    return useQuery({
        queryKey: notificationKeys.preferences(userId ?? 'anonymous'),
        queryFn: () => notificationsService.getPreferences(userId as string),
        enabled: Boolean(userId),
    });
}

export function useMarkNotificationRead(userId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (deliveryId: string) => notificationsService.markRead(deliveryId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.inbox(userId) }),
    });
}

export function useArchiveNotification(userId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (deliveryId: string) => notificationsService.archive(deliveryId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.inbox(userId) }),
    });
}

export function useUpsertNotificationPreference(userId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (
            input: Pick<NotificationPreference, 'user_id' | 'preference_key' | 'channel' | 'enabled'>,
        ) => notificationsService.upsertPreference(input),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.preferences(userId) }),
    });
}
