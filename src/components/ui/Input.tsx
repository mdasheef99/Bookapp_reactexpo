import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    ViewStyle,
    TextStyle,
    KeyboardTypeOptions,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface InputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    label?: string;
    keyboardType?: KeyboardTypeOptions;
    maxLength?: number;
    secureTextEntry?: boolean;
    autoFocus?: boolean;
    disabled?: boolean;
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    testID?: string;
}

export const Input: React.FC<InputProps> = ({
    value,
    onChangeText,
    placeholder,
    label,
    keyboardType = 'default',
    maxLength,
    secureTextEntry = false,
    autoFocus = false,
    disabled = false,
    containerStyle,
    inputStyle,
    leftElement,
    rightElement,
    accessibilityLabel,
    accessibilityHint,
    testID,
}) => {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);

    const borderColor = focused ? colors.accent : colors.border;
    const backgroundColor = focused ? colors.bgCard : colors.bgSecondary;

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {label && (
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {label}
                </Text>
            )}
            <View
                style={[
                    styles.row,
                    {
                        borderColor,
                        backgroundColor,
                        opacity: disabled ? 0.6 : 1,
                    },
                ]}
            >
                {leftElement && (
                    <View style={styles.left}>{leftElement}</View>
                )}
                <TextInput
                    style={[
                        styles.input,
                        { color: colors.textPrimary },
                        inputStyle,
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType={keyboardType}
                    maxLength={maxLength}
                    secureTextEntry={secureTextEntry}
                    autoFocus={autoFocus}
                    editable={!disabled}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    accessibilityLabel={accessibilityLabel ?? label}
                    accessibilityHint={accessibilityHint}
                    testID={testID}
                />
                {rightElement && (
                    <View style={styles.right}>{rightElement}</View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 2,
        paddingHorizontal: 16,
        height: 56,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    left: {
        marginRight: 12,
    },
    right: {
        marginLeft: 12,
    },
});
