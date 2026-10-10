import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function sourceBadgeLabel(code: string): string {
    if (code === 'matched') return 'Detected';
    if (code === 'representative') return 'Representative edition';
    if (code === 'detected') return 'Detected';
    if (code === 'default') return 'Default';
    if (code === 'custom') return 'Custom';
    return 'Missing';
}

export function SourceBadge({ code, local = false, testID }: {
    code: string;
    local?: boolean;
    testID?: string;
}) {
    const { colors } = useTheme();
    const label = local ? 'Custom' : sourceBadgeLabel(code);
    return (
        <Text selectable testID={testID} accessibilityLabel={`Source ${label}`} style={{
            color: local ? colors.accent : colors.textTertiary,
            fontSize: 10,
            fontWeight: '700',
            borderWidth: 1,
            borderColor: local ? colors.accentLight : colors.border,
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 1,
            overflow: 'hidden',
        }}>
            {label}
        </Text>
    );
}

export function FieldSummary({
    label, value, sourceCode, local, testSuffix, compact = false, error, onPress, disabled,
}: {
    label: string;
    value: string;
    sourceCode: string | null;
    local?: boolean;
    testSuffix: string;
    compact?: boolean;
    error?: boolean;
    onPress?: () => void;
    disabled?: boolean;
}) {
    const { colors } = useTheme();
    const summaryStyle = {
        flexGrow: compact ? 1 : 0,
        flexBasis: compact ? 104 : 'auto' as const,
        gap: 5,
        paddingVertical: compact ? 10 : 7,
        borderWidth: compact || error ? 1 : 0,
        borderColor: error ? colors.error : colors.border,
        borderRadius: compact || error ? 10 : 0,
        paddingHorizontal: compact || error ? 8 : 0,
        backgroundColor: error ? colors.bgSecondary : 'transparent',
    } as const;
    const content = (
        <View style={summaryStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text selectable style={{ color: error ? colors.error : colors.textPrimary, fontWeight: compact ? '700' : '600', flexShrink: 1 }}>
                    {label}: {value}
                </Text>
            </View>
            {local ? (
                <View style={{ alignSelf: 'flex-start' }}>
                    <SourceBadge code="custom" local testID={`card-${testSuffix}-overlay`} />
                </View>
            ) : sourceCode ? <View style={{ alignSelf: 'flex-start' }}><SourceBadge code={sourceCode} /></View> : null}
        </View>
    );
    if (!onPress) return content;
    return (
        <Pressable
            testID={`card-${testSuffix}-field`}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${label}`}
            onPress={onPress}
            disabled={disabled}
            style={{ flexGrow: compact ? 1 : 0, flexBasis: compact ? 104 : 'auto' }}
        >
            {content}
        </Pressable>
    );
}
