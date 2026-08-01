import { useEffect, useRef, type RefObject } from 'react';
import {
    Modal,
    Pressable,
    Text,
    View,
    type TextInput,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type Focusable = Pick<TextInput, 'focus'>;

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
    restoreFocusRef?: RefObject<Focusable | null>;
}) {
    const { colors } = useTheme();
    const confirmRef = useRef<View>(null);
    const restoreFocus = () => restoreFocusRef?.current?.focus?.();
    const cancel = () => {
        if (pending) return;
        onCancel();
        restoreFocus();
    };
    useEffect(() => {
        if (visible) queueMicrotask(() => confirmRef.current?.focus?.());
    }, [visible]);

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
                onPress={() => undefined}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}
            >
                <View
                    testID="confirmation-dialog"
                    accessibilityRole="alert"
                    accessibilityLabel={title}
                    accessibilityHint={description}
                    style={{ backgroundColor: colors.bgCard, borderRadius: 18, padding: 20, gap: 14 }}
                >
                    <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 21, fontWeight: '800' }}>
                        {title}
                    </Text>
                    <Text selectable style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 23 }}>
                        {description}
                    </Text>
                    {pending ? (
                        <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.textSecondary }}>
                            Confirming…
                        </Text>
                    ) : null}
                    <View style={{ gap: 10 }}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={confirmLabel}
                            accessibilityHint={description}
                            accessibilityState={{ disabled: pending, busy: pending }}
                            disabled={pending}
                            onPress={onConfirm}
                            ref={confirmRef}
                            style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: pending ? colors.border : colors.error }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '800' }}>{confirmLabel}</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            accessibilityState={{ disabled: pending }}
                            disabled={pending}
                            onPress={cancel}
                            style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}
