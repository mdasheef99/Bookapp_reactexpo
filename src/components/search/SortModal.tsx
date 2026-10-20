import { View, Text, TouchableOpacity, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';
import { SORT_OPTIONS, SortOption } from '@/lib/constants';

interface SortModalProps {
    visible: boolean;
    onClose: () => void;
    currentSort: SortOption;
    onSelect: (sort: SortOption) => void;
}

export const SortModal = ({ visible, onClose, currentSort, onSelect }: SortModalProps) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
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
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 20,
                paddingBottom: 40,
            }}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2 }} />
                </View>
                <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontFamily: fonts.heading, marginBottom: 16 }}>
                    Sort results
                </Text>
                {SORT_OPTIONS.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onSelect(option.value);
                            onClose();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort by ${option.label}`}
                        accessibilityState={{ selected: currentSort === option.value }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            minHeight: 48,
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
                            fontFamily: currentSort === option.value ? fonts.label : fonts.body,
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
