import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerInputProgress } from '../contracts/ownerUxContracts';

export function inputStatusLabel(item: Pick<OwnerInputProgress,
    'presentationState' | 'retryState' | 'safeCode'>): string {
    if (item.retryState === 'server_retrying') return 'Trying again';
    if (item.retryState === 'new_upload_required') {
        return item.safeCode === 'P9_VISION_OVER_LIMIT'
            ? 'More than 15 books were visible. Take a new photo or add the book manually.'
            : 'Image needs attention. Select a new image.';
    }
    return {
        checking_image: 'Checking image',
        finding_books: 'Finding books',
        ready: 'Image processed',
        needs_attention: 'Image needs attention',
    }[item.presentationState] ?? 'Image status unavailable';
}

export function PostScanInputList({
    items,
    removeTarget,
    isOffline,
    sessionActive,
    removePending,
    onBeginRemove,
    onConfirmRemove,
    onCancelRemove,
}: {
    items: OwnerInputProgress[];
    removeTarget: { inputId: string; ordinal: number; inputVersion: number } | null;
    isOffline: boolean;
    sessionActive: boolean;
    removePending: boolean;
    onBeginRemove: (target: { inputId: string; ordinal: number; inputVersion: number }) => void;
    onConfirmRemove: () => void;
    onCancelRemove: () => void;
}) {
    const { colors } = useTheme();
    if (items.length === 0) {
        return <Text selectable style={{ color: colors.textSecondary }}>No registered image yet.</Text>;
    }
    return (
        <View style={{ gap: 8 }}>
            <Text selectable style={{ color: colors.textPrimary, fontWeight: '800' }}>Scan image</Text>
            {items.map((item) => (
                <View key={item.inputId} accessibilityLabel={`Image ${item.ordinal}. ${inputStatusLabel(item)}`} style={{
                    gap: 5,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    backgroundColor: colors.bgSecondary,
                }}>
                    <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Image {item.ordinal}</Text>
                    <Text selectable style={{ color: colors.textSecondary }}>{inputStatusLabel(item)}</Text>
                    {removeTarget?.inputId === item.inputId ? (
                        <View style={{ gap: 8, paddingTop: 7 }}>
                            <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Remove Image {item.ordinal}?</Text>
                            <Text selectable style={{ color: colors.textSecondary }}>
                                This removes the image from this scan, cancels its processing, and schedules private media cleanup.
                            </Text>
                            <Button title="Remove image now" onPress={onConfirmRemove}
                                disabled={isOffline || removePending || !sessionActive} />
                            <Button title="Cancel" variant="secondary" onPress={onCancelRemove}
                                disabled={removePending} />
                        </View>
                    ) : item.acceptedCandidateCount === 0 ? (
                        <Button title="Remove image" variant="secondary" style={{ marginTop: 5 }}
                            onPress={() => onBeginRemove(item)}
                            disabled={isOffline || removePending || !sessionActive}
                            accessibilityHint="Removes this uploaded image after confirmation" />
                    ) : (
                        <Text selectable style={{ color: colors.textSecondary, paddingTop: 5 }}>
                            Review the books found from this image instead of removing it.
                        </Text>
                    )}
                </View>
            ))}
        </View>
    );
}
