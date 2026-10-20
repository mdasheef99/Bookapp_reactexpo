import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ShelfArrangement } from '@/features/books/hooks/useShelfArrangement';
import { LIBRARY_RADIUS, useLibraryAppearance } from './LibraryAppearance';
import { useLibraryTypography } from './LibraryTypography';

export function LibraryArrangeControls({ arrangement, onEnter, bookCount, dragging, interactionHint = 'Tap a book, then drag it. Hold it near an edge to scroll.' }: {
    arrangement: ShelfArrangement; onEnter: () => void; bookCount: number; dragging: boolean; interactionHint?: string;
}) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    const button = (label: string, onPress: () => void, disabled: boolean, primary = false) => (
        <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label === 'Save' ? 'Save shelf arrangement' : label}
            accessibilityState={{ disabled, busy: label === 'Save' && arrangement.saving }} testID={`library-arrange-${label.toLowerCase().replace(/ /g, '-')}`}
            style={[styles.button, { backgroundColor: primary ? colors.accent : colors.bgCard, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
            <Text style={{ color: primary ? colors.onAccent : colors.textPrimary, fontFamily: fonts.label }}>{label === 'Save' && arrangement.saving ? 'Saving…' : label}</Text>
        </TouchableOpacity>
    );
    return (
        <View style={styles.container} testID="library-arrange-controls">
            <View style={styles.row}>
                {arrangement.active ? <>
                    {button('Undo', arrangement.undo, !arrangement.canUndo || arrangement.saving || dragging)}
                    {button('Cancel', arrangement.cancel, arrangement.saving)}
                    {button('Save', () => { void arrangement.save(); }, arrangement.saving || dragging, true)}
                </> : bookCount > 1 ? button('Arrange shelf', onEnter, !arrangement.ready || arrangement.saving) : null}
            </View>
            {arrangement.active ? <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {interactionHint}
            </Text> : null}
            {arrangement.message ? <Text accessibilityLiveRegion="polite" testID="library-arrange-message"
                style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>{arrangement.message}</Text> : null}
            {arrangement.readError ? button('Try again', arrangement.retryRead, false) : null}
        </View>
    );
}

export function LibraryArrangeSelection({ title, onEarlier, onLater, canEarlier, canLater, disabled }: {
    title: string | undefined; onEarlier: () => void; onLater: () => void;
    canEarlier: boolean; canLater: boolean; disabled: boolean;
}) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    return <View style={[styles.selection, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textPrimary, fontFamily: fonts.body }}>
            {title ? `Selected: ${title}` : 'Select a book on the shelf or choose one below.'}
        </Text>
        {title ? <View style={styles.row}>
            {(['earlier', 'later'] as const).map((direction) => {
                const unavailable = disabled || !(direction === 'earlier' ? canEarlier : canLater);
                return <TouchableOpacity key={direction} accessibilityRole="button" accessibilityLabel={`Move ${title} ${direction}`}
                    accessibilityState={{ disabled: unavailable }} disabled={unavailable}
                    onPress={direction === 'earlier' ? onEarlier : onLater} testID={`library-arrange-${direction}`}
                    style={[styles.button, { borderColor: colors.border, opacity: unavailable ? 0.5 : 1 }]}>
                    <Text style={{ color: colors.textPrimary, fontFamily: fonts.label }}>{direction === 'earlier' ? '← Earlier' : 'Later →'}</Text>
                </TouchableOpacity>;
            })}
        </View> : null}
    </View>;
}

const styles = StyleSheet.create({
    container: { marginBottom: 12, gap: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderRadius: LIBRARY_RADIUS.control },
    hint: { fontSize: 13, lineHeight: 19 }, selection: { padding: 14, borderWidth: 1, borderRadius: LIBRARY_RADIUS.card, marginTop: 14, gap: 10 },
});
