import React, { useId, useRef } from 'react';
import { Modal, Platform, View, Text } from 'react-native';
import { styles, usePrototypeText } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';
import { TextButton } from './TextButton';
import { PrimaryButton } from './PrimaryButton';

export function RemoveDialog({ title: bookTitle, colors, onClose }: { title: string; colors: Appearance; onClose: () => void }) {
    const text = usePrototypeText();
    const cancel = useRef<View>(null);
    const descriptionId = useId();
    const title = `Remove “${bookTitle}” from your library?`;
    const description = "Your notes, review and saved pages for this book will be deleted too. You can't undo this.";
    // RN-web Modal supplies a focus trap, aria-modal and restoration; focus Cancel
    // explicitly after mounting. The screen also restores the Remove trigger.
    return <Modal visible transparent animationType="none" accessible role="dialog" aria-modal accessibilityViewIsModal
        testID="fa-dialog" accessibilityLabel={Platform.OS === 'web' ? title : `${title} ${description}`}
        aria-describedby={descriptionId} onRequestClose={onClose} onShow={() => cancel.current?.focus()}>
        <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
                <Text style={[text.heading, { color: colors.textPrimary }]}>{title}</Text>
                <Text nativeID={descriptionId} style={[text.body, { color: colors.textSecondary }]}>{description}</Text>
                <View style={styles.dialogButtons}>
                    <TextButton ref={cancel} label="Cancel" colors={colors} onPress={onClose} />
                    <PrimaryButton label="Remove book" colors={colors} destructive onPress={onClose} />
                </View>
            </View>
        </View>
    </Modal>;
}
