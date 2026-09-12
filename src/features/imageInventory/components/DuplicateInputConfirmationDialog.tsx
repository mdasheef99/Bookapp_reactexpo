import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';

export function DuplicateInputConfirmationDialog({
    visible, pending, onDismiss, onCancelUpload, onProceed,
}: {
    visible: boolean;
    pending: boolean;
    onDismiss: () => void;
    onCancelUpload: () => void;
    onProceed: () => void;
}) {
    const { colors } = useTheme();
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}
            accessibilityViewIsModal>
            <Pressable testID="duplicate-confirmation-backdrop" accessible={false}
                onPress={pending ? undefined : onDismiss}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
                <Pressable role="alertdialog" accessibilityLabel="Duplicate image"
                    onPress={(event) => event.stopPropagation()}
                    style={{ alignSelf: 'center', width: '100%', maxWidth: 560,
                        backgroundColor: colors.bgCard, borderRadius: 18, padding: 20, gap: 14 }}>
                    <Text selectable accessibilityRole="header"
                        style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 20 }}>Duplicate image</Text>
                    <Text selectable style={{ color: colors.textSecondary }}>
                        Continue with this upload? Proceed analyzes this new upload and creates its own book candidates.
                    </Text>
                    <Button title="Proceed" onPress={onProceed} disabled={pending} />
                    <Button title="Cancel upload" variant="secondary" onPress={onCancelUpload} disabled={pending} />
                    <Button title="Not now" variant="secondary" onPress={onDismiss} disabled={pending} />
                </Pressable>
            </Pressable>
        </Modal>
    );
}
