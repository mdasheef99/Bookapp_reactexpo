import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    useArchiveNotification,
    useMarkNotificationRead,
    useNotifications,
} from '@/features/notifications/hooks/useNotifications';
import type { NotificationDelivery } from '@/features/notifications/types';
import { useTheme } from '@/hooks/useTheme';

function formatNotificationTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();
    const userId = session?.user?.id ?? null;
    const { data = [], isLoading } = useNotifications(userId);
    const markRead = useMarkNotificationRead(userId ?? 'anonymous');
    const archive = useArchiveNotification(userId ?? 'anonymous');

    const openNotification = async (item: NotificationDelivery) => {
        if (!item.read_at) {
            await markRead.mutateAsync(item.id);
        }
        if (item.deep_link) {
            router.push(item.deep_link as never);
        }
    };

    const renderItem = ({ item }: { item: NotificationDelivery }) => {
        const isUnread = !item.read_at;

        return (
            <TouchableOpacity
                onPress={() => openNotification(item)}
                style={[styles.notificationRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                accessibilityRole="button"
            >
                <View style={[styles.statusDot, { backgroundColor: isUnread ? colors.accent : colors.border }]} />
                <View style={styles.notificationTextBlock}>
                    <View style={styles.notificationHeader}>
                        <Text style={[styles.notificationTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                        <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>{formatNotificationTime(item.created_at)}</Text>
                    </View>
                    <Text style={[styles.notificationBody, { color: colors.textSecondary }]}>{item.body}</Text>
                    <Text style={[styles.notificationCategory, { color: colors.textTertiary }]}>{item.category}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => archive.mutate(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Archive ${item.title}`}
                    style={styles.archiveButton}
                >
                    <Ionicons name="archive-outline" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenBackground>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.replace('/(tabs)/profile')}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {isLoading ? (
                    <View style={styles.centerState}>
                        <ActivityIndicator color={colors.accent} />
                    </View>
                ) : (
                    <FlatList
                        data={data}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={data.length ? styles.listContent : styles.emptyContent}
                        ListEmptyComponent={(
                            <View style={styles.centerState}>
                                <Ionicons name="notifications-off-outline" size={28} color={colors.textTertiary} />
                                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No notifications</Text>
                                <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>Updates from exchanges, clubs, and reminders will appear here.</Text>
                            </View>
                        )}
                    />
                )}
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 56,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
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
    listContent: {
        gap: 10,
        paddingBottom: 32,
    },
    emptyContent: {
        flexGrow: 1,
    },
    notificationRow: {
        borderWidth: 1,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        gap: 10,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
    },
    notificationTextBlock: {
        flex: 1,
        gap: 4,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    notificationTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
    },
    notificationTime: {
        fontSize: 12,
    },
    notificationBody: {
        fontSize: 13,
        lineHeight: 18,
    },
    notificationCategory: {
        fontSize: 12,
        textTransform: 'capitalize',
    },
    archiveButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 24,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    emptyBody: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
});
