import React from 'react';
import {
    TouchableOpacity,
    Text,
    View,
    StyleSheet,
    ViewStyle,
    TextStyle,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    testID?: string;
}

const SIZE_HEIGHT: Record<ButtonSize, number> = {
    sm: 40,
    md: 52,
    lg: 60,
};

const SIZE_FONT: Record<ButtonSize, number> = {
    sm: 14,
    md: 16,
    lg: 18,
};

const SIZE_RADIUS: Record<ButtonSize, number> = {
    sm: 12,
    md: 14,
    lg: 16,
};

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    style,
    textStyle,
    accessibilityLabel,
    accessibilityHint,
    testID,
}) => {
    const { colors } = useTheme();
    const isDisabled = disabled || loading;

    const height = SIZE_HEIGHT[size];
    const fontSize = SIZE_FONT[size];
    const borderRadius = SIZE_RADIUS[size];

    const isGradient = variant === 'primary' || variant === 'danger';

    const gradientColors: [string, string] = isDisabled
        ? [colors.disabled, colors.disabledLight]
        : variant === 'danger'
            ? [colors.error, colors.errorLight]
            : [colors.accent, colors.accentLight];

    const containerStyle: ViewStyle = {
        height,
        borderRadius,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: isDisabled ? 0.6 : 1,
        backgroundColor: isGradient
            ? undefined
            : variant === 'secondary'
                ? colors.bgCard
                : 'transparent',
        borderWidth: variant === 'secondary' ? 1.5 : 0,
        borderColor: variant === 'secondary' ? colors.border : undefined,
    };

    const titleColor = isDisabled
        ? '#A0A0A0'
        : variant === 'primary' || variant === 'danger'
            ? '#FFFFFF'
            : variant === 'secondary'
                ? colors.textPrimary
                : colors.accent;

    const content = (
        <>
            {loading && (
                <ActivityIndicator
                    size="small"
                    color={titleColor}
                    style={{ marginRight: 8 }}
                />
            )}
            <Text
                style={[
                    styles.text,
                    { fontSize, color: titleColor },
                    textStyle,
                ]}
            >
                {title}
            </Text>
        </>
    );

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.85}
            style={[styles.wrapper, style]}
            accessibilityLabel={accessibilityLabel ?? title}
            accessibilityHint={accessibilityHint}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled }}
            testID={testID}
        >
            {isGradient ? (
                <LinearGradient
                    colors={gradientColors}
                    style={[styles.gradient, containerStyle]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    {content}
                </LinearGradient>
            ) : (
                <View style={[styles.solid, containerStyle]}>
                    {content}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
    },
    gradient: {
        flexDirection: 'row',
    },
    solid: {
        flexDirection: 'row',
    },
    text: {
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
