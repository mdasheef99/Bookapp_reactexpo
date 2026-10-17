import React, { useState, useCallback, useEffect, useRef, useId } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient, useMutationState } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { booksService } from '@/features/books/services/booksService';
import { bookReviewService, currentReviewActor, isCurrentReviewActor, ReviewActor, ReviewPatch, BookReviewFields } from '@/features/books/services/bookReviewService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { noteKeys } from '@/features/books/notes/manualNoteContract';
import { openNoteComposer, openNoteReader } from '@/features/books/notes/noteNavigation';
import { useNoteOperations } from '@/features/books/notes/useManualNotes';
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
import { NoteCard } from '@/components/notes';
import { VaultPagesList } from '@/components/library/VaultPagesList';
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

type ReviewSubmission = { actor: ReviewActor; entryId: string; patch: ReviewPatch; editorId: string; requestId: string; textRevision: number };

function BookSection({ title, children }: { title: string; children: React.ReactNode }) {
    const [expanded, setExpanded] = useState(false);
    const { colors } = useTheme();
    return <View style={[styles.notesSection, { backgroundColor: colors.bgCard }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }}
            onPress={() => setExpanded(value => !value)} style={styles.sectionButton}>
            <Text style={[styles.notesSectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        {expanded && children}
    </View>;
}

export default function BookDetailScreen() {
    const { bookId } = useLocalSearchParams<{ bookId: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { colors } = useTheme();
    const { user } = useAuth();
    useNoteOperations(user?.id ?? '', bookId);

    const [reviewText, setReviewText] = useState('');
    const [reviewDirty, setReviewDirty] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const editorId = useId();
    const requestSequence = useRef(0);
    const reviewDraft = useRef({ identity: '', revision: 0, dirty: false, textRequest: '' });

    const handleBackPress = useCallback(() => {
        navigateBackOrFallback(router, '/(tabs)/library');
    }, [router]);

    // Fetch Book Details
    const { data: userBook, isLoading, error } = useQuery({
        queryKey: ['book', user?.id, bookId],
        queryFn: () => booksService.getBookDetails(bookId!),
        enabled: !!user?.id && !!bookId,
    });

    const reviewActor = currentReviewActor(user?.id);
    const reviewMutationKey = ['book-review', user?.id, bookId, reviewActor?.revision];
    const observedReviewWrites = useMutationState({
        filters: { mutationKey: ['book-review'] },
        select: mutation => ({ submission: mutation.state.variables as ReviewSubmission,
            status: mutation.state.status, data: mutation.state.data as BookReviewFields | undefined }),
    });
    // Keep the hook filter stable; select the current identity synchronously on every render.
    const reviewWrites = observedReviewWrites.filter(({ submission }) => submission?.actor.id === reviewActor?.id &&
        submission.actor.revision === reviewActor?.revision && submission.entryId === bookId);
    const reviewBusy = reviewWrites.some(write => write.status === 'pending');
    const textWrites = reviewWrites.filter(write => typeof write.submission?.patch.review === 'string');
    const latestText = textWrites[textWrites.length - 1];

    const adoptReviewText = useCallback((submission: ReviewSubmission, confirmed: BookReviewFields) => {
        const draft = reviewDraft.current;
        if (!submission?.actor || typeof submission.patch.review !== 'string' || !isCurrentReviewActor(submission.actor) ||
            submission.actor.id !== user?.id || submission.entryId !== bookId ||
            draft.identity !== `${submission.actor.id}:${submission.entryId}:${submission.actor.revision}` || !draft.dirty) return false;
        if (draft.textRequest !== submission.requestId || !((submission.editorId === editorId &&
            submission.textRevision === draft.revision) || draft.revision === 0)) return false;
        // Consume the exact request; edit revisions can repeat after revisiting a book.
        draft.dirty = false;
        draft.textRequest = '';
        setReviewText(confirmed.review ?? '');
        setReviewDirty(false);
        return true;
    }, [user?.id, bookId, editorId]);

    useEffect(() => queryClient.getMutationCache().subscribe(event => {
        // Consume success synchronously, before GC can remove an unobserved inherited mutation.
        if (event.type === 'updated' && event.action.type === 'success' && event.mutation.options.mutationKey?.[0] === 'book-review') {
            const submission = event.mutation.state.variables as ReviewSubmission | undefined;
            if (submission?.actor && event.mutation.state.data) adoptReviewText(submission, event.mutation.state.data as BookReviewFields);
        }
    }), [queryClient, adoptReviewText]);

    useEffect(() => {
        if (!userBook) return;

        const identity = `${user?.id}:${bookId}:${reviewActor?.revision}`;
        const draft = reviewDraft.current;
        if (draft.identity !== identity) {
            const inherited = latestText?.status === 'pending' ? latestText.submission : undefined;
            const dirty = !!inherited;
            reviewDraft.current = { identity, revision: 0, dirty, textRequest: inherited?.requestId ?? '' };
            setReviewText(inherited?.patch.review ?? userBook.review ?? '');
            setReviewDirty(dirty);
            return;
        }
        if (latestText?.status === 'success' && latestText.data && adoptReviewText(latestText.submission, latestText.data)) return;
        if (!draft.dirty) {
            setReviewText(userBook.review ?? '');
        }
    }, [user?.id, bookId, reviewActor?.revision, userBook?.review, latestText, adoptReviewText]);

    const book = userBook?.book;
    const isReviewPublic = userBook?.review_is_public ?? true;

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
    const { data: notes, isPending: notesLoading, isError: notesError, refetch: refetchNotes } = useQuery({
        queryKey: noteKeys.collection(user?.id ?? '', bookId),
        queryFn: ({ signal }) => manualNotesGateway.list(user!.id, bookId, signal),
        enabled: !!user?.id && !!bookId,
    });

    // Notes count for badge
    const notesCount = notes?.length ?? 0;
    const recentNotes = notes?.slice(0, 3) ?? [];

    // Mutation helpers
    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['library'] });
        queryClient.invalidateQueries({ queryKey: ['book', user?.id, bookId] });
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
        mutationKey: reviewMutationKey,
        scope: { id: `book-review:${user?.id}:${bookId}:${reviewActor?.revision}` },
        mutationFn: ({ actor, entryId, patch }: ReviewSubmission) => bookReviewService.update(actor, entryId, patch),
        onSuccess: async (confirmed, submission) => {
            if (!isCurrentReviewActor(submission.actor)) return;
            const key = ['book', submission.actor.id, submission.entryId];
            await queryClient.cancelQueries({ queryKey: key, exact: true });
            if (!isCurrentReviewActor(submission.actor)) return;
            queryClient.setQueryData<typeof userBook>(key, (previous: typeof userBook) => previous ? {
                ...previous, ...confirmed,
            } : previous);
        },
        onError: (err: any, submission) => {
            if (!isCurrentReviewActor(submission.actor)) return;
            Alert.alert('Error', err.message || 'Failed to save review');
        },
        onSettled: (_data, _error, submission) => {
            if (!isCurrentReviewActor(submission.actor)) return;
            // Refresh only after the last queued write, so an earlier read cannot reset newer work.
            const key = ['book', submission.actor.id, submission.entryId];
            if (queryClient.isMutating({ mutationKey: ['book-review', submission.actor.id, submission.entryId, submission.actor.revision], exact: true }) === 1) {
                queryClient.invalidateQueries({ queryKey: ['library'] });
                queryClient.invalidateQueries({ queryKey: key, exact: true });
                const catalogueId = queryClient.getQueryData<typeof userBook>(key)?.book_id;
                if (catalogueId) queryClient.invalidateQueries({ queryKey: ['book-public-reviews', catalogueId] });
            }
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

    const submitReview = (patch: ReviewPatch) => {
        if (!userBook || !reviewActor || !isCurrentReviewActor(reviewActor)) return;
        const submission: ReviewSubmission = { actor: reviewActor, entryId: bookId, patch, editorId,
            requestId: `${editorId}:${++requestSequence.current}`, textRevision: reviewDraft.current.revision };
        if (typeof patch.review === 'string') reviewDraft.current.textRequest = submission.requestId;
        updateRatingMutation.mutate(submission, {
            onSuccess: () => {
                if (typeof patch.review === 'string' && isCurrentReviewActor(submission.actor) &&
                    reviewDraft.current.revision === submission.textRevision) Alert.alert('Success', 'Review saved!');
            }
        });
    };
    const handleSaveReview = () => submitReview({ review: reviewText });
    const handleReviewText = (text: string) => {
        reviewDraft.current.revision++;
        reviewDraft.current.textRequest = '';
        reviewDraft.current.dirty = true;
        setReviewDirty(true);
        setReviewText(text);
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
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Library" onPress={handleBackPress} style={{ marginTop: 20, minHeight: 48, minWidth: 48, justifyContent: 'center' }}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <AtmosphericBackground>
            <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>

                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Header / Nav */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={handleBackPress}
                            accessibilityRole="button"
                            accessibilityLabel="Back to Library"
                            testID="library-book-back-button"
                            style={[styles.backButton, { backgroundColor: colors.bgCard }]}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Library</Text>
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

                    <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
                        <StatusSelector
                            status={userBook.reading_status as ReadingStatus}
                            onChange={(val) => updateStatusMutation.mutate(val)}
                            disabled={updateStatusMutation.isPending}
                        />

                    </View>

                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add note"
                        onPress={() => openNoteComposer(router, user!.id, bookId, 'book')}
                        style={[styles.primaryNote, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.primaryNoteText, { color: colors.bgPrimary }]}>Add note</Text>
                    </TouchableOpacity>

                    {/* === My Notes Section === */}
                    <View style={[styles.notesSection, { backgroundColor: colors.bgCard }]}>
                        <View style={styles.notesSectionHeader}>
                            <View style={styles.notesTitleRow}>
                                <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                                <Text style={[styles.notesSectionTitle, { color: colors.textPrimary }]}>
                                    Notes
                                </Text>
                                {!notesLoading && !notesError && (
                                    <View style={[styles.notesBadge, { backgroundColor: colors.accent }]}>
                                        <Text style={styles.notesBadgeText}>{notesCount}</Text>
                                    </View>
                                )}
                            </View>
                            {(
                                <TouchableOpacity
                                    onPress={() => router.push({
                                        pathname: '/(tabs)/library/notes',
                                        params: { userBookId: bookId },
                                    })}
                                    accessibilityRole="button"
                                    accessibilityLabel="View all notes"
                                    style={styles.sectionButton}
                                >
                                    <Text style={[styles.viewAllText, { color: colors.accent }]}>
                                        View All →
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {notesError && !!notes?.length && <Text accessibilityRole="alert" style={{ color: colors.error, paddingVertical: 8 }}>Couldn’t refresh notes. Previously loaded notes are still shown.</Text>}
                        {/* Recent Notes Preview */}
                        {recentNotes.length > 0 ? (
                            <View style={styles.notesPreview}>
                                {recentNotes.map((note) => (
                                    <NoteCard
                                        key={note.id}
                                        note={note}
                                        onRead={() => openNoteReader(router, user!.id, bookId, note.id, 'book')}
                                    />
                                ))}
                            </View>
                        ) : (
                            <View style={styles.notesEmptyState}>
                                <Ionicons name="bulb-outline" size={28} color={colors.textTertiary} />
                                <Text style={[styles.notesEmptyText, { color: colors.textTertiary }]}>
                                    {notesLoading ? 'Loading notes…' : notesError ? 'Couldn’t load your notes.' : 'No notes yet. Add a note for this book.'}
                                </Text>
                                {notesError && <TouchableOpacity accessibilityRole="button" onPress={() => { void refetchNotes(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>Retry notes</Text></TouchableOpacity>}
                            </View>
                        )}

                    </View>

                    {/* Vault Pages — SDD-03 browse/delete via getPagesForBook */}
                    <View style={[styles.notesSection, { backgroundColor: colors.bgCard }]}>
                        <View style={styles.notesSectionHeader}>
                            <View style={styles.notesTitleRow}>
                                <Ionicons name="bookmark-outline" size={18} color={colors.accent} />
                                <Text style={[styles.notesSectionTitle, { color: colors.textPrimary }]}>Saved Pages</Text>
                            </View>
                        </View>
                        <VaultPagesList userBookId={bookId!} />
                    </View>

                    <BookSection title="My review">
                        {/* Rating & Review */}
                        <RatingInput
                            rating={userBook.rating || 0}
                            onChange={(val) => submitReview({ rating: val })}
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
                                onChangeText={handleReviewText}
                                onBlur={handleSaveReview} // Auto-save on blur
                            />
                            <TouchableOpacity
                                testID="library-review-privacy-toggle"
                                style={styles.publicToggle}
                                accessibilityRole="button"
                                accessibilityLabel="Change review visibility"
                                accessibilityState={{ busy: reviewBusy }}
                                onPress={() => {
                                    const pending = queryClient.getMutationCache().findAll({ mutationKey: reviewMutationKey, exact: true, status: 'pending' })
                                        .map(mutation => mutation.state.variables as ReviewSubmission)
                                        .filter(submission => typeof submission.patch.review_is_public === 'boolean').pop();
                                    const confirmed = queryClient.getQueryData<typeof userBook>(['book', user?.id, bookId]);
                                    submitReview({ review_is_public: !(pending?.patch.review_is_public ?? confirmed?.review_is_public ?? true) });
                                }}
                            >
                                <Ionicons
                                    name={isReviewPublic ? "eye-outline" : "eye-off-outline"}
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 6 }}>
                                    {isReviewPublic ? 'Public Review' : 'Private Review'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {reviewDirty && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Review text has unsaved changes.</Text>}
                        {reviewBusy && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Saving review changes… Rating and visibility shown are the last confirmed settings.</Text>}

                    </BookSection>
                    <BookSection title="Book options">
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
                                    accessibilityLabel="Available for lending"
                                    disabled={toggleLendingMutation.isPending}
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

                    {/* Delete Button */}
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Remove from Library"
                        onPress={() => setShowDeleteModal(true)}
                        style={styles.deleteButtonContainer}
                    >
                        <Text style={styles.deleteText}>Remove from Library</Text>
                    </TouchableOpacity>

                    </BookSection>
                    <BookSection title="Community reviews">
                        {publicReviews.length > 0 && <Text style={{ color: colors.textSecondary }}>{publicReviews.length} public reviews</Text>}
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
                    </BookSection>
                    <BookSection title="Book information">
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
                    </BookSection>
                </ScrollView>

                <DeleteBookModal
                    visible={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={() => deleteMutation.mutate()}
                    isDeleting={deleteMutation.isPending}
                />


            </View>
        </AtmosphericBackground>
    );
}

const styles = StyleSheet.create({
    sectionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    primaryNote: { minHeight: 48, marginHorizontal: 16, marginTop: 16, padding: 14, borderRadius: 16, alignItems: 'center' },
    primaryNoteText: { fontSize: 17, fontWeight: '700' },
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
        minWidth: 48,
        minHeight: 48,
        paddingHorizontal: 12,
        flexDirection: 'row',
        gap: 8,
        alignSelf: 'flex-start',
        borderRadius: 24,
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
        minHeight: 48,
        paddingHorizontal: 8,
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
