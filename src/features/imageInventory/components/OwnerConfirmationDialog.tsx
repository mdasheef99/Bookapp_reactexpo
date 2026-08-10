import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
    AccessibilityInfo,
    findNodeHandle,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function OwnerConfirmationDialog({
    visible,
    title,
    description,
    confirmLabel,
    pending = false,
    onConfirm,
    onCancel,
    restoreFocusRef,
}: {
    visible: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    pending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    restoreFocusRef?: RefObject<View | null>;
}) {
    const { colors } = useTheme();
    const webDescriptionProps: { 'aria-describedby': string } = {
        'aria-describedby': 'owner-confirmation-description',
    };
    const cancelRef = useRef<View>(null);
    const focusTarget = useCallback((target: View | null | undefined) => {
        if (!target) return;
        if (Platform.OS === 'web') {
            target.focus?.();
            return;
        }
        const handle = findNodeHandle(target);
        if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
    }, []);
    const cancel = () => {
        if (pending) return;
        onCancel();
        queueMicrotask(() => focusTarget(restoreFocusRef?.current));
    };
    useEffect(() => {
        if (visible) queueMicrotask(() => focusTarget(cancelRef.current));
    }, [focusTarget, visible]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={cancel}
            accessibilityViewIsModal
        >
            <Pressable
                testID="confirmation-backdrop"
                accessible={false}
                onPress={cancel}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}
            >
                <Pressable
                    testID="confirmation-dialog"
                    role="alertdialog"
                    accessibilityLabel={title}
                    accessibilityHint={description}
                    aria-labelledby="owner-confirmation-title"
                    {...webDescriptionProps}
                    accessibilityViewIsModal
                    onAccessibilityEscape={cancel}
                    onPress={(event) => event.stopPropagation()}
                    style={{ alignSelf: 'center', width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: colors.bgCard, borderRadius: 18, padding: 20, gap: 14 }}
                >
                    <ScrollView style={[{ flexShrink: 1 }]} contentContainerStyle={{ gap: 14 }}>
                        <Text nativeID="owner-confirmation-title" selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 21, fontWeight: '800', flexShrink: 1 }}>
                            {title}
                        </Text>
                        <Text nativeID="owner-confirmation-description" selectable style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 23, flexShrink: 1, writingDirection: 'auto' }}>
                            {description}
                        </Text>
                        {pending ? (
                            <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.textSecondary }}>
                                Confirming…
                            </Text>
                        ) : null}
                    </ScrollView>
                    <View testID="confirmation-actions" style={{ gap: 10, flexShrink: 0 }}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            accessibilityState={{ disabled: pending }}
                            disabled={pending}
                            onPress={cancel}
                            ref={cancelRef}
                            style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={confirmLabel}
                            accessibilityHint={description}
                            accessibilityState={{ disabled: pending, busy: pending }}
                            disabled={pending}
                            onPress={onConfirm}
                            style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: pending ? colors.border : colors.error }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '800' }}>{confirmLabel}</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
