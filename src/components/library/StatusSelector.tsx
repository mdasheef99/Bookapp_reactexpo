import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export type ReadingStatus = 'want_to_read' | 'reading' | 'completed';

interface StatusSelectorProps {
    status: ReadingStatus;
    onChange: (status: ReadingStatus) => void;
    disabled?: boolean;
}

export const StatusSelector = ({ status, onChange, disabled }: StatusSelectorProps) => {
    const { colors } = useTheme();

    const options: { value: ReadingStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { value: 'want_to_read', label: 'Want to Read', icon: 'bookmark-outline' },
        { value: 'reading', label: 'Reading', icon: 'book-outline' },
        { value: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
    ];

    return (
        <View style={styles.container}>
            {options.map((option) => {
                const isSelected = status === option.value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        disabled={disabled}
                        activeOpacity={0.7}
                        style={[
                            styles.option,
                            {
                                backgroundColor: isSelected ? colors.accent : colors.bgCard,
                                borderColor: isSelected ? colors.accent : colors.border,
                            },
                        ]}
                    >
                        <Ionicons
                            name={option.icon}
                            size={18}
                            color={isSelected ? '#FFFFFF' : colors.textSecondary}
                        />
                        <Text
                            style={[
                                styles.label,
                                {
                                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                                    fontWeight: isSelected ? '700' : '500',
                                },
                            ]}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 8,
        marginVertical: 12,
        flexWrap: 'wrap',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    label: {
        fontSize: 13,
        marginLeft: 6,
    },
});
