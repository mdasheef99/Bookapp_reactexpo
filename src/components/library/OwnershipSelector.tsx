import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export type Ownership = 'owned' | 'lent_out' | 'borrowed' | 'wishlist';

interface OwnershipSelectorProps {
    ownership: Ownership;
    onChange: (val: Ownership) => void;
    disabled?: boolean;
}

export const OwnershipSelector = ({ ownership, onChange, disabled }: OwnershipSelectorProps) => {
    const { colors } = useTheme();

    const options: { value: Ownership; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { value: 'owned', label: 'Owned', icon: 'home-outline' },
        { value: 'lent_out', label: 'Lent Out', icon: 'arrow-redo-outline' },
        { value: 'borrowed', label: 'Borrowed', icon: 'arrow-undo-outline' },
        { value: 'wishlist', label: 'Wishlist', icon: 'heart-outline' },
    ];

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Ownership</Text>
            <View style={styles.badgeContainer}>
                {options.map((option) => {
                    const isSelected = ownership === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            disabled={disabled}
                            style={[
                                styles.badge,
                                {
                                    backgroundColor: isSelected ? colors.accent + '20' : colors.bgSecondary,
                                    borderColor: isSelected ? colors.accent : 'transparent',
                                    borderWidth: 1,
                                },
                            ]}
                        >
                            <Ionicons
                                name={option.icon}
                                size={14}
                                color={isSelected ? colors.accent : colors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.badgeText,
                                    {
                                        color: isSelected ? colors.accent : colors.textSecondary,
                                        fontWeight: isSelected ? '600' : '400',
                                    },
                                ]}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    badgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
    },
    badgeText: {
        fontSize: 12,
        marginLeft: 4,
    },
});
