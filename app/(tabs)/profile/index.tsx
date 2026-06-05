import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { creditService } from '@/features/credits/services/creditService';
import { profileService, type UserMembershipTier } from '@/features/auth/services/profileService';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { router } from 'expo-router';

function formatTier(tier?: UserMembershipTier | null) {
    if (tier === 'pro_plus') return 'Pro+';
    if (tier === 'pro') return 'Pro';
    return 'Free';
}

function canCreateClub(tier?: UserMembershipTier | null) {
    return tier === 'pro' || tier === 'pro_plus';
}

export default function ProfileScreen() {
    const { signOut, session } = useAuth();
    const { colors } = useTheme();
    const userId = session?.user?.id ?? null;

    const userPhone = session?.user?.phone || 'Not available';

    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['profile', userId],
        queryFn: () => profileService.getProfile(userId!),
        enabled: !!userId,
        staleTime: 60_000,
    });

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
                        {profile?.avatar_url ? (
                            <Image
                                source={{ uri: profile.avatar_url }}
                                style={styles.avatarImage}
                                contentFit="cover"
                                accessibilityLabel="User avatar"
                                testID="profile-avatar-image"
                            />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                                <Ionicons name="person" size={40} color="#FFFFFF" accessibilityLabel="User avatar" />
                            </View>
                        )}
                    </View>

                    {/* User Info */}
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {profileLoading ? 'Loading profile...' : profile?.display_name ?? 'My Profile'}
                    </Text>
                    {profile?.username ? (
                        <Text style={[styles.username, { color: colors.textTertiary }]}>@{profile.username}</Text>
                    ) : null}
                    <Text style={[styles.phone, { color: colors.textSecondary }]}>{userPhone}</Text>
                    <View style={styles.profileMetaRow}>
                        {profile?.city ? (
                            <View style={[styles.profilePill, { borderColor: colors.border, backgroundColor: colors.bgSecondary }]}>
                                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.profilePillText, { color: colors.textSecondary }]}>{profile.city}</Text>
                            </View>
                        ) : null}
                        <View style={[styles.profilePill, { borderColor: colors.border, backgroundColor: colors.bgSecondary }]}>
                            <Ionicons name="star-outline" size={14} color={colors.textSecondary} />
                            <Text style={[styles.profilePillText, { color: colors.textSecondary }]}>{formatTier(profile?.membership_tier)}</Text>
                        </View>
                        {typeof profile?.trust_score === 'number' ? (
                            <View style={[styles.profilePill, { borderColor: colors.border, backgroundColor: colors.bgSecondary }]}>
                                <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.profilePillText, { color: colors.textSecondary }]}>
                                    Trust {Number(profile.trust_score).toFixed(1)}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <Button
                        title="Edit Profile"
                        onPress={() => router.push('/(tabs)/profile/edit')}
                        variant="secondary"
                        size="sm"
                        style={styles.editProfileButton}
                    />
                </GlassCard>

                {/* Credit Balance Card */}
                <GlassCard style={{ marginTop: 8 }} padding={24} borderRadius={24}>
                    <View style={styles.sectionTitleRow}>
                        <Ionicons name="wallet" size={20} color={colors.textPrimary} style={{ marginRight: 8 }} accessibilityLabel="Credits" />
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Credits</Text>
                    </View>
                    {creditLoading ? (
                        <View style={styles.creditLoadingRow}>
                            {[0, 1, 2, 3].map(i => (
                                <View key={i} style={[styles.creditSkeleton, { backgroundColor: colors.bgSecondary }]} />
                            ))}
                        </View>
                    ) : balance ? (
                        <>
                            {/* Available — prominent */}
                            <View style={[styles.creditAvailableRow, { borderBottomColor: colors.border }]}>
                                <Text style={styles.creditAvailableValue}>{balance.available}</Text>
                                <Text style={[styles.creditAvailableLabel, { color: colors.textSecondary }]}>available credits</Text>
                            </View>
                            {/* Secondary stats */}
                            <View style={styles.creditStatsRow}>
                                <View style={styles.creditStat}>
                                    <Text style={[styles.creditStatValue, { color: colors.textPrimary }]}>{balance.held}</Text>
                                    <Text style={[styles.creditStatLabel, { color: colors.textSecondary }]}>On Hold</Text>
                                </View>
                                <View style={[styles.creditStatDivider, { backgroundColor: colors.border }]} />
                                <View style={styles.creditStat}>
                                    <Text style={[styles.creditStatValue, { color: colors.textPrimary }]}>{balance.lifetime_earned}</Text>
                                    <Text style={[styles.creditStatLabel, { color: colors.textSecondary }]}>Earned</Text>
                                </View>
                                <View style={[styles.creditStatDivider, { backgroundColor: colors.border }]} />
                                <View style={styles.creditStat}>
                                    <Text style={[styles.creditStatValue, { color: colors.textPrimary }]}>{balance.lifetime_spent}</Text>
                                    <Text style={[styles.creditStatLabel, { color: colors.textSecondary }]}>Spent</Text>
                                </View>
                            </View>
                        </>
                    ) : (
                        <Text style={[styles.creditEmpty, { color: colors.textSecondary }]}>No credit balance yet. Complete your first exchange to earn credits!</Text>
                    )}
                    <TouchableOpacity
                        style={styles.creditHistoryButton}
                        onPress={() => router.push('/(tabs)/profile/credit-history')}
                        accessibilityLabel="Credit History"
                        accessibilityHint="View your credit activity history"
                        accessibilityRole="button"
                    >
                        <Text style={styles.creditHistoryText}>View credit history</Text>
                        <Ionicons name="chevron-forward" size={18} color="#84cc16" />
                    </TouchableOpacity>
                </GlassCard>

                {/* Settings Section */}
                <GlassCard style={{ marginTop: 8 }} padding={24} borderRadius={24}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account</Text>

                    {/* Menu Items */}
                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: colors.border }]}
                        onPress={() => router.push('/(tabs)/library')}
                        accessibilityLabel="My Books"
                        accessibilityHint="Navigate to your book library"
                        accessibilityRole="button"
                    >
                        <Ionicons name="library-outline" size={24} color={colors.textPrimary} style={styles.menuIconGraphic} />
                        <Text style={[styles.menuText, { color: colors.textPrimary }]}>My Books</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: colors.border }]}
                        onPress={() => router.push('/(tabs)/exchange/my-transactions')}
                        accessibilityLabel="Exchange History"
                        accessibilityHint="Navigate to your exchange history"
                        accessibilityRole="button"
                    >
                        <Ionicons name="swap-horizontal-outline" size={24} color={colors.textPrimary} style={styles.menuIconGraphic} />
                        <Text style={[styles.menuText, { color: colors.textPrimary }]}>Exchange History</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: colors.border }]}
                        onPress={() => router.push('/(tabs)/clubs')}
                        accessibilityLabel="My Clubs"
                        accessibilityHint="Navigate to your clubs"
                        accessibilityRole="button"
                    >
                        <Ionicons name="people-outline" size={24} color={colors.textPrimary} style={styles.menuIconGraphic} />
                        <Text style={[styles.menuText, { color: colors.textPrimary }]}>My Clubs</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>

                    {canCreateClub(profile?.membership_tier) ? (
                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomColor: colors.border }]}
                            onPress={() => router.push('/(tabs)/clubs/create')}
                            accessibilityLabel="Create Club"
                            accessibilityHint="Create and manage a new book club"
                            accessibilityRole="button"
                        >
                            <Ionicons name="people-circle-outline" size={24} color={colors.textPrimary} style={styles.menuIconGraphic} />
                            <Text style={[styles.menuText, { color: colors.textPrimary }]}>Create Club</Text>
                            <Text style={styles.menuArrow}>→</Text>
                        </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: colors.border }]}
                        onPress={() => router.push('/(tabs)/profile/addresses')}
                        accessibilityLabel="Addresses"
                        accessibilityHint="Manage saved exchange addresses"
                        accessibilityRole="button"
                    >
                        <Ionicons name="home-outline" size={24} color={colors.textPrimary} style={styles.menuIconGraphic} />
                        <Text style={[styles.menuText, { color: colors.textPrimary }]}>Addresses</Text>
                        <Text style={styles.menuArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: colors.border }]}
                        onPress={() => router.push('/(tabs)/profile/settings')}
                        accessibilityLabel="Settings"
                        accessibilityHint="Open account settings"
                        accessibilityRole="button"
                    >
                        <Ionicons name="settings-outline" size={24} color={colors.textPrimary} style={styles.menuIconGraphic} />
                        <Text style={[styles.menuText, { color: colors.textPrimary }]}>Settings</Text>
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
                    <Text style={[styles.appInfoText, { color: colors.textSecondary }]}>BookTalks v1.0.0</Text>
                    <Text style={[styles.appInfoText, { color: colors.textSecondary }]}>Where Books Keep Moving Forward</Text>
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
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
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
        marginBottom: 8,
    },
    username: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
    },
    phone: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    profileMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
    },
    profilePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    profilePillText: {
        fontSize: 12,
        fontWeight: '700',
    },
    editProfileButton: {
        marginTop: 18,
        alignSelf: 'center',
        maxWidth: 180,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    menuIcon: {
        fontSize: 24,
        marginRight: 16,
    },
    menuIconGraphic: {
        marginRight: 16,
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
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
        borderRadius: 12,
    },
    creditAvailableRow: {
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
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
    },
    creditStatLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
    },
    creditStatDivider: {
        width: 1,
        height: 40,
    },
    creditEmpty: {
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 16,
        lineHeight: 20,
    },
    creditHistoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingTop: 18,
        marginTop: 4,
    },
    creditHistoryText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#84cc16',
    },
});
