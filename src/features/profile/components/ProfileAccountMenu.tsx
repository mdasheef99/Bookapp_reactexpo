import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { UserMembershipTier } from '@/features/auth/services/profileService';

type ThemeColors = {
    border: string;
    textPrimary: string;
};

type MenuItemProps = {
    colors: ThemeColors;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint: string;
    route: string;
};

type ProfileAccountMenuProps = {
    colors: ThemeColors;
    membershipTier?: UserMembershipTier | null;
};

function canCreateClub(tier?: UserMembershipTier | null) {
    return tier === 'pro' || tier === 'pro_plus';
}

function MenuItem({ colors, icon, label, hint, route }: MenuItemProps) {
    return (
        <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push(route)}
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityRole="button"
        >
            <Ionicons name={icon} size={24} color={colors.textPrimary} style={styles.menuIconGraphic} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>{label}</Text>
            <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
    );
}

export function ProfileAccountMenu({ colors, membershipTier }: ProfileAccountMenuProps) {
    return (
        <>
            <MenuItem
                colors={colors}
                icon="library-outline"
                label="My Books"
                hint="Navigate to your book library"
                route="/(tabs)/library"
            />
            <MenuItem
                colors={colors}
                icon="swap-horizontal-outline"
                label="Exchange History"
                hint="Navigate to your exchange history"
                route="/(tabs)/exchange/my-transactions"
            />
            <MenuItem
                colors={colors}
                icon="people-outline"
                label="My Clubs"
                hint="Navigate to your clubs"
                route="/(tabs)/clubs"
            />
            {canCreateClub(membershipTier) ? (
                <MenuItem
                    colors={colors}
                    icon="people-circle-outline"
                    label="Create Club"
                    hint="Create and manage a new book club"
                    route="/(tabs)/clubs/create"
                />
            ) : null}
            <MenuItem
                colors={colors}
                icon="storefront-outline"
                label="Store Owner Console"
                hint="Open bookstore onboarding and Store Owner access"
                route="/(store-owner)"
            />
            <MenuItem
                colors={colors}
                icon="home-outline"
                label="Addresses"
                hint="Manage saved exchange addresses"
                route="/(tabs)/profile/addresses"
            />
            <MenuItem
                colors={colors}
                icon="settings-outline"
                label="Settings"
                hint="Open account settings"
                route="/(tabs)/profile/settings"
            />
        </>
    );
}

const styles = StyleSheet.create({
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
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
});
