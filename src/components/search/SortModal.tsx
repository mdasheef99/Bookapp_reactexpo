import { View, Text, TouchableOpacity, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { SORT_OPTIONS, SortOption } from '@/lib/constants';

interface SortModalProps {
    visible: boolean;
    onClose: () => void;
    currentSort: SortOption;
    onSelect: (sort: SortOption) => void;
}

export const SortModal = ({ visible, onClose, currentSort, onSelect }: SortModalProps) => {
    const { colors } = useTheme();
    return (
    <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
    >
        <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={onClose}
        >
            <View style={{
                backgroundColor: colors.bgCard,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                paddingBottom: 40,
            }}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2 }} />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
                    Sort Results
                </Text>
                {SORT_OPTIONS.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onSelect(option.value);
                            onClose();
                        }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 14,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            backgroundColor: currentSort === option.value ? colors.accent + '20' : 'transparent',
                        }}
                    >
                        <Ionicons
                            name={option.icon as any}
                            size={20}
                            color={currentSort === option.value ? colors.accent : colors.textSecondary}
                        />
                        <Text style={{
                            color: currentSort === option.value ? colors.accent : colors.textPrimary,
                            fontSize: 16,
                            fontWeight: currentSort === option.value ? '600' : '500',
                            marginLeft: 12,
                            flex: 1,
                        }}>
                            {option.label}
                        </Text>
                        {currentSort === option.value && (
                            <Ionicons name="checkmark" size={20} color={colors.accent} />
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </Pressable>
    </Modal>
);
};
