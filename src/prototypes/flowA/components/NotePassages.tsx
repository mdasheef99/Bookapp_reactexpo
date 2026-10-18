import React from 'react';
import { Text, View } from 'react-native';
import { categoryLabel } from '@/features/books/notes/manualNoteContract';
import type { ManualNote } from '@/features/books/notes/manualNoteContract';
import type { Appearance } from '../prototypeTokens';
import { NOTE_PREVIEW_LINES, styles, usePrototypeText } from '../prototypeTokens';
import { TextButton } from './TextButton';

export function noteDate(stamp: string) {
    const date = new Date(stamp);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short',
        ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    });
}

export function NotePassages({ notes, state, colors }: { notes: ManualNote[]; state: string; colors: Appearance }) {
    const text = usePrototypeText();
    const partial = state === 'notes-loading' || state === 'notes-error';
    return <View style={[styles.notes, { borderColor: colors.divider }]}>
        <View testID="fa-notes-header" style={styles.notesHeader}>
            <Text role="heading" aria-level={2} accessibilityRole="header" style={[text.heading, { color: colors.textPrimary }]}>Your notes</Text>
            {!partial && notes.length > 0 && <Text testID="fa-note-count" style={[text.body, { color: colors.textSecondary }]}>
                {`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
            </Text>}
        </View>
        {state === 'notes-loading' ? <Text accessibilityLiveRegion="polite" style={[text.body, { color: colors.textSecondary }]}>Loading notes…</Text> :
            state === 'notes-error' ? <View>
                <Text style={[text.body, { color: colors.textSecondary }]}>Couldn't load your notes.</Text>
                <TextButton label="Try again" colors={colors} onPress={() => console.info('[FA-P1] would retry notes')} />
            </View> : notes.length === 0 ? <Text style={[text.body, { color: colors.textSecondary }]}>No notes yet.</Text> :
                <View style={styles.passages}>
                    {[...notes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2).map(note => <View key={note.id} style={styles.passage}>
                        <Text testID={`fa-note-${note.id}-meta`} style={[text.caption, { color: colors.textTertiary }]}>
                            {[note.tag ? categoryLabel(note.tag) : null, note.page_number == null ? null : `p. ${note.page_number}`, noteDate(note.created_at)].filter(Boolean).join(' · ')}
                        </Text>
                        <Text testID={`fa-note-${note.id}-body`} numberOfLines={NOTE_PREVIEW_LINES} ellipsizeMode="tail"
                            style={[text.bodySerif, { color: colors.textPrimary }]}>
                            {note.tag === 'quote' ? `“${note.content}”` : note.content}
                        </Text>
                    </View>)}
                </View>}
    </View>;
}
