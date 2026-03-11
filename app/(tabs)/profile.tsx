import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { creditService } from '@/features/credits/services/creditService';

export default function ProfileScreen() {
    const { signOut, session } = useAuth();
    const userId = session?.user?.id ?? null;

    const userPhone = session?.user?.phone || 'Not available';

    const { data: balance, isLoading: creditLoading } = useQuery({
        queryKey: ['creditBalance', userId],
        queryFn: () => creditService.getCreditBalance(userId!),
        enabled: !!userId,
        staleTime: 60_000,
    });

    return (
        <View style={styles.container}>
            {/* Whimsical gradient background */}
            <LinearGradient
                colors={['#d9f99d', '#fef08a', '#bae6fd']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Decorative book elements */}
            <View style={[styles.bookDecor, styles.bookDecor1]} />
            <View style={[styles.bookDecor, styles.bookDecor2]} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header Card */}
                <View style={styles.cardContainer}>
                    {/* Glassmorphism overlay */}
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
                        style={styles.glassOverlay}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />

                    <View style={styles.card}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            <LinearGradient
                                colors={['#84cc16', '#bef264']}
                                style={styles.avatar}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.avatarEmoji}>👤</Text>
                            </LinearGradient>
                        </View>

                        {/* User Info */}
                        <Text style={styles.title}>My Profile</Text>
                        <Text style={styles.phone}>{userPhone}</Text>
                    </View>
                </View>

                {/* Credit Balance Card */}
                <View style={[styles.cardContainer, styles.creditCard]}>
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
                        style={styles.glassOverlay}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>💰 Credits</Text>
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
                    </View>
                </View>

                {/* Settings Section */}
                <View style={[styles.cardContainer, styles.settingsCard]}>
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
                        style={styles.glassOverlay}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />

                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Account</Text>

                        {/* Menu Items */}
                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuIcon}>📖</Text>
                            <Text style={styles.menuText}>My Books</Text>
                            <Text style={styles.menuArrow}>→</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuIcon}>🔄</Text>
                            <Text style={styles.menuText}>Exchange History</Text>
                            <Text style={styles.menuArrow}>→</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuIcon}>👥</Text>
                            <Text style={styles.menuText}>My Clubs</Text>
                            <Text style={styles.menuArrow}>→</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuIcon}>⚙️</Text>
                            <Text style={styles.menuText}>Settings</Text>
                            <Text style={styles.menuArrow}>→</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Sign Out Button */}
                <TouchableOpacity
                    onPress={signOut}
                    activeOpacity={0.85}
                    style={styles.signOutButton}
                >
                    <LinearGradient
                        colors={['#E85D5D', '#F28B8B']}
                        style={styles.signOutGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoText}>BookTalks v1.0.0</Text>
                    <Text style={styles.appInfoText}>Where Books Keep Moving Forward</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    bookDecor: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 8,
        transform: [{ rotate: '-15deg' }],
    },
    bookDecor1: {
        width: 100,
        height: 140,
        top: 80,
        left: -30,
        opacity: 0.4,
    },
    bookDecor2: {
        width: 80,
        height: 110,
        bottom: 120,
        right: -20,
        opacity: 0.3,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 40,
    },
    cardContainer: {
        marginBottom: 16,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    settingsCard: {
        marginTop: 8,
    },
    glassOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    card: {
        padding: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    avatarEmoji: {
        fontSize: 50,
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
    creditCard: {
        marginTop: 8,
    },
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
