import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { StoreViewDetail } from '../contracts/storeViewContracts';

type Capability = StoreViewDetail['capabilities'][number];
type PublicationAction = 'publish' | 'pause' | 'republish' | 'make_private' | 'retry_publication';

const publicationActions: readonly { capability: PublicationAction; label: string; testID: string }[] = [
    { capability: 'publish', label: 'Publish', testID: 'store-view-publish' },
    { capability: 'pause', label: 'Pause', testID: 'store-view-pause' },
    { capability: 'republish', label: 'Republish', testID: 'store-view-republish' },
    { capability: 'make_private', label: 'Make Private', testID: 'store-view-make-private' },
    { capability: 'retry_publication', label: 'Retry publication', testID: 'store-view-retry-publication' },
];

function Action({ testID, label, disabled, primary = false, onPress }: {
    testID: string; label: string; disabled: boolean; primary?: boolean; onPress: () => void;
}) {
    const { colors } = useTheme();
    return (
        <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 44, borderRadius: 10, borderWidth: primary ? 0 : 1, borderColor: colors.border, backgroundColor: primary ? colors.accent : 'transparent', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
            <Text style={{ color: primary ? '#fff' : colors.textPrimary, fontWeight: '800' }}>{label}</Text>
        </Pressable>
    );
}

export function StoreViewActions({ capabilities, disabled, onEdit, onStock, onPublication }: {
    capabilities: readonly Capability[]; disabled: boolean; onEdit: () => void;
    onStock: () => void; onPublication: (action: PublicationAction) => void;
}) {
    const allowed = new Set(capabilities);
    return (
        <View style={{ gap: 10 }}>
            {allowed.has('edit_details') ? <Action testID="store-view-edit" label="Edit" primary disabled={disabled} onPress={onEdit} /> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {allowed.has('adjust_stock') ? <Action testID="store-view-adjust-stock" label="Adjust Stock" disabled={disabled} onPress={onStock} /> : null}
                {publicationActions.filter(({ capability }) => allowed.has(capability)).map(({ capability, label, testID }) => (
                    <Action key={capability} testID={testID} label={label} disabled={disabled} onPress={() => onPublication(capability)} />
                ))}
            </View>
        </View>
    );
}
