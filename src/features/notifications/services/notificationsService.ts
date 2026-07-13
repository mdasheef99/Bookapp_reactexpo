import * as ExpoNotifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import type { NotificationDelivery, NotificationPreference } from '../types';

function notificationPermissionGranted(permission: unknown) {
    if (typeof permission !== 'object' || permission === null) return false;
    const maybePermission = permission as { granted?: unknown; status?: unknown };
    return maybePermission.granted === true || maybePermission.status === 'granted';
}

export const notificationsService = {
    async getNotifications(userId: string): Promise<NotificationDelivery[]> {
        const { data, error } = await supabase
            .from('notification_deliveries')
            .select('*')
            .eq('recipient_user_id', userId)
            .is('archived_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []) as NotificationDelivery[];
    },

    async markRead(deliveryId: string): Promise<NotificationDelivery> {
        const { data, error } = await supabase.rpc('mark_notification_read', {
            p_delivery_id: deliveryId,
        });

        if (error) throw error;
        return data as NotificationDelivery;
    },

    async markAllRead(): Promise<number> {
        const { data, error } = await supabase.rpc('mark_all_notifications_read');

        if (error) throw error;
        return Number(data ?? 0);
    },

    async archive(deliveryId: string): Promise<NotificationDelivery> {
        const { data, error } = await supabase.rpc('archive_notification', {
            p_delivery_id: deliveryId,
        });

        if (error) throw error;
        return data as NotificationDelivery;
    },

    async getPreferences(userId: string): Promise<NotificationPreference[]> {
        const { data, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .order('preference_key', { ascending: true });

        if (error) throw error;
        return (data ?? []) as NotificationPreference[];
    },

    async upsertPreference(
        input: Pick<NotificationPreference, 'user_id' | 'preference_key' | 'channel' | 'enabled'>,
    ): Promise<NotificationPreference> {
        const { data, error } = await supabase
            .from('notification_preferences')
            .upsert(input, { onConflict: 'user_id,preference_key,channel' })
            .select('*')
            .single();

        if (error) throw error;
        return data as NotificationPreference;
    },

    async registerPushToken(input: {
        userId: string;
        token: string;
        platform: 'ios' | 'android' | 'web' | 'unknown';
        deviceId?: string | null;
    }) {
        const { data, error } = await supabase
            .from('user_push_tokens')
            .upsert({
                user_id: input.userId,
                token: input.token,
                platform: input.platform,
                device_id: input.deviceId ?? null,
                provider: 'expo',
                revoked_at: null,
                last_seen_at: new Date().toISOString(),
            }, { onConflict: 'token' })
            .select('*')
            .single();

        if (error) throw error;
        return data;
    },

    async requestAndRegisterPushToken(input: {
        userId: string;
        platform: 'ios' | 'android' | 'web' | 'unknown';
        deviceId?: string | null;
        projectId?: string;
    }) {
        const currentPermission = await ExpoNotifications.getPermissionsAsync();
        const finalPermission = notificationPermissionGranted(currentPermission)
            ? currentPermission
            : await ExpoNotifications.requestPermissionsAsync();

        if (!notificationPermissionGranted(finalPermission)) {
            return null;
        }

        const tokenResult = await ExpoNotifications.getExpoPushTokenAsync(
            input.projectId ? { projectId: input.projectId } : undefined,
        );

        return this.registerPushToken({
            userId: input.userId,
            token: tokenResult.data,
            platform: input.platform,
            deviceId: input.deviceId,
        });
    },
};
