import { Pressable, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function ReviewToggle({
    label,
    selected,
    onPress,
    hint,
    testID,
    disabled = false,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
    hint?: string;
    testID?: string;
    disabled?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityHint={hint}
            disabled={disabled}
            onPress={onPress}
            testID={testID}
            style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.border,
                borderRadius: 12,
                backgroundColor: colors.bgCard,
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <Text selectable style={{ color: colors.textPrimary }}>
                {selected ? '✓ ' : ''}{label}
            </Text>
        </Pressable>
    );
}

export function ReviewFieldError({ message }: { message?: string }) {
    const { colors } = useTheme();
    return message ? (
        <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
            {message}
        </Text>
    ) : null;
}

export function ReviewAction({
    label,
    onPress,
    disabled,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={{ minHeight: 44, justifyContent: 'center' }}
        >
            <Text selectable style={{ color: disabled ? colors.textTertiary : colors.accent, fontWeight: '700' }}>
                {label}
            </Text>
        </Pressable>
    );
}
