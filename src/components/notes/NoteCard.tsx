import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { ReadingNote, NoteTag, NOTE_TAG_CONFIG } from '@/features/books/services/notesService';
import { ManualNote, categoryLabel } from '@/features/books/notes/manualNoteContract';

interface NoteCardProps {
    note: ReadingNote | ManualNote;
    onRead?: () => void;
    onEdit?: (note: ReadingNote) => void;
    onDelete?: (noteId: string) => void;
}

export const NoteCard = ({ note, onRead, onEdit, onDelete }: NoteCardProps) => {
    const colors = useLibraryAppearance();
    const tagConfig = note.tag ? NOTE_TAG_CONFIG[note.tag as NoteTag] : undefined;

    const handleLongPress = () => {
        if (onRead) { onRead(); return; }
        if (!onEdit || !onDelete) return;
        Alert.alert(
            'Note Options',
            '',
            [
                { text: 'Edit', onPress: () => onEdit(note as ReadingNote) },
                {
                    text: 'Delete',
                    onPress: () => {
                        Alert.alert(
                            'Delete Note',
                            'Are you sure you want to delete this note?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => onDelete(note.id) },
                            ]
                        );
                    },
                    style: 'destructive',
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const formattedDate = new Date(note.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const formattedTime = new Date(note.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const isQuote = note.tag === 'quote';

    return (
        <TouchableOpacity
            onLongPress={handleLongPress}
            onPress={() => onRead ? onRead() : onEdit?.(note as ReadingNote)}
            accessibilityRole="button"
            accessibilityLabel={`Read note${note.tag ? `, ${categoryLabel(note.tag)}` : ''}${note.page_number ? `, page ${note.page_number}` : ''}`}
            activeOpacity={0.8}
            style={[
                styles.card,
                {
                    backgroundColor: colors.bgCard,
                    // The quote stripe keeps its own tag colour (NOTE_TAG_CONFIG, Flow B / D07-04);
                    // accent is only the fallback for a note with no configured tag.
                    borderColor: colors.divider,
                    shadowColor: colors.shadow,
                },
                isQuote && {
                    borderLeftWidth: 3,
                    borderLeftColor: tagConfig?.color ?? colors.accent,
                },
            ]}
        >
            {/* Tag Badge + Timestamp Row */}
            <View style={styles.topRow}>
                {note.tag && <View style={[styles.tagBadge, { backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.tagLabel, { color: colors.textSecondary }]}>
                        {categoryLabel(note.tag)}
                    </Text>
                </View>}
                <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                    {formattedDate} • {formattedTime}
                </Text>
            </View>

            {/* Note Content */}
            <Text
                style={[
                    styles.content,
                    { color: colors.textPrimary },
                ]}
                numberOfLines={6}
            >
                {note.content}
            </Text>

            {/* Page Number (if set) */}
            {note.page_number && (
                <View style={styles.pageRow}>
                    <Ionicons name="document-text-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.pageText, { color: colors.textSecondary }]}>
                        Page {note.page_number}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    topRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    tagBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 10,
        gap: 4,
    },
    tagLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    timestamp: {
        fontSize: 13,
    },
    content: {
        fontSize: 15,
        lineHeight: 22,
    },
    quoteContent: {
        fontStyle: 'italic',
        lineHeight: 24,
    },
    pageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 10,
    },
    pageText: {
        fontSize: 14,
    },
});
