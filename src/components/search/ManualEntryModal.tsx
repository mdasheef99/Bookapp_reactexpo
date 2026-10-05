import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

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
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();

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
                        backgroundColor: 'rgba(32, 26, 19, 0.42)',
                }}
            >
                <View
                    style={{
                        backgroundColor: colors.bgCard,
                        borderRadius: 18,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 23, fontFamily: fonts.heading }}>
                        Add book manually
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8, fontFamily: fonts.body }}>
                        Add a basic library entry when search doesn't return the title you need.
                    </Text>

                    <View style={{ marginTop: 18 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.label, marginBottom: 8 }}>
                            Title
                        </Text>
                        <TextInput
                            testID="library-manual-entry-title"
                            accessibilityLabel="Book title"
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
                                fontFamily: fonts.body,
                            }}
                        />
                    </View>

                    <View style={{ marginTop: 14 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.label, marginBottom: 8 }}>
                            Author (optional)
                        </Text>
                        <TextInput
                            testID="library-manual-entry-author"
                            accessibilityLabel="Book author, optional"
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
                                fontFamily: fonts.body,
                            }}
                        />
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 22, gap: 12 }}>
                        <TouchableOpacity
                            testID="library-manual-entry-cancel"
                            onPress={onCancel}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel manual book entry"
                            style={{
                                flex: 1,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 14,
                            minHeight: 44,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.bgPrimary,
                            }}
                        >
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.label }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            testID="library-manual-entry-save"
                            onPress={onSave}
                            disabled={submitting}
                            accessibilityRole="button"
                            accessibilityLabel={submitting ? 'Saving book to library' : 'Save book to library'}
                            accessibilityState={{ disabled: submitting }}
                            style={{
                                flex: 1,
                                borderRadius: 14,
                            minHeight: 44,
                                alignItems: 'center',
                            justifyContent: 'center',
                                backgroundColor: submitting ? colors.textTertiary : colors.accent,
                            }}
                        >
                            <Text style={{ color: colors.onAccent, fontSize: 14, fontFamily: fonts.label }}>
                                {submitting ? 'Saving...' : 'Save to library'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
