import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, StyleSheet, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { DIALOG_MAX_WIDTH } from '@/components/library/bookDetails/bookDetailsTokens';
import { BookButton, BookFeedbackSlot } from '@/components/library/ui';

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

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}
            {...(Platform.OS === 'web' ? { accessibilityLabel: 'Add book manually' } : {})}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={[styles.scrim, { backgroundColor: colors.overlay }]}>
                <View style={[styles.panel, { backgroundColor: colors.bgRaised, borderColor: colors.controlBorder }]}>
                    <BookFeedbackSlot />
                    <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>Add book manually</Text>
                    <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                        {"Add a basic library entry when search doesn't return the title you need."}
                    </Text>
                    <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>Title</Text>
                    <TextInput testID="library-manual-entry-title" accessibilityLabel="Book title" value={title}
                        onChangeText={onTitleChange} placeholder="Enter the book title" placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]} />
                    <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>Author (optional)</Text>
                    <TextInput testID="library-manual-entry-author" accessibilityLabel="Book author, optional" value={author}
                        onChangeText={onAuthorChange} placeholder="Enter the author name" placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]} />
                    <View style={styles.actions}>
                        <BookButton testID="library-manual-entry-cancel" label="Cancel" variant="secondary" onPress={onCancel} />
                        <BookButton testID="library-manual-entry-save" label={submitting ? 'Saving…' : 'Save to library'} variant="primary" disabled={submitting} onPress={onSave} />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: { flex: 1, justifyContent: 'center', padding: LIBRARY_SPACING.lg },
    panel: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, alignSelf: 'center', padding: LIBRARY_SPACING.lg, borderWidth: 1, borderRadius: LIBRARY_RADIUS.dialog, gap: LIBRARY_SPACING.sm },
    input: { ...LIBRARY_TEXT.body, minHeight: MIN_TARGET, borderWidth: 1, borderRadius: LIBRARY_RADIUS.control, paddingHorizontal: LIBRARY_SPACING.sm, paddingVertical: LIBRARY_SPACING.sm },
    actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: LIBRARY_SPACING.sm, marginTop: LIBRARY_SPACING.xs },
});
