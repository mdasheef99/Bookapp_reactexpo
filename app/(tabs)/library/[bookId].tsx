import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { booksService } from '@/features/books/services/booksService';
import { notesService, ReadingNote, NoteTag, NOTE_TAG_CONFIG } from '@/features/books/services/notesService';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    StatusSelector,
    OwnershipSelector,
    ConditionPicker,
    RatingInput,
    DeleteBookModal,
    ReadingStatus,
    Ownership,
    Condition
} from '@/components/library';
import { NoteCard, NoteEditor } from '@/components/notes';
import { AtmosphericBackground } from '@/components/ui/AtmosphericBackground';
import { navigateBackOrFallback } from '@/lib/navigation';

const formatReviewDate = (value?: string | null) => {
    if (!value) return 'Recently';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const getReviewerName = (review: {
    author: {
        display_name?: string | null;
        username?: string | null;
    };
}) => review.author.display_name?.trim() || review.author.username?.trim() || 'Community reader';

export default function BookDetailScreen() {
    const { bookId } = useLocalSearchParams<{ bookId: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { colors } = useTheme();
    const { user } = useAuth();

    const [reviewText, setReviewText] = useState('');
    const [isReviewPublic, setIsReviewPublic] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showNoteEditor, setShowNoteEditor] = useState(false);
    const [editingNote, setEditingNote] = useState<ReadingNote | null>(null);

    const handleBackPress = useCallback(() => {
        navigateBackOrFallback(router, '/(tabs)/library');
    }, [router]);

    // Fetch Book Details
    const { data: userBook, isLoading, error } = useQuery({
        queryKey: ['book', bookId],
        queryFn: () => booksService.getBookDetails(bookId!),
        enabled: !!bookId,
    });

    useEffect(() => {
        if (!userBook) return;

        setReviewText(userBook.review ?? '');
        setIsReviewPublic(userBook.review_is_public ?? true);
    }, [userBook]);

    const book = userBook?.book;

    const {
        data: publicReviews = [],
        isLoading: publicReviewsLoading,
        error: publicReviewsError,
    } = useQuery({
        queryKey: ['book-public-reviews', userBook?.book_id],
        queryFn: () => booksService.getPublicReviewsForBook(userBook!.book_id),
        enabled: !!userBook?.book_id,
        retry: false,
    });

    // Fetch notes for this book (preview: last 3)
    const { data: notes = [], refetch: refetchNotes } = useQuery({
        queryKey: ['notes', bookId],
        queryFn: () => notesService.getNotesForBook(bookId!),
        enabled: !!bookId,
    });

    // Notes count for badge
    const notesCount = notes.length;
    const recentNotes = notes.slice(0, 3);

    // Save note mutation
    const saveNoteMutation = useMutation({
        mutationFn: async ({ content, tag, pageNumber }: { content: string; tag: NoteTag; pageNumber?: number }) => {
            if (editingNote) {
                return notesService.updateNote(editingNote.id, { content, tag, page_number: pageNumber ?? null });
            }
            return notesService.createNote(user!.id, bookId!, content, tag, pageNumber);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes', bookId] });
            setEditingNote(null);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message || 'Failed to save note');
        },
    });

    // Delete note mutation
    const deleteNoteMutation = useMutation({
        mutationFn: (noteId: string) => notesService.deleteNote(noteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes', bookId] });
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message || 'Failed to delete note');
        },
    });

    const handleNoteSave = useCallback(async (content: string, tag: NoteTag, pageNumber?: number) => {
        await saveNoteMutation.mutateAsync({ content, tag, pageNumber });
    }, [saveNoteMutation]);

    const handleNoteEdit = useCallback((note: ReadingNote) => {
        setEditingNote(note);
        setShowNoteEditor(true);
    }, []);

    const handleNoteDelete = useCallback((noteId: string) => {
        deleteNoteMutation.mutate(noteId);
    }, [deleteNoteMutation]);

    // Mutation helpers
    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['library'] });
        queryClient.invalidateQueries({ queryKey: ['book', bookId] });
    };

    // --- Mutations ---

    const updateStatusMutation = useMutation({
        mutationFn: (status: ReadingStatus) => booksService.updateReadingStatus(bookId!, status),
        onSuccess: invalidateQueries,
    });

    const updateOwnershipMutation = useMutation({
        mutationFn: (ownership: Ownership) => booksService.updateOwnership(bookId!, ownership),
        onSuccess: invalidateQueries,
    });

    const updateConditionMutation = useMutation({
        mutationFn: (condition: Condition) => booksService.updateCondition(bookId!, condition),
        onSuccess: invalidateQueries,
    });

    const updateRatingMutation = useMutation({
        mutationFn: ({ rating, review, isPublic }: { rating?: number; review?: string; isPublic?: boolean }) =>
            booksService.addRating(bookId!, rating, review, isPublic),
        onSuccess: invalidateQueries,
        onError: (err: any) => {
            Alert.alert('Error', err.message || 'Failed to save review');
        },
    });

    const toggleLendingMutation = useMutation({
        mutationFn: (val: boolean) => booksService.toggleLendingAvailability(bookId!, val),
        onSuccess: invalidateQueries,
    });

    const deleteMutation = useMutation({
        mutationFn: () => booksService.removeFromLibrary(bookId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['library'] });
            handleBackPress();
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message || 'Failed to remove book');
        }
    });

    // --- Handlers ---

    const getPersistedRating = useCallback(() => {
        if (typeof userBook?.rating !== 'number') return undefined;
        return userBook.rating > 0 ? userBook.rating : undefined;
    }, [userBook?.rating]);

    const handleSaveReview = () => {
        if (!userBook) return;

        updateRatingMutation.mutate({
            rating: getPersistedRating(),
            review: reviewText,
            isPublic: isReviewPublic
        }, {
            onSuccess: () => {
                Alert.alert('Success', 'Review saved!');
            }
        });
    };

    if (isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (error || !userBook) {
        return (
            <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
                <Text style={{ color: colors.textSecondary }}>Book not found.</Text>
                <TouchableOpacity onPress={handleBackPress} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <AtmosphericBackground>
            <View style={{ flex: 1 }}>

                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Header / Nav */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={handleBackPress}
                            testID="library-book-back-button"
                            style={[styles.backButton, { backgroundColor: colors.bgCard }]}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* Cover & Hero */}
                    <View style={styles.hero}>
                        <View style={styles.coverContainer}>
                            <Image
                                source={{ uri: book.cover_url || 'https://via.placeholder.com/150x220' }}
                                style={styles.coverImage}
                                contentFit="cover"
                            />
                        </View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>{book.title}</Text>
                        <Text style={[styles.author, { color: colors.textSecondary }]}>
                            {book.authors?.join(', ')}
                        </Text>
                    </View>

                    {/* Content Card */}
                    <View style={[styles.card, { backgroundColor: colors.bgCard }]}>

                        {/* Status & Ownership */}
                        <StatusSelector
                            status={userBook.reading_status as ReadingStatus}
                            onChange={(val) => updateStatusMutation.mutate(val)}
                            disabled={updateStatusMutation.isPending}
                        />

                        <View style={styles.divider} />

                        <OwnershipSelector
                            ownership={userBook.ownership as Ownership}
                            onChange={(val) => updateOwnershipMutation.mutate(val)}
                            disabled={updateOwnershipMutation.isPending}
                        />

                        {/* Lending Toggle (Only if Owned) */}
                        {userBook.ownership === 'owned' && (
                            <View style={styles.rowBetween}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>Available for Lending</Text>
                                <Switch
                                    value={userBook.available_for_lending}
                                    onValueChange={(val) => toggleLendingMutation.mutate(val)}
                                    trackColor={{ false: colors.border, true: colors.accent }}
                                />
                            </View>
                        )}

                        <View style={[styles.divider, { marginVertical: 16 }]} />

                        {/* Condition (Only if Owned/Lent) */}
                        {['owned', 'lent_out'].includes(userBook.ownership) && (
                            <>
                                <ConditionPicker
                                    condition={userBook.condition as Condition}
                                    onChange={(val) => updateConditionMutation.mutate(val)}
                                    disabled={updateConditionMutation.isPending}
                                />
                                <View style={[styles.divider, { marginVertical: 16 }]} />
                            </>
                        )}

                        {/* Rating & Review */}
                        <RatingInput
                            rating={userBook.rating || 0}
                            onChange={(val) => updateRatingMutation.mutate({ rating: val, review: reviewText, isPublic: isReviewPublic })}
                            disabled={updateRatingMutation.isPending}
                        />

                        <View style={styles.reviewSection}>
                            <Text style={[styles.label, { color: colors.textPrimary, marginBottom: 8 }]}>Your Review</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: colors.bgSecondary,
                                    color: colors.textPrimary,
                                    borderColor: colors.border
                                }]}
                                testID="library-review-input"
                                placeholder="Write your thoughts..."
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                value={reviewText}
                                onChangeText={setReviewText}
                                onBlur={handleSaveReview} // Auto-save on blur
                            />
                            <TouchableOpacity
                                testID="library-review-privacy-toggle"
                                style={styles.publicToggle}
                                onPress={() => {
                                    const nextIsPublic = !isReviewPublic;
                                    setIsReviewPublic(nextIsPublic);
                                    updateRatingMutation.mutate({
                                        rating: getPersistedRating(),
                                        review: reviewText,
                                        isPublic: nextIsPublic
                                    });
                                }}
                            >
                                <Ionicons
                                    name={isReviewPublic ? "eye-outline" : "eye-off-outline"}
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 6 }}>
                                    {isReviewPublic ? 'Public Review' : 'Private Note'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Metadata Expansion */}
                        <View style={styles.metadata}>
                            {book.page_count && (
                                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                    {book.page_count} pages • {book.publisher}
                                </Text>
                            )}
                            {book.isbn_13 && (
                                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                    ISBN: {book.isbn_13}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View style={[styles.communityReviewsSection, { backgroundColor: colors.bgCard }]}>
                        <View style={styles.communityReviewsHeader}>
                            <Text style={[styles.communityReviewsTitle, { color: colors.textPrimary }]}>Community Reviews</Text>
                            {publicReviews.length > 0 && (
                                <Text style={[styles.communityReviewsCount, { color: colors.textSecondary }]}>
                                    {publicReviews.length}
                                </Text>
                            )}
                        </View>

                        {publicReviewsLoading ? (
                            <View style={styles.communityReviewsState}>
                                <ActivityIndicator size="small" color={colors.accent} />
                            </View>
                        ) : publicReviewsError ? (
                            <View style={styles.communityReviewsState}>
                                <Text style={[styles.communityReviewsStateText, { color: colors.textSecondary }]}>
                                    Community reviews are temporarily unavailable.
                                </Text>
                            </View>
                        ) : publicReviews.length === 0 ? (
                            <View style={styles.communityReviewsState} testID="community-reviews-empty">
                                <Text style={[styles.communityReviewsStateText, { color: colors.textSecondary }]}>
                                    No public reviews yet.
                                </Text>
                            </View>
                        ) : (
                            publicReviews.map((review) => {
                                const authorName = getReviewerName(review);
                                const authorHandle = review.author.username?.trim();

                                return (
                                    <View
                                        key={review.user_book_id}
                                        testID={`community-review-${review.user_book_id}`}
                                        style={[
                                            styles.communityReviewCard,
                                            { backgroundColor: colors.bgSecondary, borderColor: colors.border },
                                        ]}
                                    >
                                        <View style={styles.communityReviewHeader}>
                                            <View style={styles.communityReviewAuthorBlock}>
                                                <Text style={[styles.communityReviewAuthor, { color: colors.textPrimary }]}>
                                                    {authorName}
                                                </Text>
                                                {authorHandle && (
                                                    <Text style={[styles.communityReviewHandle, { color: colors.textSecondary }]}>
                                                        @{authorHandle}
                                                    </Text>
                                                )}
                                            </View>

                                            <View style={styles.communityReviewMeta}>
                                                {typeof review.rating === 'number' && review.rating > 0 && (
                                                    <Text style={[styles.communityReviewRating, { color: colors.accent }]}> 
                                                        {'★'.repeat(review.rating)}
                                                    </Text>
                                                )}
                                                <Text style={[styles.communityReviewDate, { color: colors.textTertiary }]}>
                                                    {formatReviewDate(review.created_at)}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={[styles.communityReviewText, { color: colors.textPrimary }]}>
                                            {review.review}
                                        </Text>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {/* === My Notes Section === */}
                    <View style={[styles.notesSection, { backgroundColor: colors.bgCard }]}>
                        <View style={styles.notesSectionHeader}>
                            <View style={styles.notesTitleRow}>
                                <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                                <Text style={[styles.notesSectionTitle, { color: colors.textPrimary }]}>
                                    My Notes
                                </Text>
                                {notesCount > 0 && (
                                    <View style={[styles.notesBadge, { backgroundColor: colors.accent }]}>
                                        <Text style={styles.notesBadgeText}>{notesCount}</Text>
                                    </View>
                                )}
                            </View>
                            {notesCount > 0 && (
                                <TouchableOpacity
                                    onPress={() => router.push({
                                        pathname: '/(tabs)/library/notes',
                                        params: { userBookId: bookId, bookTitle: book.title },
                                    })}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.viewAllText, { color: colors.accent }]}>
                                        View All →
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Recent Notes Preview */}
                        {recentNotes.length > 0 ? (
                            <View style={styles.notesPreview}>
                                {recentNotes.map((note) => (
                                    <NoteCard
                                        key={note.id}
                                        note={note}
                                        onEdit={handleNoteEdit}
                                        onDelete={handleNoteDelete}
                                    />
                                ))}
                            </View>
                        ) : (
                            <View style={styles.notesEmptyState}>
                                <Ionicons name="bulb-outline" size={28} color={colors.textTertiary} />
                                <Text style={[styles.notesEmptyText, { color: colors.textTertiary }]}>
                                    Capture your thoughts as you read
                                </Text>
                            </View>
                        )}

                        {/* Add Note Inline Button */}
                        <TouchableOpacity
                            onPress={() => {
                                setEditingNote(null);
                                setShowNoteEditor(true);
                            }}
                            style={[styles.addNoteButton, { borderColor: colors.border }]}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                            <Text style={[styles.addNoteText, { color: colors.accent }]}>
                                Add a note
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Delete Button */}
                    <TouchableOpacity
                        onPress={() => setShowDeleteModal(true)}
                        style={styles.deleteButtonContainer}
                    >
                        <Text style={styles.deleteText}>Remove from Library</Text>
                    </TouchableOpacity>

                </ScrollView>

                <DeleteBookModal
                    visible={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={() => deleteMutation.mutate()}
                    isDeleting={deleteMutation.isPending}
                />

                {/* Note Editor Modal */}
                <NoteEditor
                    visible={showNoteEditor}
                    onClose={() => {
                        setShowNoteEditor(false);
                        setEditingNote(null);
                    }}
                    onSave={handleNoteSave}
                    editingNote={editingNote}
                    bookTitle={book?.title}
                />
            </View>
        </AtmosphericBackground>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
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
    hero: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    coverContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 10,
        marginBottom: 20,
    },
    coverImage: {
        width: 140,
        height: 220,
        borderRadius: 12,
        backgroundColor: '#eee',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    author: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    card: {
        marginHorizontal: 16,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginVertical: 4,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    reviewSection: {
        marginTop: 16,
    },
    input: {
        borderRadius: 16,
        padding: 12,
        height: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        fontSize: 15,
    },
    publicToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        alignSelf: 'flex-end',
    },
    metadata: {
        marginTop: 24,
        alignItems: 'center',
    },
    communityReviewsSection: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    communityReviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    communityReviewsTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    communityReviewsCount: {
        fontSize: 13,
        fontWeight: '600',
    },
    communityReviewsState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    communityReviewsStateText: {
        fontSize: 14,
        textAlign: 'center',
    },
    communityReviewCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
    },
    communityReviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 10,
    },
    communityReviewAuthorBlock: {
        flex: 1,
    },
    communityReviewAuthor: {
        fontSize: 14,
        fontWeight: '700',
    },
    communityReviewHandle: {
        fontSize: 12,
        marginTop: 2,
    },
    communityReviewMeta: {
        alignItems: 'flex-end',
    },
    communityReviewRating: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    communityReviewDate: {
        fontSize: 11,
    },
    communityReviewText: {
        fontSize: 14,
        lineHeight: 21,
    },
    metaText: {
        fontSize: 12,
        marginBottom: 4,
    },
    deleteButtonContainer: {
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 20,
        padding: 16,
    },
    deleteText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '600',
    },
    // Notes Section
    notesSection: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    notesSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    notesTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notesSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    notesBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    notesBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    viewAllText: {
        fontSize: 13,
        fontWeight: '600',
    },
    notesPreview: {
        marginBottom: 8,
    },
    notesEmptyState: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    notesEmptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    addNoteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    addNoteText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
