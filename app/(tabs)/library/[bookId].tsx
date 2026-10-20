import React, { useState, useCallback, useEffect, useRef, useId } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Platform, AccessibilityInfo, findNodeHandle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient, useMutationState } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { booksService } from '@/features/books/services/booksService';
import { bookReviewService, currentReviewActor, isCurrentReviewActor, ReviewActor, ReviewPatch, BookReviewFields } from '@/features/books/services/bookReviewService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { noteKeys } from '@/features/books/notes/manualNoteContract';
import { openNoteComposer } from '@/features/books/notes/noteNavigation';
import { useNoteOperations } from '@/features/books/notes/useManualNotes';
import { conditionLabel, ownershipLabel } from '@/features/books/utils/libraryLabels';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLibraryAppearance, LIBRARY_SPACING, LIBRARY_RADIUS, MIN_TARGET } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton, BookScreenHeader, BookLoading, BookError, BookOffline, useBookFeedback } from '@/components/library/ui';
import { BookCover } from '@/components/library/bookDetails/BookCover';
import { DetailRow } from '@/components/library/bookDetails/DetailRow';
import { NotePassages } from '@/components/library/bookDetails/NotePassages';
import { classifyBookLoadError } from '@/components/library/bookDetails/classifyBookLoadError';
import {
    COLUMN_MAX_WIDTH,
    ICON_SIZE,
    MAX_SCORE,
    PRIVACY_ICON_SIZE,
    REVIEW_INPUT_HEIGHT,
} from '@/components/library/bookDetails/bookDetailsTokens';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
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
import { VaultPagesList, useVaultPages } from '@/components/library/VaultPagesList';
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

type OpenRowsState = {
    review?: boolean;
    saved?: boolean;
    info?: boolean;
    ownership?: boolean;
    community?: boolean;
};

export default function BookDetailScreen() {
    const { notify } = useBookFeedback();
    const { bookId } = useLocalSearchParams<{ bookId: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const colors = useLibraryAppearance();
    const { user } = useAuth();
    useNoteOperations(user?.id ?? '', bookId);
    const { isOffline } = useNetworkStatus();

    const [reviewText, setReviewText] = useState('');
    const [reviewDirty, setReviewDirty] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [openRows, setOpenRows] = useState<OpenRowsState>({});
    const editorId = useId();
    const requestSequence = useRef(0);
    const reviewDraft = useRef({ identity: '', revision: 0, dirty: false, textRequest: '' });
    const [optimisticStatus, setOptimisticStatus] = useState<ReadingStatus | null>(null);
    const removeTrigger = useRef<View>(null);
    const pageRef = useRef<View>(null);

    useEffect(() => {
        setOptimisticStatus(null);
    }, [user?.id, bookId]);

    useEffect(() => {
        if (Platform.OS !== 'web' || !pageRef.current) return;
        const page = pageRef.current as unknown as { inert: boolean };
        page.inert = showDeleteModal;
        return () => {
            page.inert = false;
        };
    }, [showDeleteModal]);

    const wasDeleteOpen = useRef(showDeleteModal);
    useEffect(() => {
        if (wasDeleteOpen.current && !showDeleteModal) {
            if (Platform.OS === 'web') {
                removeTrigger.current?.focus();
            } else {
                const node = findNodeHandle(removeTrigger.current);
                if (node) AccessibilityInfo.setAccessibilityFocus(node);
            }
        }
        wasDeleteOpen.current = showDeleteModal;
    }, [showDeleteModal]);

    const handleBackPress = useCallback(() => {
        navigateBackOrFallback(router, '/(tabs)/library');
    }, [router]);

    // Fetch Book Details
    const { data: userBook, isPending: bookPending, isError: bookIsError, error: bookError, fetchStatus: bookFetchStatus, refetch: refetchBook } = useQuery({
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
        data: publicReviews,
        isPending: publicReviewsPending,
        fetchStatus: publicReviewsFetchStatus,
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

    const { data: vaultPages, isLoading: vaultPagesLoading } = useVaultPages(bookId ?? '');

    // Mutation helpers
    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['library'] });
        queryClient.invalidateQueries({ queryKey: ['book', user?.id, bookId] });
    };

    // --- Mutations ---

    const updateStatusMutation = useMutation({
        mutationFn: ({ status, entryId }: { status: ReadingStatus; userId: string | undefined; entryId: string }) => booksService.updateReadingStatus(entryId, status),
        onSuccess: (_data, { status, userId, entryId }) => {
            const key = ['book', userId, entryId];
            queryClient.setQueryData<typeof userBook>(key, (prev: typeof userBook) => prev ? { ...prev, reading_status: status } : prev);
            if (userId === user?.id && entryId === bookId) setOptimisticStatus(null);
            queryClient.invalidateQueries({ queryKey: ['library'] });
            queryClient.invalidateQueries({ queryKey: key });
        },
        onError: (_error, { userId, entryId }) => {
            if (userId !== user?.id || entryId !== bookId) return;
            setOptimisticStatus(null);
            notify({ kind: 'error', message: "Couldn't update reading status." });
        },
    });

    const updateOwnershipMutation = useMutation({
        mutationFn: (ownership: Ownership) => booksService.updateOwnership(bookId!, ownership),
        onSuccess: invalidateQueries,
        onError: () => {
            notify({ kind: 'error', message: "Couldn't update ownership." });
        },
    });

    const updateConditionMutation = useMutation({
        mutationFn: (condition: Condition) => booksService.updateCondition(bookId!, condition),
        onSuccess: invalidateQueries,
        onError: () => {
            notify({ kind: 'error', message: "Couldn't update condition." });
        },
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
            if (typeof submission.patch.review === 'string' && isCurrentReviewActor(submission.actor) &&
                reviewDraft.current.revision === submission.textRevision) notify({ kind: 'success', message: 'Review saved!' });
        },
        onError: (err: any, submission) => {
            if (!isCurrentReviewActor(submission.actor)) return;
            notify({ kind: 'error', message: err.message || 'Failed to save review' });
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

    const deleteMutation = useMutation({
        mutationFn: () => booksService.removeFromLibrary(bookId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['library'] });
            handleBackPress();
        },
        onError: (err: any) => {
            notify({ kind: 'error', message: err.message || 'Failed to remove book' });
        }
    });

    // --- Handlers ---

    const submitReview = (patch: ReviewPatch) => {
        if (!userBook || !reviewActor || !isCurrentReviewActor(reviewActor)) return;
        const submission: ReviewSubmission = { actor: reviewActor, entryId: bookId, patch, editorId,
            requestId: `${editorId}:${++requestSequence.current}`, textRevision: reviewDraft.current.revision };
        if (typeof patch.review === 'string') reviewDraft.current.textRequest = submission.requestId;
        updateRatingMutation.mutate(submission);
    };
    const handleSaveReview = () => { if (reviewDraft.current.dirty) submitReview({ review: reviewText }); };
    const handleReviewText = (text: string) => {
        reviewDraft.current.revision++;
        reviewDraft.current.textRequest = '';
        reviewDraft.current.dirty = true;
        setReviewDirty(true);
        setReviewText(text);
    };

    const handleStatusChange = useCallback((val: ReadingStatus) => {
        if (!userBook || val === userBook.reading_status) return;
        setOptimisticStatus(val);
        updateStatusMutation.mutate({ status: val, userId: user?.id, entryId: bookId });
    }, [userBook, updateStatusMutation, user?.id, bookId]);

    const toggleRow = (id: keyof OpenRowsState) => {
        setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleToggleReview = () => {
        // Blur can submit before useMutationState has rendered its pending snapshot.
        const textRequestPending = queryClient.getMutationCache().findAll({ mutationKey: reviewMutationKey, exact: true, status: 'pending' })
            .some(write => (write.state.variables as ReviewSubmission | undefined)?.requestId === reviewDraft.current.textRequest);
        if (openRows.review && reviewDraft.current.dirty && !textRequestPending && !isOffline) {
            handleSaveReview();
        }
        setOpenRows((prev) => ({ ...prev, review: !prev.review }));
    };

    const backHeader = (
        <BookScreenHeader backLabel="Library" backAccessibilityLabel="Back to Library" backTestID="library-book-back-button" onBack={handleBackPress} />
    );

    if (userBook) {
        const displayedStatus = (optimisticStatus ?? userBook.reading_status) as ReadingStatus;
        const statusPending = updateStatusMutation.isPending;
        const statusDisabled = statusPending || isOffline;

        const reviewFirstLine = userBook.review?.split('\n')[0] || '';
        const hasConfirmedReview = Boolean(reviewFirstLine);
        const showSavedPages = !vaultPagesLoading && Array.isArray(vaultPages) && vaultPages.length > 0;

        const publishedYear = book.published_date ? String(book.published_date).slice(0, 4) : '';
        const hasBookInfo = Boolean(
            book.page_count || book.publisher || publishedYear || book.isbn_13 || book.description,
        );

        const showCondition =
            (userBook.ownership === 'owned' || userBook.ownership === 'lent_out') && Boolean(userBook.condition);
        const ownershipSecondary = showCondition
            ? `${ownershipLabel(userBook.ownership)} · ${conditionLabel(userBook.condition)}`
            : ownershipLabel(userBook.ownership);

        const bodyStyle = [LIBRARY_TEXT.body, { color: colors.textPrimary }];

        return (
            <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
                <View
                    ref={pageRef}
                    testID="book-page"
                    aria-hidden={showDeleteModal}
                    importantForAccessibility={showDeleteModal ? 'no-hide-descendants' : 'auto'}
                    style={topStyles.page}
                >
                    {backHeader}
                    <ScrollView contentContainerStyle={topStyles.content}>
                        {isOffline && <BookOffline message="Offline · Showing saved content." />}
                        <BookCover title={book.title} authors={book.authors ?? []} coverUrl={book.cover_url} />
                        <StatusSelector status={displayedStatus} onChange={handleStatusChange} disabled={statusDisabled} busy={statusPending} />
                        <NotePassages notes={notes} isPending={notesLoading} isError={notesError} onRetry={() => { void refetchNotes(); }} />
                        <View style={topStyles.action}>
                            {isOffline && (
                                <Text testID="book-connection-notice" style={[LIBRARY_TEXT.body, topStyles.connectionNotice, { color: colors.textSecondary }]}>
                                    Changes need a connection.
                                </Text>
                            )}
                            <BookButton label="Add note" variant="primary" disabled={isOffline} onPress={() => openNoteComposer(router, user!.id, bookId, 'book')} />
                        </View>

                        {bookIsError && (
                            <View style={topStyles.refreshNotice}>
                                <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Couldn&apos;t refresh.</Text>
                                <BookButton label="Try again" variant="text" onPress={() => { void refetchBook(); }} />
                            </View>
                        )}

                        <View style={topStyles.rows}>
                            {notes && notes.length > 0 && (
                                <DetailRow
                                    id="notes"
                                    label="All notes"
                                    link
                                    onPress={() => router.push({ pathname: '/(tabs)/library/notes', params: { userBookId: bookId } })}
                                />
                            )}

                            <DetailRow
                                id="review"
                                label="Your review"
                                secondary={hasConfirmedReview ? reviewFirstLine : 'No review yet.'}
                                absent={!hasConfirmedReview}
                                expanded={Boolean(openRows.review)}
                                onPress={handleToggleReview}
                            >
                                <RatingInput
                                    rating={userBook.rating || 0}
                                    onChange={(val) => submitReview({ rating: val })}
                                    disabled={isOffline}
                                />
                                <View>
                                    <TextInput
                                        style={[
                                            LIBRARY_TEXT.body,
                                            topStyles.reviewInput,
                                            {
                                                backgroundColor: colors.bgSecondary,
                                                color: colors.textPrimary,
                                                borderColor: colors.controlBorder,
                                            },
                                        ]}
                                        testID="library-review-input"
                                        accessibilityLabel="Your review"
                                        placeholder="Write your thoughts…"
                                        placeholderTextColor={colors.textTertiary}
                                        multiline
                                        editable={!isOffline}
                                        value={reviewText}
                                        onChangeText={handleReviewText}
                                        onBlur={isOffline ? undefined : handleSaveReview}
                                    />
                                    <Pressable
                                        testID="library-review-privacy-toggle"
                                        style={topStyles.publicToggle}
                                        accessibilityRole="button"
                                        accessibilityLabel="Change review visibility"
                                        accessibilityState={{ busy: reviewBusy, disabled: isOffline }}
                                        aria-busy={reviewBusy}
                                        disabled={isOffline}
                                        onPress={() => {
                                            const pending = queryClient.getMutationCache().findAll({ mutationKey: reviewMutationKey, exact: true, status: 'pending' })
                                                .map(mutation => mutation.state.variables as ReviewSubmission)
                                                .filter(submission => typeof submission.patch.review_is_public === 'boolean').pop();
                                            const confirmed = queryClient.getQueryData<typeof userBook>(['book', user?.id, bookId]);
                                            submitReview({ review_is_public: !(pending?.patch.review_is_public ?? confirmed?.review_is_public ?? true) });
                                        }}
                                    >
                                        <Ionicons
                                            name={isReviewPublic ? 'eye-outline' : 'eye-off-outline'}
                                            size={PRIVACY_ICON_SIZE}
                                            color={colors.textSecondary}
                                            accessible={false}
                                            aria-hidden
                                        />
                                        <Text style={[LIBRARY_TEXT.label, { color: colors.textSecondary }]}>
                                            {isReviewPublic ? 'Public Review' : 'Private Review'}
                                        </Text>
                                    </Pressable>
                                </View>
                                {reviewDirty && (
                                    <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                                        Review text has unsaved changes.
                                    </Text>
                                )}
                                {reviewBusy && (
                                    <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                                        Saving review changes… Rating and visibility shown are the last confirmed settings.
                                    </Text>
                                )}
                            </DetailRow>

                            {showSavedPages && (
                                <DetailRow
                                    id="saved"
                                    label="Saved pages"
                                    secondary={`${vaultPages.length} ${vaultPages.length === 1 ? 'page' : 'pages'}`}
                                    expanded={Boolean(openRows.saved)}
                                    onPress={() => toggleRow('saved')}
                                >
                                    <VaultPagesList userBookId={bookId!} disabled={isOffline} />
                                </DetailRow>
                            )}

                            <DetailRow
                                id="info"
                                label="Book information"
                                secondary={hasBookInfo ? undefined : 'No details'}
                                absent={!hasBookInfo}
                                expanded={hasBookInfo ? Boolean(openRows.info) : undefined}
                                onPress={hasBookInfo ? () => toggleRow('info') : undefined}
                            >
                                {book.page_count ? <Text style={bodyStyle}>{`Pages · ${book.page_count}`}</Text> : null}
                                {book.publisher ? <Text style={bodyStyle}>{`Publisher · ${book.publisher}`}</Text> : null}
                                {publishedYear ? <Text style={bodyStyle}>{`Published · ${publishedYear}`}</Text> : null}
                                {book.isbn_13 ? <Text style={bodyStyle}>{`ISBN-13 · ${book.isbn_13}`}</Text> : null}
                                {book.description ? <Text style={bodyStyle}>{book.description}</Text> : null}
                            </DetailRow>

                            <DetailRow
                                id="ownership"
                                label="Ownership & condition"
                                secondary={ownershipSecondary}
                                expanded={Boolean(openRows.ownership)}
                                onPress={() => toggleRow('ownership')}
                            >
                                <OwnershipSelector
                                    ownership={userBook.ownership as Ownership}
                                    onChange={(val) => {
                                        if (val === userBook.ownership) return;
                                        updateOwnershipMutation.mutate(val);
                                    }}
                                    disabled={updateOwnershipMutation.isPending || isOffline}
                                />
                                {(userBook.ownership === 'owned' || userBook.ownership === 'lent_out') && (
                                    <ConditionPicker
                                        condition={userBook.condition as Condition}
                                        onChange={(val) => {
                                            if (val === userBook.condition) return;
                                            updateConditionMutation.mutate(val);
                                        }}
                                        disabled={updateConditionMutation.isPending || isOffline}
                                    />
                                )}
                            </DetailRow>

                            {publicReviews && publicReviews.length > 0 ? (
                                <DetailRow
                                    id="community"
                                    label="Community reviews"
                                    secondary={`${publicReviews.length} ${publicReviews.length === 1 ? 'review' : 'reviews'}`}
                                    expanded={Boolean(openRows.community)}
                                    onPress={() => toggleRow('community')}
                                >
                                    {publicReviews.map((review, index) => {
                                        const authorName = getReviewerName(review);
                                        const authorHandle = review.author.username?.trim();
                                        return (
                                            <View
                                                key={review.user_book_id}
                                                testID={`community-review-${review.user_book_id}`}
                                                style={[
                                                    index > 0 && topStyles.communityReviewDivider,
                                                    index > 0 && { borderColor: colors.divider },
                                                    topStyles.communityReviewItem,
                                                ]}
                                            >
                                                <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>
                                                    {authorName}
                                                </Text>
                                                {authorHandle ? (
                                                    <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
                                                        @{authorHandle}
                                                    </Text>
                                                ) : null}
                                                <Text style={[LIBRARY_TEXT.caption, { color: colors.textTertiary }]}>
                                                    {formatReviewDate(review.created_at)}
                                                </Text>
                                                {typeof review.rating === 'number' && review.rating > 0 && (
                                                    <View
                                                        accessible
                                                        accessibilityLabel={`Rated ${review.rating} of ${MAX_SCORE}`}
                                                        style={topStyles.stars}
                                                    >
                                                        {Array.from({ length: MAX_SCORE }, (_, starIndex) => (
                                                            <Ionicons
                                                                key={starIndex}
                                                                name={starIndex < review.rating! ? 'star' : 'star-outline'}
                                                                size={ICON_SIZE}
                                                                color={colors.textPrimary}
                                                                accessible={false}
                                                                aria-hidden
                                                            />
                                                        ))}
                                                    </View>
                                                )}
                                                <Text style={bodyStyle}>{review.review}</Text>
                                            </View>
                                        );
                                    })}
                                </DetailRow>
                            ) : publicReviewsPending ? (
                                <DetailRow id="community" label="Community reviews" secondary={isOffline || publicReviewsFetchStatus === 'paused' ? 'Unavailable offline.' : 'Loading…'} />
                            ) : publicReviewsError ? (
                                <DetailRow id="community" label="Community reviews" secondary="Unavailable right now." />
                            ) : (
                                <DetailRow id="community" label="Community reviews" secondary="None yet" absent />
                            )}
                        </View>

                        <View style={topStyles.remove}>
                            <BookButton
                                ref={removeTrigger}
                                label="Remove from library"
                                variant="text"
                                disabled={isOffline}
                                onPress={() => setShowDeleteModal(true)}
                            />
                        </View>
                    </ScrollView>
                </View>

                <DeleteBookModal
                    visible={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={() => { if (!isOffline) deleteMutation.mutate(); }}
                    isDeleting={deleteMutation.isPending}
                    disabled={isOffline}
                    bookTitle={book.title}
                />
            </View>
        );
    }

    if (!user?.id || !bookId || (bookPending && bookFetchStatus !== 'paused')) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
                {backHeader}
                <View style={topStyles.centerState}>
                    <BookLoading variant="details" label="Loading book" />
                </View>
            </View>
        );
    }

    if (isOffline || bookFetchStatus === 'paused') {
        return (
            <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
                {backHeader}
                <View style={topStyles.centerState}>
                    <BookError kind="offline" subject="this book" onRetry={() => { void refetchBook(); }} />
                </View>
            </View>
        );
    }

    if (bookIsError && bookError) {
        const kind = classifyBookLoadError(bookError, isOffline);
        if (kind === 'notFound') {
            return (
                <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
                    {backHeader}
                    <View style={topStyles.centerState}>
                        <BookError kind="notFound" subject="this book" backLabel="Back to Library" onBack={handleBackPress} />
                    </View>
                </View>
            );
        }
        return (
            <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
                {backHeader}
                <View style={topStyles.centerState}>
                    <BookError kind="server" subject="this book" onRetry={() => { void refetchBook(); }} />
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
            {backHeader}
            <View style={topStyles.centerState}>
                <BookLoading variant="details" label="Loading book" />
            </View>
        </View>
    );
}

const topStyles = StyleSheet.create({
    page: {
        flex: 1,
    },
    content: {
        width: '100%',
        maxWidth: COLUMN_MAX_WIDTH,
        alignSelf: 'center',
        paddingHorizontal: LIBRARY_SPACING.md,
        paddingBottom: LIBRARY_SPACING.xl,
    },
    refreshNotice: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: LIBRARY_SPACING.sm,
        marginBottom: LIBRARY_SPACING.md,
    },
    action: {
        marginTop: LIBRARY_SPACING.lg,
    },
    connectionNotice: {
        marginBottom: LIBRARY_SPACING.xs,
    },
    rows: {
        marginTop: LIBRARY_SPACING.xl,
    },
    reviewInput: {
        borderRadius: LIBRARY_RADIUS.control,
        padding: LIBRARY_SPACING.sm,
        height: REVIEW_INPUT_HEIGHT,
        textAlignVertical: 'top',
        borderWidth: 1,
    },
    publicToggle: {
        minHeight: MIN_TARGET,
        minWidth: MIN_TARGET,
        paddingHorizontal: LIBRARY_SPACING.xs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: LIBRARY_SPACING.xs,
        marginTop: LIBRARY_SPACING.xs,
        alignSelf: 'flex-end',
    },
    communityReviewItem: {
        gap: LIBRARY_SPACING.xxs,
    },
    communityReviewDivider: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: LIBRARY_SPACING.md,
    },
    stars: {
        flexDirection: 'row',
        gap: LIBRARY_SPACING.xxs,
    },
    remove: {
        alignSelf: 'center',
        marginTop: LIBRARY_SPACING.lg,
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: LIBRARY_SPACING.md,
    },
});
