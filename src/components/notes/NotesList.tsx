import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ReadingNote, NoteTag } from '@/features/books/services/notesService';
import { NoteCard } from './NoteCard';
import { TagSelector } from './TagSelector';

interface NotesListProps {
    notes: ReadingNote[];
    isLoading: boolean;
    onEdit: (note: ReadingNote) => void;
    onDelete: (noteId: string) => void;
    onRefresh: () => void;
    /** Max notes to show (for preview mode on book detail) */
    maxItems?: number;
    /** Hide the tag filter bar */
    hideFilter?: boolean;
}

export const NotesList = ({
    notes,
    isLoading,
    onEdit,
    onDelete,
    onRefresh,
    maxItems,
    hideFilter = false,
}: NotesListProps) => {
    const { colors } = useTheme();
    const [activeTagFilter, setActiveTagFilter] = useState<NoteTag | null>(null);

    const filteredNotes = activeTagFilter
        ? notes.filter((n) => n.tag === activeTagFilter)
        : notes;

    const displayNotes = maxItems ? filteredNotes.slice(0, maxItems) : filteredNotes;

    const handleTagFilter = useCallback((tag: NoteTag | null) => {
        setActiveTagFilter(tag);
    }, []);

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Tag Filter */}
            {!hideFilter && notes.length > 0 && (
                <View style={styles.filterBar}>
                    <TagSelector
                        selected={activeTagFilter}
                        onChange={handleTagFilter}
                        allowDeselect
                        compact
                    />
                </View>
            )}

            {displayNotes.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons
                        name="pencil-outline"
                        size={40}
                        color={colors.textTertiary}
                        style={{ marginBottom: 12 }}
                    />
                    <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                        {activeTagFilter
                            ? `No ${activeTagFilter} notes yet`
                            : 'No notes yet'}
                    </Text>
                    <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
                        {activeTagFilter
                            ? 'Try a different filter or add a new note'
                            : 'Capture your first thought about this book'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={displayNotes}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <NoteCard
                            note={item}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    )}
                    scrollEnabled={false} // Nested inside ScrollView
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={onRefresh}
                            tintColor={colors.accent}
                        />
                    }
                />
            )}

            {/* Note count when filtered */}
            {activeTagFilter && filteredNotes.length > 0 && (
                <Text style={[styles.countText, { color: colors.textTertiary }]}>
                    {filteredNotes.length} {activeTagFilter} note{filteredNotes.length !== 1 ? 's' : ''}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        padding: 40,
        alignItems: 'center',
    },
    filterBar: {
        marginBottom: 8,
    },
    listContent: {
        paddingBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    emptyBody: {
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 260,
    },
    countText: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
});
