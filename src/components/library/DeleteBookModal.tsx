import React, { useRef } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from './LibraryAppearance';
import { LIBRARY_TEXT } from './LibraryTypography';
import { BookButton, BookFeedbackSlot } from './ui';
import { DIALOG_MAX_WIDTH } from './bookDetails/bookDetailsTokens';

const DESCRIPTION_ID = 'delete-book-modal-description';

export interface DeleteBookModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  disabled?: boolean;
  bookTitle: string;
}

export const DeleteBookModal = ({
  visible,
  onClose,
  onConfirm,
  isDeleting,
  disabled = false,
  bookTitle = '',
}: DeleteBookModalProps) => {
  const colors = useLibraryAppearance();
  const cancelRef = useRef<View>(null);
  const title = `Remove “${bookTitle}” from your library?`;
  const description =
    "Your notes, review and saved pages for this book will be deleted too. You can't undo this.";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessible
      role="dialog"
      aria-modal
      accessibilityViewIsModal
      accessibilityLabel={Platform.OS === 'web' ? title : `${title} ${description}`}
      aria-describedby={DESCRIPTION_ID}
      onRequestClose={() => { if (!isDeleting) onClose(); }}
      onShow={() => cancelRef.current?.focus()}
    >
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <View style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
          <BookFeedbackSlot />
          <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Text nativeID={DESCRIPTION_ID} style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
            {description}
          </Text>
          <View style={styles.buttons}>
            <BookButton
              ref={cancelRef}
              label="Cancel"
              variant="secondary"
              disabled={isDeleting}
              onPress={onClose}
            />
            <BookButton
              label={isDeleting ? 'Removing…' : 'Remove book'}
              variant="destructive"
              disabled={isDeleting || disabled}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: LIBRARY_SPACING.md,
  },
  dialog: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    borderRadius: LIBRARY_RADIUS.dialog,
    padding: LIBRARY_SPACING.lg,
    gap: LIBRARY_SPACING.md,
  },
  buttons: {
    gap: LIBRARY_SPACING.xs,
  },
});
