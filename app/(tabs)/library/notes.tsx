import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { notesService, ReadingNote, NoteTag } from '@/features/books/services/notesService';
import { NoteCard, NoteEditor, TagSelector } from '@/components/notes';
import { AtmosphericBackground } from '@/components/ui/AtmosphericBackground';
import { navigateBackOrFallback } from '@/lib/navigation';

export default function NotesScreen() {
    const { userBookId, bookTitle } = useLocalSearchParams<{ userBookId: string; bookTitle: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { colors } = useTheme();
    const { user } = useAuth();

    const [showEditor, setShowEditor] = useState(false);
    const [editingNote, setEditingNote] = useState<ReadingNote | null>(null);
    const [activeTagFilter, setActiveTagFilter] = useState<NoteTag | null>(null);

    const handleBackPress = useCallback(() => {
        if (userBookId) {
            navigateBackOrFallback(router, {
                pathname: '/(tabs)/library/[bookId]',
                params: { bookId: userBookId },
            });
            return;
        }

        navigateBackOrFallback(router, '/(tabs)/library');
    }, [router, userBookId]);

    // Fetch notes
    const { data: notes = [], isLoading, refetch } = useQuery({
        queryKey: ['notes', userBookId],
        queryFn: () => notesService.getNotesForBook(userBookId!),
        enabled: !!userBookId,
    });

    // Filtered notes
    const filteredNotes = activeTagFilter
        ? notes.filter((n) => n.tag === activeTagFilter)
        : notes;

    // Create / Update note
    const saveMutation = useMutation({
        mutationFn: async ({ content, tag, pageNumber }: { content: string; tag: NoteTag; pageNumber?: number }) => {
            if (editingNote) {
                return notesService.updateNote(editingNote.id, { content, tag, page_number: pageNumber ?? null });
            }
            return notesService.createNote(user!.id, userBookId!, content, tag, pageNumber);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes', userBookId] });
            queryClient.invalidateQueries({ queryKey: ['notesCount', userBookId] });
            setEditingNote(null);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message || 'Failed to save note');
        },
    });

    // Delete note
    const deleteMutation = useMutation({
        mutationFn: (noteId: string) => notesService.deleteNote(noteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes', userBookId] });
            queryClient.invalidateQueries({ queryKey: ['notesCount', userBookId] });
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message || 'Failed to delete note');
        },
    });

    const handleSave = async (content: string, tag: NoteTag, pageNumber?: number) => {
        await saveMutation.mutateAsync({ content, tag, pageNumber });
    };

    const handleEdit = useCallback((note: ReadingNote) => {
        setEditingNote(note);
        setShowEditor(true);
    }, []);

    const handleDelete = useCallback((noteId: string) => {
        deleteMutation.mutate(noteId);
    }, [deleteMutation]);

    const handleAddNew = useCallback(() => {
        setEditingNote(null);
        setShowEditor(true);
    }, []);

    // Tag count summary
    const tagCounts = notes.reduce((acc, note) => {
        acc[note.tag] = (acc[note.tag] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <AtmosphericBackground>
            <View style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={handleBackPress}
                        style={[styles.backButton, { backgroundColor: colors.bgCard }]}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            My Notes
                        </Text>
                        {bookTitle && (
                            <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                                {bookTitle}
                            </Text>
                        )}
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Stats Bar */}
                {notes.length > 0 && (
                    <View style={[styles.statsBar, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.totalCount, { color: colors.textSecondary }]}>
                            {notes.length} note{notes.length !== 1 ? 's' : ''}
                        </Text>
                        {Object.entries(tagCounts).map(([tag, count]) => (
                            <Text key={tag} style={[styles.tagCount, { color: colors.textTertiary }]}>
                                {tag}: {count}
                            </Text>
                        ))}
                    </View>
                )}

                {/* Tag Filter */}
                {notes.length > 0 && (
                    <View style={styles.filterContainer}>
                        <TagSelector
                            selected={activeTagFilter}
                            onChange={(tag) => setActiveTagFilter(tag)}
                            allowDeselect
                            compact
                        />
                    </View>
                )}

                {/* Notes List */}
                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                ) : filteredNotes.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="pencil-outline"
                            size={48}
                            color={colors.textTertiary}
                            style={{ marginBottom: 16 }}
                        />
                        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                            {activeTagFilter
                                ? `No ${activeTagFilter} notes`
                                : 'Start capturing your thoughts'}
                        </Text>
                        <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
                            {activeTagFilter
                                ? 'Try a different filter or add a new note'
                                : 'Tap the + button to write your first note'}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredNotes}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <NoteCard
                                note={item}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={false}
                                onRefresh={refetch}
                                tintColor={colors.accent}
                            />
                        }
                    />
                )}

                {/* FAB - Add Note */}
                <TouchableOpacity
                    onPress={handleAddNew}
                    style={[styles.fab, { backgroundColor: colors.accent }]}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Note Editor Modal */}
                <NoteEditor
                    visible={showEditor}
                    onClose={() => {
                        setShowEditor(false);
                        setEditingNote(null);
                    }}
                    onSave={handleSave}
                    editingNote={editingNote}
                    bookTitle={bookTitle}
                />
            </View>
        </AtmosphericBackground>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    headerSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    totalCount: {
        fontSize: 13,
        fontWeight: '600',
    },
    tagCount: {
        fontSize: 12,
    },
    filterContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    emptyBody: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
});
