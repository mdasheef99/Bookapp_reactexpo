jest.mock('@/lib/supabase');
jest.mock('expo-notifications');

import { supabase } from '@/lib/supabase';
import * as ExpoNotifications from 'expo-notifications';
import { notificationsService } from '../notificationsService';

function mockQuery(response: Record<string, unknown>) {
    const builder: any = {};
    [
        'select',
        'insert',
        'update',
        'delete',
        'upsert',
        'eq',
        'is',
        'order',
        'single',
    ].forEach(method => {
        builder[method] = jest.fn(() => builder);
    });
    builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve(response));
    return builder;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('notificationsService', () => {
    it('fetches non-archived notifications newest first', async () => {
        const notifications = [
            {
                id: 'delivery-1',
                recipient_user_id: 'user-1',
                title: 'Exchange approved',
                read_at: null,
                archived_at: null,
            },
        ];
        const builder = mockQuery({ data: notifications, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await notificationsService.getNotifications('user-1');

        expect(supabase.from).toHaveBeenCalledWith('notification_deliveries');
        expect(builder.select).toHaveBeenCalledWith('*');
        expect(builder.eq).toHaveBeenCalledWith('recipient_user_id', 'user-1');
        expect(builder.is).toHaveBeenCalledWith('archived_at', null);
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(result).toEqual(notifications);
    });

    it('marks one notification read through the RPC', async () => {
        const saved = { id: 'delivery-1', read_at: '2026-06-06T09:00:00.000Z' };
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: saved, error: null });

        const result = await notificationsService.markRead('delivery-1');

        expect(supabase.rpc).toHaveBeenCalledWith('mark_notification_read', {
            p_delivery_id: 'delivery-1',
        });
        expect(result).toEqual(saved);
    });

    it('marks all notifications read through the RPC', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: 3, error: null });

        const result = await notificationsService.markAllRead();

        expect(supabase.rpc).toHaveBeenCalledWith('mark_all_notifications_read');
        expect(result).toBe(3);
    });

    it('archives one notification through the RPC', async () => {
        const saved = { id: 'delivery-1', archived_at: '2026-06-06T09:00:00.000Z' };
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: saved, error: null });

        const result = await notificationsService.archive('delivery-1');

        expect(supabase.rpc).toHaveBeenCalledWith('archive_notification', {
            p_delivery_id: 'delivery-1',
        });
        expect(result).toEqual(saved);
    });

    it('fetches notification preferences by user and key order', async () => {
        const preferences = [{ id: 'pref-1', preference_key: 'clubs', channel: 'push', enabled: true }];
        const builder = mockQuery({ data: preferences, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await notificationsService.getPreferences('user-1');

        expect(supabase.from).toHaveBeenCalledWith('notification_preferences');
        expect(builder.select).toHaveBeenCalledWith('*');
        expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(builder.order).toHaveBeenCalledWith('preference_key', { ascending: true });
        expect(result).toEqual(preferences);
    });

    it('upserts one notification preference by user key and channel', async () => {
        const saved = {
            id: 'pref-1',
            user_id: 'user-1',
            preference_key: 'clubs',
            channel: 'push',
            enabled: false,
        };
        const builder = mockQuery({ data: saved, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await notificationsService.upsertPreference({
            user_id: 'user-1',
            preference_key: 'clubs',
            channel: 'push',
            enabled: false,
        });

        expect(supabase.from).toHaveBeenCalledWith('notification_preferences');
        expect(builder.upsert).toHaveBeenCalledWith({
            user_id: 'user-1',
            preference_key: 'clubs',
            channel: 'push',
            enabled: false,
        }, { onConflict: 'user_id,preference_key,channel' });
        expect(builder.select).toHaveBeenCalledWith('*');
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(saved);
    });

    it('registers an Expo push token and reactivates an existing token', async () => {
        const saved = {
            id: 'token-1',
            user_id: 'user-1',
            token: 'ExponentPushToken[test]',
            platform: 'android',
            provider: 'expo',
            revoked_at: null,
        };
        const builder = mockQuery({ data: saved, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await notificationsService.registerPushToken({
            userId: 'user-1',
            token: 'ExponentPushToken[test]',
            platform: 'android',
            deviceId: 'device-1',
        });

        expect(supabase.from).toHaveBeenCalledWith('user_push_tokens');
        expect(builder.upsert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'user-1',
            token: 'ExponentPushToken[test]',
            platform: 'android',
            device_id: 'device-1',
            provider: 'expo',
            revoked_at: null,
        }), { onConflict: 'token' });
        expect(builder.select).toHaveBeenCalledWith('*');
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(saved);
    });

    it('requests permission, reads an Expo push token, and stores it', async () => {
        const saved = {
            id: 'token-1',
            user_id: 'user-1',
            token: 'ExponentPushToken[test]',
            platform: 'ios',
        };
        const builder = mockQuery({ data: saved, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);
        (ExpoNotifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
        (ExpoNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
        (ExpoNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({ data: 'ExponentPushToken[test]' });

        const result = await notificationsService.requestAndRegisterPushToken({
            userId: 'user-1',
            platform: 'ios',
            deviceId: 'device-1',
            projectId: 'project-1',
        });

        expect(ExpoNotifications.requestPermissionsAsync).toHaveBeenCalled();
        expect(ExpoNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
        expect(builder.upsert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'user-1',
            token: 'ExponentPushToken[test]',
            platform: 'ios',
        }), { onConflict: 'token' });
        expect(result).toEqual(saved);
    });

    it('does not request an Expo push token when permission is denied', async () => {
        (ExpoNotifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
        (ExpoNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });

        const result = await notificationsService.requestAndRegisterPushToken({
            userId: 'user-1',
            platform: 'android',
        });

        expect(ExpoNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
        expect(supabase.from).not.toHaveBeenCalledWith('user_push_tokens');
        expect(result).toBeNull();
    });
});
