import { Pressable, StyleSheet, Text } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import {
    OwnerInventoryReadError,
} from '../api/ownerInventoryReadService';

export function ownerInventoryErrorCopy(error: OwnerInventoryReadError | null) {
    if (error?.category === 'unauthorized') return {
        title: 'Inventory access unavailable',
        body: 'Active Store Owner access is required. Inventory rows were not shown.',
    };
    if (error?.category === 'invalid_request') return {
        title: 'Inventory filters are invalid',
        body: 'Review the inventory search and filters, then restart from the first page.',
    };
    if (error?.category === 'invalid_cursor') return {
        title: 'Inventory page expired',
        body: 'The page cursor is no longer valid. Restart from the first page.',
    };
    if (error?.category === 'unavailable') return {
        title: 'Inventory temporarily unavailable',
        body: 'The inventory service could not be reached. Your inventory was not treated as empty.',
    };
    if (error?.code === 'P9_RESPONSE_INVALID') return {
        title: 'Inventory response unavailable',
        body: 'The inventory response was invalid.',
    };
    return {
        title: 'Inventory could not be loaded',
        body: 'The inventory service returned an internal error. Your inventory was not treated as empty.',
    };
}

export function OwnerInventoryStateCard({
    title,
    body,
    action,
    actionLabel,
    testID,
}: {
    title: string;
    body: string;
    action?: () => void;
    actionLabel?: string;
    testID?: string;
}) {
    const { colors } = useTheme();
    return (
        <GlassCard padding={18} borderRadius={16}>
            <Text selectable accessibilityRole="header" style={[styles.stateTitle, { color: colors.textPrimary }]}>
                {title}
            </Text>
            <Text selectable style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
            {action && actionLabel ? (
                <Pressable
                    testID={testID}
                    accessibilityRole="button"
                    onPress={action}
                    style={[styles.secondaryAction, { borderColor: colors.border }]}
                >
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{actionLabel}</Text>
                </Pressable>
            ) : null}
        </GlassCard>
    );
}


const styles = StyleSheet.create({
    stateTitle: { fontSize: 18, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 20, marginTop: 8 },
    secondaryAction: {
        minHeight: 42, borderWidth: 1, borderRadius: 8, marginTop: 14,
        alignItems: 'center', justifyContent: 'center',
    },
});
