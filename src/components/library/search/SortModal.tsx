import { View, Text, Pressable, Modal, Platform, ScrollView, StyleSheet } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { DIALOG_MAX_WIDTH, ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';
import { SORT_OPTIONS, SortOption } from '@/lib/constants';

interface SortModalProps {
    visible: boolean;
    onClose: () => void;
    currentSort: SortOption;
    onSelect: (sort: SortOption) => void;
}

export const SortModal = ({ visible, onClose, currentSort, onSelect }: SortModalProps) => {
    const colors = useLibraryAppearance();
    const refs = useRef<(View | null)[]>([]);
    const [tabStop, setTabStop] = useState(currentSort);
    useEffect(() => { setTabStop(currentSort); }, [currentSort, visible]);
    const select = (sort: SortOption) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(sort);
        onClose();
    };
    return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}
        {...(Platform.OS === 'web' ? { accessibilityLabel: 'Sort results' } : {})}>
        <Pressable accessible={false} focusable={false} style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={onClose}>
            <Pressable accessible={false} focusable={false} style={[styles.panel, { backgroundColor: colors.bgRaised, borderColor: colors.controlBorder }]}
                onPress={event => event.stopPropagation()}>
                <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>Sort results</Text>
                <ScrollView>
                    <View accessibilityRole="radiogroup" accessibilityLabel="Sort results" style={styles.options}>
                        {SORT_OPTIONS.map((option, index) => {
                            const checked = currentSort === option.value;
                            return <Pressable key={option.value} ref={node => { refs.current[index] = node; }}
                                onPress={() => select(option.value)} accessibilityRole="radio" accessibilityLabel={option.label}
                                accessibilityState={{ checked }} aria-checked={checked} tabIndex={tabStop === option.value ? 0 : -1}
                                onFocus={() => setTabStop(option.value)}
                                {...{ onKeyDown: (event: { key?: string; nativeEvent?: { key: string }; target?: unknown; currentTarget?: unknown; repeat?: boolean; preventDefault: () => void }) => {
                                    const key = event.nativeEvent?.key ?? event.key;
                                    // RN Web's responder handles Enter; radio Space needs its own activation.
                                    if (key === ' ' && event.target === event.currentTarget) {
                                        event.preventDefault();
                                        if (!event.repeat) select(option.value);
                                        return;
                                    }
                                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
                                    event.preventDefault();
                                    const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : SORT_OPTIONS.length - 1)) % SORT_OPTIONS.length;
                                    setTabStop(SORT_OPTIONS[next].value);
                                    onSelect(SORT_OPTIONS[next].value);
                                    refs.current[next]?.focus();
                                } }}
                                style={[styles.option, { backgroundColor: checked ? colors.bgCard : colors.bgRaised, borderColor: colors.controlBorder }]}>
                                <Text style={[checked ? LIBRARY_TEXT.label : LIBRARY_TEXT.body, styles.label, { color: colors.textPrimary }]}>{option.label}</Text>
                                {checked && <Ionicons name="checkmark" size={ICON_SIZE} color={colors.accent} />}
                            </Pressable>;
                        })}
                    </View>
                </ScrollView>
            </Pressable>
        </Pressable>
    </Modal>;
};

const styles = StyleSheet.create({
    scrim: { flex: 1, justifyContent: 'flex-end', padding: LIBRARY_SPACING.md },
    panel: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, alignSelf: 'center', maxHeight: '80%', borderWidth: 1, borderRadius: LIBRARY_RADIUS.dialog, padding: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.md },
    options: { gap: LIBRARY_SPACING.xs },
    option: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: LIBRARY_SPACING.sm, paddingHorizontal: LIBRARY_SPACING.sm, paddingVertical: LIBRARY_SPACING.xs, borderRadius: LIBRARY_RADIUS.control, borderWidth: 1 },
    label: { flex: 1 },
});
