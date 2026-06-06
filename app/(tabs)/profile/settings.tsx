import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsScreen() {
    const { signOut, session } = useAuth();
    const { colors } = useTheme();
    const userPhone = session?.user?.phone ?? 'Not available';

    return (
        <ScreenBackground>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.replace('/(tabs)/profile')}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <GlassCard padding={20} borderRadius={20}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account</Text>
                    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                        <Ionicons name="call-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                        <View style={styles.settingTextBlock}>
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Phone</Text>
                            <Text style={[styles.settingValue, { color: colors.textSecondary }]} selectable>{userPhone}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/profile/notifications')}
                        style={[styles.settingRow, { borderBottomColor: colors.border }]}
                        accessibilityRole="button"
                    >
                        <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                        <View style={styles.settingTextBlock}>
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Notifications</Text>
                            <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Review updates, reminders, and account activity.</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/profile/notification-settings')}
                        style={[styles.settingRow, { borderBottomColor: colors.border }]}
                        accessibilityRole="button"
                    >
                        <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                        <View style={styles.settingTextBlock}>
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Notification preferences</Text>
                            <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Choose which non-critical updates can reach you.</Text>
                        </View>
                    </TouchableOpacity>
                </GlassCard>

                <Button
                    title="Sign Out"
                    onPress={signOut}
                    variant="danger"
                    size="lg"
                    accessibilityLabel="Sign out of your account"
                    style={styles.signOutButton}
                />
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
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingVertical: 16,
    },
    settingIcon: {
        marginRight: 14,
    },
    settingTextBlock: {
        flex: 1,
        gap: 4,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '700',
    },
    settingValue: {
        fontSize: 13,
        lineHeight: 18,
    },
    signOutButton: {
        marginTop: 4,
    },
});
