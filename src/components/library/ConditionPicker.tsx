import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLibraryAppearance } from './LibraryAppearance';

export type Condition = 'new' | 'like_new' | 'good' | 'acceptable' | 'poor';

interface ConditionPickerProps {
    condition: Condition;
    onChange: (val: Condition) => void;
    disabled?: boolean;
}

export const ConditionPicker = ({ condition, onChange, disabled }: ConditionPickerProps) => {
    const colors = useLibraryAppearance();

    const levels: { value: Condition; label: string; color: string }[] = [
        { value: 'new', label: 'New', color: colors.chipSelectedBackground },
        { value: 'like_new', label: 'Like New', color: colors.chipSelectedBackground },
        { value: 'good', label: 'Good', color: colors.chipSelectedBackground },
        { value: 'acceptable', label: 'Fair', color: colors.chipSelectedBackground },
        { value: 'poor', label: 'Poor', color: colors.chipSelectedBackground },
    ];

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Condition</Text>
            <View style={styles.pickerContainer}>
                {levels.map((level) => {
                    const isSelected = condition === level.value;
                    return (
                        <TouchableOpacity
                            key={level.value}
                            onPress={() => onChange(level.value)}
                            disabled={disabled}
                            style={[
                                styles.level,
                                {
                                    backgroundColor: isSelected ? level.color : colors.bgSecondary,
                                    borderColor: isSelected ? colors.chipSelectedBackground : colors.controlBorder,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.levelText,
                                    {
                                        color: isSelected ? colors.chipSelectedText : colors.textSecondary,
                                        fontWeight: isSelected ? '700' : '400',
                                    },
                                ]}
                            >
                                {level.label}
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
    pickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    level: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    levelText: {
        fontSize: 12,
    },
});
