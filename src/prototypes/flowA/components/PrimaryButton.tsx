import React from 'react';
import { Pressable, Text } from 'react-native';
import { styles, usePrototypeText, useWebFocus } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';

export function PrimaryButton({ label, colors, onPress, destructive = false, disabled = false }: {
    label: string; colors: Appearance; onPress: () => void; destructive?: boolean; disabled?: boolean;
}) {
    const text = usePrototypeText();
    const { focusStyle, ...focusProps } = useWebFocus(colors);
    return <Pressable testID="fa-primary" accessibilityRole="button" accessibilityLabel={label}
        disabled={disabled} aria-disabled={disabled} accessibilityState={{ disabled }} {...focusProps}
        onPress={disabled ? undefined : onPress}
        style={[styles.button, { backgroundColor: destructive ? colors.error : colors.accent }, disabled && styles.disabled, focusStyle]}>
        <Text style={[text.label, { color: destructive ? colors.onErrorSurface : colors.textOnAccent }]}>{label}</Text>
    </Pressable>;
}
