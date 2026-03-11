import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ReadingNote, NoteTag, NOTE_TAG_CONFIG } from '@/features/books/services/notesService';

interface NoteCardProps {
    note: ReadingNote;
    onEdit: (note: ReadingNote) => void;
    onDelete: (noteId: string) => void;
}

export const NoteCard = ({ note, onEdit, onDelete }: NoteCardProps) => {
    const { colors } = useTheme();
    const tagConfig = NOTE_TAG_CONFIG[note.tag];

    const handleLongPress = () => {
        Alert.alert(
            'Note Options',
            '',
            [
                { text: 'Edit', onPress: () => onEdit(note) },
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
            onPress={() => onEdit(note)}
            activeOpacity={0.8}
            style={[
                styles.card,
                {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                },
                isQuote && {
                    borderLeftWidth: 3,
                    borderLeftColor: tagConfig.color,
                },
            ]}
        >
            {/* Tag Badge + Timestamp Row */}
            <View style={styles.topRow}>
                <View style={[styles.tagBadge, { backgroundColor: tagConfig.bgColor }]}>
                    <Ionicons name={tagConfig.icon as any} size={12} color={tagConfig.color} />
                    <Text style={[styles.tagLabel, { color: tagConfig.color }]}>
                        {tagConfig.label}
                    </Text>
                </View>
                <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                    {formattedDate} • {formattedTime}
                </Text>
            </View>

            {/* Note Content */}
            <Text
                style={[
                    styles.content,
                    { color: colors.textPrimary },
                    isQuote && styles.quoteContent,
                ]}
                numberOfLines={6}
            >
                {isQuote ? `"${note.content}"` : note.content}
            </Text>

            {/* Page Number (if set) */}
            {note.page_number && (
                <View style={styles.pageRow}>
                    <Ionicons name="document-text-outline" size={12} color={colors.textTertiary} />
                    <Text style={[styles.pageText, { color: colors.textTertiary }]}>
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    topRow: {
        flexDirection: 'row',
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
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timestamp: {
        fontSize: 11,
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
        fontSize: 12,
    },
});
