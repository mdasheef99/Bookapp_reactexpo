import React, { forwardRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { styles, usePrototypeText, useWebFocus } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';

interface Props {
    label: string;
    accessibleName?: string;
    colors: Appearance;
    onPress: () => void;
    primaryInk?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}
export const TextButton = forwardRef<View, Props>(function TextButton({ label, accessibleName, colors, onPress, primaryInk, disabled = false, style }, ref) {
    const text = usePrototypeText();
    const { focusStyle, ...focusProps } = useWebFocus(colors);
    return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={accessibleName ?? label}
        disabled={disabled} aria-disabled={disabled} accessibilityState={{ disabled }}
        {...focusProps} onPress={disabled ? undefined : onPress} style={[styles.textButton, style, disabled && styles.disabled, focusStyle]}>
        <Text style={[text.label, { color: primaryInk ? colors.textPrimary : colors.textSecondary }]}>{label}</Text>
    </Pressable>;
});
