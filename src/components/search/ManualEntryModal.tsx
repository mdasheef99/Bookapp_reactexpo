import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type ManualEntryModalProps = {
    visible: boolean;
    title: string;
    author: string;
    submitting: boolean;
    onTitleChange: (title: string) => void;
    onAuthorChange: (author: string) => void;
    onCancel: () => void;
    onSave: () => void;
};

export function ManualEntryModal({
    visible,
    title,
    author,
    submitting,
    onTitleChange,
    onAuthorChange,
    onCancel,
    onSave,
}: ManualEntryModalProps) {
    const { colors } = useTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    padding: 24,
                    backgroundColor: 'rgba(15, 23, 42, 0.45)',
                }}
            >
                <View
                    style={{
                        backgroundColor: colors.bgCard,
                        borderRadius: 24,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
                        Add book manually
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
                        Add a basic library entry when search doesn't return the title you need.
                    </Text>

                    <View style={{ marginTop: 18 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                            Title
                        </Text>
                        <TextInput
                            testID="library-manual-entry-title"
                            value={title}
                            onChangeText={onTitleChange}
                            placeholder="Enter the book title"
                            placeholderTextColor={colors.textTertiary}
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 14,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: colors.textPrimary,
                                backgroundColor: colors.bgPrimary,
                            }}
                        />
                    </View>

                    <View style={{ marginTop: 14 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                            Author (optional)
                        </Text>
                        <TextInput
                            testID="library-manual-entry-author"
                            value={author}
                            onChangeText={onAuthorChange}
                            placeholder="Enter the author name"
                            placeholderTextColor={colors.textTertiary}
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 14,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: colors.textPrimary,
                                backgroundColor: colors.bgPrimary,
                            }}
                        />
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 22, gap: 12 }}>
                        <TouchableOpacity
                            testID="library-manual-entry-cancel"
                            onPress={onCancel}
                            style={{
                                flex: 1,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 14,
                                paddingVertical: 12,
                                alignItems: 'center',
                                backgroundColor: colors.bgPrimary,
                            }}
                        >
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            testID="library-manual-entry-save"
                            onPress={onSave}
                            disabled={submitting}
                            style={{
                                flex: 1,
                                borderRadius: 14,
                                paddingVertical: 12,
                                alignItems: 'center',
                                backgroundColor: submitting ? colors.textTertiary : colors.accent,
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                                {submitting ? 'Saving...' : 'Save to library'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
