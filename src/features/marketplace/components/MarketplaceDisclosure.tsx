import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import {
    AVAILABILITY_DISCLAIMER_MESSAGE,
    CONFIRMATION_BEFORE_PAYMENT_MESSAGE,
    SELLER_STORE_POLICY_MESSAGE,
    SUPPORT_POSITIONING_MESSAGE,
} from '../constants/disclosures';

/**
 * Marketplace disclosure banner shown on the consumer marketplace surface.
 *
 * Displays:
 * - Confirmation-before-payment message
 * - Seller/store policy positioning
 * - BookConnect support/grievance positioning
 */
export function MarketplaceDisclosure() {
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <View style={styles.header}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                <Text style={[styles.headerText, { color: colors.accent }]}>
                    Marketplace
                </Text>
            </View>

            <View style={styles.messageList}>
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {AVAILABILITY_DISCLAIMER_MESSAGE}
                </Text>
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {CONFIRMATION_BEFORE_PAYMENT_MESSAGE}
                </Text>
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {SELLER_STORE_POLICY_MESSAGE}
                </Text>
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {SUPPORT_POSITIONING_MESSAGE}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        gap: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerText: {
        fontSize: 13,
        fontWeight: '700',
    },
    messageList: {
        gap: 4,
    },
    message: {
        fontSize: 11,
        lineHeight: 16,
    },
});
