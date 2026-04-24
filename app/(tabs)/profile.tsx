import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { creditService } from '@/features/credits/services/creditService';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { router } from 'expo-router';

export default function ProfileScreen() {
    const { signOut, session } = useAuth();
    const { colors } = useTheme();
    const userId = session?.user?.id ?? null;

    const userPhone = session?.user?.phone || 'Not available';

    const { data: balance, isLoading: creditLoading } = useQuery({
        queryKey: ['creditBalance', userId],
        queryFn: () => creditService.getCreditBalance(userId!),
        enabled: !!userId,
        staleTime: 60_000,
    });

    return (
        <ScreenBackground>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header Card */}
                <GlassCard padding={24} borderRadius={24}>
                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                            <Ionicons name="person" size={40} color="#FFFFFF" accessibilityLabel="User avatar" />
                        </View>
                    </View>

                    {/* User Info */}
                    <Text style={[styles.title, { color: colors.textPrimary }]}>My Profile</Text>
                    <Text style={[styles.phone, { color: colors.textSecondary }]}>{userPhone}</Text>
                </GlassCard>

                {/* Credit Balance Card */}
                <GlassCard style={{ marginTop: 8 }} padding={24} borderRadius={24}>
                    <View style={styles.sectionTitleRow}>
                        <Ionicons name="wallet" size={20} color={colors.textPrimary} style={{ marginRight: 8 }} accessibilityLabel="Credits" />
                        <Text style={styles.sectionTitle}>Credits</Text>
                    </View>
                    {creditLoading ? (
                        <View style={styles.creditLoadingRow}>
                            {[0, 1, 2, 3].map(i => (
                                <View key={i} style={styles.creditSkeleton} />
                            ))}
                        </View>
                    ) : balance ? (
                        <>
                            {/* Available — prominent */}
                            <View style={styles.creditAvailableRow}>
                                <Text style={styles.creditAvailableValue}>{balance.available}</Text>
                                <Text style={styles.creditAvailableLabel}>available credits</Text>
                            </View>
                            {/* Secondary stats */}
                            <View style={styles.creditStatsRow}>
                                <View style={styles.creditStat}>
                                    <Text style={styles.creditStatValue}>{balance.held}</Text>
                                    <Text style={styles.creditStatLabel}>On Hold</Text>
                                </View>
                                <View style={styles.creditStatDivider} />
                                <View style={styles.creditStat}>
                                    <Text style={styles.creditStatValue}>{balance.lifetime_earned}</Text>
                                    <Text style={styles.creditStatLabel}>Earned</Text>
                                </View>
                                <View style={styles.creditStatDivider} />
                                <View style={styles.creditStat}>
                                    <Text style={styles.creditStatValue}>{balance.lifetime_spent}</Text>
                                    <Text style={styles.creditStatLabel}>Spent</Text>
                                </View>
                            </View>
                        </>
                    ) : (
                        <Text style={styles.creditEmpty}>No credit balance yet. Complete your first exchange to earn credits!</Text>
                    )}
                </GlassCard>

                {/* Settings Section */}
                <GlassCard style={{ marginTop: 8 }} padding={24} borderRadius={24}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    {/* Menu Items */}
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/(tabs)/library')}
                        accessibilityLabel="My Books"
                        accessibilityHint="Navigate to your book library"
                        accessibilityRole="button"
                    >
                        <Text style={styles.menuIcon}>📖</Text>
                        <Text style={styles.menuText}>My Books</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/(tabs)/exchange')}
                        accessibilityLabel="Exchange History"
                        accessibilityHint="Navigate to your exchange history"
                        accessibilityRole="button"
                    >
                        <Text style={styles.menuIcon}>🔄</Text>
                        <Text style={styles.menuText}>Exchange History</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/(tabs)/clubs')}
                        accessibilityLabel="My Clubs"
                        accessibilityHint="Navigate to your clubs"
                        accessibilityRole="button"
                    >
                        <Text style={styles.menuIcon}>👥</Text>
                        <Text style={styles.menuText}>My Clubs</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        accessibilityLabel="Settings"
                        accessibilityHint="Settings screen coming soon"
                        accessibilityRole="button"
                    >
                        <Text style={styles.menuIcon}>⚙️</Text>
                        <Text style={styles.menuText}>Settings</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>
                </GlassCard>

                {/* Sign Out Button */}
                <Button
                    title="Sign Out"
                    onPress={signOut}
                    variant="danger"
                    size="lg"
                    accessibilityLabel="Sign out of your account"
                />

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoText}>BookTalks v1.0.0</Text>
                    <Text style={styles.appInfoText}>Where Books Keep Moving Forward</Text>
                </View>
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
        paddingTop: 60,
        paddingBottom: 40,
    },

    avatarContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#84cc16',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        color: '#1A1A1A',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    phone: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        color: '#666666',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 16,
        letterSpacing: -0.3,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    menuIcon: {
        fontSize: 24,
        marginRight: 16,
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    menuArrow: {
        fontSize: 20,
        color: '#84cc16',
        fontWeight: 'bold',
    },
    signOutButton: {
        marginTop: 24,
        marginBottom: 24,
    },
    signOutGradient: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#E85D5D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    signOutText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    appInfo: {
        alignItems: 'center',
        marginTop: 8,
    },
    appInfoText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#666666',
        marginBottom: 4,
    },
    // ── Credit Balance Card ────────────────────────────────────────────────────
    creditLoadingRow: {
        flexDirection: 'row',
        gap: 12,
    },
    creditSkeleton: {
        flex: 1,
        height: 60,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
    },
    creditAvailableRow: {
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    creditAvailableValue: {
        fontSize: 48,
        fontWeight: '800',
        color: '#84cc16',
        letterSpacing: -1,
    },
    creditAvailableLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666666',
        marginTop: 4,
    },
    creditStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 16,
    },
    creditStat: {
        flex: 1,
        alignItems: 'center',
    },
    creditStatValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    creditStatLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#666666',
        marginTop: 4,
    },
    creditStatDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    creditEmpty: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        paddingVertical: 16,
        lineHeight: 20,
    },
});
