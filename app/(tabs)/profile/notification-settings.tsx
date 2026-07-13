import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    useNotificationPreferences,
    useUpsertNotificationPreference,
} from '@/features/notifications/hooks/useNotifications';
import type { NotificationChannel } from '@/features/notifications/types';
import { useTheme } from '@/hooks/useTheme';

const PREFERENCE_GROUPS = [
    { key: 'transaction', label: 'Exchange updates', critical: true },
    { key: 'safety', label: 'Safety and moderation', critical: true },
    { key: 'clubs', label: 'Club activity', critical: false },
    { key: 'events', label: 'Club events', critical: false },
    { key: 'discussion', label: 'Discussion replies and mentions', critical: false },
    { key: 'wishlist', label: 'Wishlist matches', critical: false },
    { key: 'reminders', label: 'Reminders', critical: false },
    { key: 'credits', label: 'Credit updates', critical: false },
    { key: 'marketing', label: 'Product announcements', critical: false },
];

const CHANNELS: Array<{ key: NotificationChannel; label: string }> = [
    { key: 'in_app', label: 'In-app' },
    { key: 'push', label: 'Push' },
];

export default function NotificationSettingsScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();
    const userId = session?.user?.id ?? null;
    const { data: preferences = [] } = useNotificationPreferences(userId);
    const upsertPreference = useUpsertNotificationPreference(userId ?? 'anonymous');

    const isEnabled = (preferenceKey: string, channel: NotificationChannel, critical: boolean) => {
        if (critical) return true;
        const preference = preferences.find(item => item.preference_key === preferenceKey && item.channel === channel);
        return preference?.enabled ?? true;
    };

    const togglePreference = (
        preferenceKey: string,
        channel: NotificationChannel,
        enabled: boolean,
    ) => {
        if (!userId) return;
        upsertPreference.mutate({
            user_id: userId,
            preference_key: preferenceKey,
            channel,
            enabled,
        });
    };

    return (
        <ScreenBackground>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.replace('/(tabs)/profile/settings')}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notification Settings</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {!userId ? (
                    <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                        <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text>
                        <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>
                            Notification preferences are saved to your account. Sign in before changing optional updates.
                        </Text>
                    </View>
                ) : null}

                {PREFERENCE_GROUPS.map(group => (
                    <View key={group.key} style={[styles.preferenceCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <View style={styles.preferenceHeader}>
                            <View style={styles.preferenceTitleBlock}>
                                <Text style={[styles.preferenceTitle, { color: colors.textPrimary }]}>{group.label}</Text>
                                <Text style={[styles.preferenceBody, { color: colors.textSecondary }]}>
                                    {group.critical ? 'Required for account, safety, and exchange integrity.' : 'Optional updates you can adjust anytime.'}
                                </Text>
                            </View>
                            {group.critical ? (
                                <Text style={[styles.alwaysOnBadge, { color: colors.accent, borderColor: colors.accent }]}>Always on</Text>
                            ) : null}
                        </View>

                        {CHANNELS.map(channel => (
                            <View key={`${group.key}-${channel.key}`} style={styles.channelRow}>
                                <Text style={[styles.channelLabel, { color: colors.textPrimary }]}>{channel.label}</Text>
                                <Switch
                                    value={isEnabled(group.key, channel.key, group.critical)}
                                    disabled={group.critical || !userId}
                                    onValueChange={(enabled) => togglePreference(group.key, channel.key, enabled)}
                                    accessibilityLabel={`${isEnabled(group.key, channel.key, group.critical) ? 'Disable' : 'Enable'} ${channel.label.toLowerCase()} notifications for ${group.label}`}
                                />
                            </View>
                        ))}
                    </View>
                ))}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 40,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 40,
    },
    preferenceCard: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 16,
        gap: 12,
    },
    noticeCard: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 14,
        gap: 4,
    },
    noticeTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    noticeBody: {
        fontSize: 13,
        lineHeight: 18,
    },
    preferenceHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    preferenceTitleBlock: {
        flex: 1,
        gap: 4,
    },
    preferenceTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    preferenceBody: {
        fontSize: 13,
        lineHeight: 18,
    },
    alwaysOnBadge: {
        borderWidth: 1,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: '700',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    channelRow: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    channelLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
});
