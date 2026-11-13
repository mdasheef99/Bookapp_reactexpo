import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { StoreViewDetail } from '../contracts/storeViewContracts';

const REASONS: Record<string, { explanation: string; button?: string; action?: 'edit' | 'price' | 'retry' | 'plan' }> = {
    missing_price: { explanation: "Customers can't see this book until it has a price.", button: 'Set price', action: 'price' },
    missing_condition: { explanation: 'Add the condition so customers know what to expect.', button: 'Set condition', action: 'edit' },
    missing_metadata: { explanation: 'Add the missing book details before publishing.', button: 'Add details', action: 'edit' },
    not_sellable: { explanation: 'This book is marked as not sellable.', button: 'Mark as sellable', action: 'edit' },
    damage_evidence_required: { explanation: 'Damage information is incomplete. A damaged book needs a damage note, damage types and 1–3 approved damage photos. After adding photos, update and save the damage details to clear this.', button: 'Add damage details', action: 'edit' },
    publication_failed: { explanation: "This book couldn't be published. Try again.", button: 'Retry', action: 'retry' },
    subscription_restricted: { explanation: 'Your subscription restricts publishing this book.', button: 'View plan', action: 'plan' },
    entitlement_blocked: { explanation: 'Your plan does not currently allow publishing this book.', button: 'View plan', action: 'plan' },
    active_listing_limit_reached: { explanation: 'Your plan has reached its active listing limit.', button: 'View plan', action: 'plan' },
    moderation_blocked: { explanation: 'This book is blocked by moderation.' },
    store_policy_blocked: { explanation: 'Store policy prevents publishing this book.' },
};

export function StoreViewAttentionReasons({ item, busy, onEdit, onRetry }: {
    item: StoreViewDetail; busy: boolean; onEdit: (focusPrice: boolean) => void; onRetry: () => void;
}) {
    const { colors } = useTheme();
    return (
        <View style={{ gap: 12 }}>
            <Text style={{ color: colors.textTertiary, fontWeight: '800' }}>Attention</Text>
            <View testID="store-view-detail-attention" style={{ gap: 12 }}>
                {item.attention.attentionReasons.length === 0 ? <Text style={{ color: colors.textPrimary }}>None</Text> : null}
                {item.attention.attentionReasons.map((reason) => {
                    const row = Object.hasOwn(REASONS, reason) ? REASONS[reason] : { explanation: reason.replaceAll('_', ' ') };
                    const allowed = row.action === 'plan'
                        || (row.action === 'retry' ? item.capabilities.includes('retry_publication')
                            : (row.action === 'edit' || row.action === 'price') && item.capabilities.includes('edit_details'));
                    return (
                        <View key={reason} style={{ gap: 8 }}>
                            <Text selectable style={{ color: colors.textPrimary, lineHeight: 20 }}>{row.explanation}</Text>
                            {row.button && allowed ? (
                                <Pressable
                                    testID={`store-view-fix-${reason}`}
                                    accessibilityRole="button"
                                    disabled={busy}
                                    onPress={() => {
                                        if (busy) return;
                                        if (row.action === 'plan') router.push('/(store-owner)/subscription');
                                        else if (row.action === 'retry') onRetry();
                                        else onEdit(row.action === 'price');
                                    }}
                                    style={{ minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }}
                                >
                                    <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{row.button}</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}
