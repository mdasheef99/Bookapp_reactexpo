import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export interface ManageTab {
    key: string;
    label: string;
}

interface ManageTabBarProps {
    tabs: ManageTab[];
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function ManageTabBar({ tabs, activeTab, onTabChange }: ManageTabBarProps) {
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { borderBottomColor: colors.border }]}>
            <View style={styles.tabRow}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            onPress={() => onTabChange(tab.key)}
                            style={[
                                styles.tabButton,
                                isActive && { backgroundColor: colors.accent },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                                ]}
                                numberOfLines={1}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderBottomWidth: 1,
        marginBottom: 14,
    },
    tabRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingBottom: 12,
    },
    tabButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
