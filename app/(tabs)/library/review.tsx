import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { booksService } from '@/features/books/services/booksService';
import { isCurrentReviewActor, type ReviewPatch } from '@/features/books/services/bookReviewService';
import { useReviewWrite, type ReviewWriteOptions } from '@/features/books/reviews/useReviewWrite';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import {
  BookButton,
  BookError,
  BookLoading,
  BookOffline,
  BookScreenHeader,
  useBookFeedback,
} from '@/components/library/ui';
import { RatingInput, ratingValueLabel } from '@/components/library/RatingInput';
import { bookTitleInitials } from '@/components/library/bookDetails/BookCover';
import { classifyBookLoadError } from '@/components/library/bookDetails/classifyBookLoadError';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { notifySaveSuccess, reviewSavedMessage } from '@/features/books/history/saveConfirmation';
import { guardComposerHistory, type ComposerHistoryGuard } from '@/features/books/notes/composerBrowserHistory';

const REVIEW_TEXT_MIN_HEIGHT = 160;
const REVIEW_STAR_SIZE = 40;
const REVIEW_COVER_SIZE = { width: 56, height: 84 };

export default function ReviewScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useLibraryAppearance();
  const { notify, confirm } = useBookFeedback();
  const { user } = useAuth();
  const { isOffline } = useNetworkStatus();

  const userId = user?.id;
  const { actor, mutation, submitReviewAsync } = useReviewWrite({ userId, bookId });

  const { data: userBook, isPending: bookPending, isError: bookIsError, error: bookError, fetchStatus: bookFetchStatus, refetch: refetchBook } = useQuery({
    queryKey: ['book', userId, bookId],
    queryFn: () => booksService.getBookDetails(bookId!),
    enabled: !!userId && !!bookId,
  });

  const savedReview = userBook?.review ?? '';
  const savedIsPublic = userBook?.review_is_public ?? true;
  const savedRating = userBook?.rating ?? 0;

  const [text, setText] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [rating, setRating] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const identityRef = useRef('');
  const [initialized, setInitialized] = useState(false);
  const [allowExit, setAllowExit] = useState(false);
  const departing = useRef(false);
  const approvedExit = useRef<(() => void) | null>(null);
  const browserHistoryGuard = useRef<ComposerHistoryGuard | null>(null);
  const inputRef = useRef<TextInput>(null);
  const dirtyRef = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;
  const visibilityRef = useRef(isPublic);
  visibilityRef.current = isPublic;
  const ratingRef = useRef(rating);
  ratingRef.current = rating;

  // Whitespace-only text counts as empty: with no saved review there is
  // nothing to save, and over a saved review it means removal.
  const textIsBlank = text.trim() === '';
  const effectiveText = textIsBlank ? '' : text;

  const dirty = initialized && (effectiveText !== savedReview || isPublic !== savedIsPublic || rating !== savedRating);
  dirtyRef.current = dirty;
  const saving = mutation.isPending;

  // Initialise once per actor/book; never overwrite dirty local work. Reset
  // and init share one identity-keyed effect so a cached book on mount cannot
  // be initialised by the first pass and then cleared by the second.
  useEffect(() => {
    const identity = `${userId}:${bookId}:${actor?.revision ?? 'none'}`;
    if (identityRef.current === identity) return;
    departing.current = false;
    setAllowExit(false);
    if (!userBook) {
      setInitialized(false);
      return;
    }
    identityRef.current = identity;
    setText(userBook.review ?? '');
    setIsPublic(userBook.review_is_public ?? true);
    setRating(userBook.rating ?? 0);
    setInitialized(true);
  }, [userBook, userId, bookId, actor?.revision]);

  useEffect(() => {
    if (initialized && !saving) inputRef.current?.focus();
  }, [initialized, saving]);

  const finishExit = useCallback(
    (action: () => void) => {
      departing.current = true;
      approvedExit.current = action;
      setAllowExit(true);
    },
    [],
  );

  useEffect(() => {
    if (allowExit && approvedExit.current) {
      const action = approvedExit.current;
      approvedExit.current = null;
      action();
    }
  }, [allowExit]);

  const goToDetails = useCallback(() => {
    const fallback = { pathname: '/(tabs)/library/[bookId]', params: { bookId: bookId! } } as const;
    try {
      const state = (navigation as unknown as { getState?: () => { index: number; routes: readonly { name: string; params?: object }[] } | undefined }).getState?.();
      if (state) {
        for (let index = state.index - 1; index >= 0; index--) {
          const route = state.routes[index];
          const params = route.params as Record<string, unknown> | undefined;
          if (route.name.split('/').at(-1) === '[bookId]' && params?.bookId === bookId) {
            const count = state.index - index;
            if (count === 1) router.back();
            else router.dismiss(count);
            return;
          }
        }
      }
    } catch {
      // Fall through to replace.
    }
    if ((router as unknown as { canGoBack?: () => boolean }).canGoBack?.()) router.back();
    else router.replace(fallback as never);
  }, [bookId, navigation, router]);

  const leave = useCallback(
    async (action: () => void) => {
      if (!dirtyRef.current) {
        finishExit(action);
        return;
      }
      const ok = await confirm({
        title: 'Discard changes?',
        message: "Your changes haven't been saved.",
        keep: 'Keep editing',
        confirm: 'Discard changes',
        destructive: true,
      });
      if (ok) finishExit(action);
    },
    [confirm, finishExit],
  );

  const browserExit = useRef({ protect: false, leave });
  browserExit.current = { protect: !allowExit && !departing.current && dirty, leave };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const guard = guardComposerHistory(
      window,
      () => browserExit.current.protect && (navigation as unknown as { isFocused?: () => boolean }).isFocused?.() !== false,
      (action) => {
        void browserExit.current.leave(action);
      },
    );
    browserHistoryGuard.current = guard;
    return () => {
      guard.dispose();
      browserHistoryGuard.current = null;
    };
  }, [navigation]);

  usePreventRemove(!allowExit && dirty, ({ data }) => {
    browserHistoryGuard.current?.keepEditing();
    void leave(() => navigation.dispatch(data.action));
  });

  const handleBack = useCallback(() => {
    void leave(() => goToDetails());
  }, [leave, goToDetails]);

  const handleSave = useCallback(async () => {
    if (!dirty || isOffline || saving) return;
    if (!bookId || !actor || !isCurrentReviewActor(actor)) return;
    // Retry rebuilds from the live draft so Try again never resends stale values.
    const retryTextPatch = (): ReviewPatch => {
      const current = textRef.current;
      return { review: current.trim() === '' ? '' : current };
    };
    const retryVisibilityPatch = (): ReviewPatch => ({ review_is_public: visibilityRef.current });
    const retryRatingPatch = (): ReviewPatch => ({ rating: ratingRef.current });
    // One toast per Save: every write stays silent and the page toasts once.
    const saveAll = async (steps: { patch: ReviewPatch; opts: ReviewWriteOptions }[], removed: boolean) => {
        const toastMessage = reviewSavedMessage(removed);
        for (const step of steps) {
          await submitReviewAsync(step.patch, { ...step.opts, silent: true, toastMessage });
        if (!isCurrentReviewActor(actor)) return false;
      }
      notifySaveSuccess(notify, toastMessage);
      return true;
    };
    if (textIsBlank && savedReview !== '') {
      const ok = await confirm({
        title: 'Remove your review?',
        message: 'Your written review will be removed. Your star rating stays.',
        keep: 'Keep editing',
        confirm: 'Remove review',
        destructive: true,
      });
      if (!ok) return;
      try {
        const steps: { patch: ReviewPatch; opts: ReviewWriteOptions }[] = [];
        if (rating !== savedRating) {
          steps.push({ patch: { rating }, opts: { getRetryPatch: retryRatingPatch } });
        }
        if (isPublic !== savedIsPublic) {
          steps.push({ patch: { review_is_public: isPublic }, opts: { getRetryPatch: retryVisibilityPatch } });
        }
        steps.push({ patch: { review: '' }, opts: { getRetryPatch: retryTextPatch } });
        if (!(await saveAll(steps, true))) return;
        finishExit(() => goToDetails());
      } catch {
        // Error toast comes from the shared mutation; keep the text.
      }
      return;
    }
    try {
      const steps: { patch: ReviewPatch; opts: ReviewWriteOptions }[] = [];
      if (rating !== savedRating) {
        steps.push({ patch: { rating }, opts: { getRetryPatch: retryRatingPatch } });
      }
      if (effectiveText !== savedReview) {
        steps.push({ patch: { review: effectiveText }, opts: { getRetryPatch: retryTextPatch } });
      }
      if (isPublic !== savedIsPublic) {
        steps.push({ patch: { review_is_public: isPublic }, opts: { getRetryPatch: retryVisibilityPatch } });
      }
      if (!(await saveAll(steps, false))) return;
      finishExit(() => goToDetails());
    } catch {
      // Error toast comes from the shared mutation; keep the text.
    }
  }, [dirty, isOffline, saving, bookId, actor, textIsBlank, effectiveText, savedReview, isPublic, savedIsPublic, rating, savedRating, notify, confirm, submitReviewAsync, finishExit, goToDetails]);

  const backHeader = (
    <BookScreenHeader
      title="Your review"
      backLabel="Back"
      backAccessibilityLabel="Back to Book Details"
      backTestID="library-review-back"
      onBack={handleBack}
    />
  );

  // A gone session (signed out, stale actor) is an error, never a spinner:
  // the dirty draft is shown as not saved and is never written for anyone.
  if (!userId || !actor || !bookId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {backHeader}
        <View style={styles.center}>
          <BookError kind="server" subject="this book" onRetry={() => { void refetchBook(); }} />
        </View>
      </View>
    );
  }

  if (bookPending && bookFetchStatus !== 'paused') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {backHeader}
        <View style={styles.center}>
          <BookLoading variant="note" label="Loading review" />
        </View>
      </View>
    );
  }

  if (isOffline || bookFetchStatus === 'paused') {
    if (!userBook) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
          {backHeader}
          <View style={styles.center}>
            <BookError kind="offline" subject="this book" onRetry={() => { void refetchBook(); }} />
          </View>
        </View>
      );
    }
  }

  if (bookIsError && bookError && !userBook) {
    const kind = classifyBookLoadError(bookError, isOffline);
    if (kind === 'notFound') {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
          {backHeader}
          <View style={styles.center}>
            <BookError kind="notFound" subject="this book" backLabel="Back to Library" onBack={() => router.replace('/(tabs)/library' as never)} />
          </View>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {backHeader}
        <View style={styles.center}>
          <BookError kind="server" subject="this book" onRetry={() => { void refetchBook(); }} />
        </View>
      </View>
    );
  }

  if (!userBook) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        {backHeader}
        <View style={styles.center}>
          <BookLoading variant="note" label="Loading review" />
        </View>
      </View>
    );
  }

  const canSave = dirty && !saving && !isOffline;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {backHeader}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View testID="library-review-body" style={styles.body}>
            {isOffline && <BookOffline message="Offline · Showing saved content." />}
            <View testID="library-review-header" style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]}>
              {userBook.book.cover_url ? (
                <Image
                  testID="library-review-cover"
                  source={{ uri: userBook.book.cover_url }}
                  style={styles.headerCover}
                  contentFit="cover"
                  accessible={false}
                />
              ) : (
                <View
                  testID="library-review-cover-placeholder"
                  accessible={false}
                  aria-hidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.headerCover, styles.headerCoverPlaceholder, { backgroundColor: colors.coverPlaceholder }]}
                >
                  <Text style={[LIBRARY_TEXT.heading, { color: colors.coverPlaceholderInk }]}>
                    {bookTitleInitials(userBook.book.title)}
                  </Text>
                </View>
              )}
              <View style={styles.headerText}>
                <Text
                  accessibilityRole="header"
                  style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}
                >
                  {userBook.book.title}
                </Text>
                {userBook.book.authors?.length ? (
                  <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                    {userBook.book.authors.join(', ')}
                  </Text>
                ) : null}
              </View>
            </View>
            <RatingInput rating={rating} onChange={setRating} disabled={saving} size={REVIEW_STAR_SIZE} />
            <Text testID="library-rating-value" style={[LIBRARY_TEXT.label, { color: colors.textSecondary }]}>
              {ratingValueLabel(rating)}
            </Text>
            <Text accessibilityRole="header" style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>
              Your thoughts
            </Text>
            <TextInput
              ref={inputRef}
              testID="library-review-text"
              accessibilityLabel="Your review"
              placeholder="What did you think?"
              placeholderTextColor={colors.textTertiary}
              multiline
              scrollEnabled={false}
              editable={!saving}
              value={text}
              onChangeText={setText}
              onContentSizeChange={(event) => setContentHeight(event.nativeEvent.contentSize.height)}
              style={[
                LIBRARY_TEXT.bodySerif,
                styles.input,
                {
                  backgroundColor: colors.bgCard,
                  color: colors.textPrimary,
                  borderColor: colors.controlBorder,
                },
                // The box grows with its content so the page scrolls, never the box.
                { height: Math.max(REVIEW_TEXT_MIN_HEIGHT, contentHeight) },
              ]}
            />
            <Text testID="library-review-count" style={[LIBRARY_TEXT.caption, { color: colors.textTertiary }]}>
              {text.length === 1 ? '1 character' : `${text.length} characters`}
            </Text>
              <Pressable
                accessibilityLabel="Public review"
                accessibilityHint="Toggles who can read your review"
                disabled={saving}
                onPress={() => setIsPublic((previous) => !previous)}
                testID="library-review-visibility-row"
              style={[styles.visibilityCard, { backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]}
            >
              <Ionicons
                name={isPublic ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={colors.textSecondary}
                accessible={false}
                aria-hidden
              />
              <View style={styles.visibilityText}>
                <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>
                  Public review
                </Text>
                <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
                  {isPublic ? 'Anyone can read this review.' : 'Only you can read this review.'}
                </Text>
              </View>
              <Switch
                testID="library-review-visibility"
                accessibilityRole="switch"
                accessibilityLabel="Public review"
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: colors.controlBorder, true: colors.accent }}
                // Off thumb uses secondary ink so it stays visible on the card in every theme.
                thumbColor={isPublic ? colors.textOnAccent : colors.textSecondary}
                disabled={saving}
                pointerEvents="none"
              />
            </Pressable>
            {saving && (
              <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                Saving review changes…
              </Text>
            )}
            {!saving && isOffline && dirty && (
              <Text testID="library-review-offline-caption" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                Saving needs a connection. Your text stays here.
              </Text>
            )}
            <BookButton
              label="Save"
              variant="primary"
              disabled={!canSave}
              onPress={() => { void handleSave(); }}
              testID="library-review-save"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: LIBRARY_SPACING.md },
  content: { flexGrow: 1 },
  body: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: LIBRARY_SPACING.md,
    paddingBottom: LIBRARY_SPACING.xl,
    gap: LIBRARY_SPACING.sm,
  },
  input: {
    borderRadius: 12,
    padding: LIBRARY_SPACING.sm,
    minHeight: REVIEW_TEXT_MIN_HEIGHT,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: LIBRARY_SPACING.md,
        borderRadius: LIBRARY_RADIUS.card,
        borderWidth: 1,
        padding: LIBRARY_SPACING.md,
    },
    headerCover: {
        width: REVIEW_COVER_SIZE.width,
        height: REVIEW_COVER_SIZE.height,
        borderRadius: LIBRARY_RADIUS.control,
        overflow: 'hidden',
    },
    headerCoverPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        gap: LIBRARY_SPACING.xxs,
    },
    visibilityCard: {
        minHeight: MIN_TARGET,
        minWidth: MIN_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: LIBRARY_SPACING.sm,
        borderRadius: LIBRARY_RADIUS.card,
        borderWidth: 1,
        paddingHorizontal: LIBRARY_SPACING.md,
        paddingVertical: LIBRARY_SPACING.sm,
    },
    visibilityText: {
        flex: 1,
        gap: LIBRARY_SPACING.xxs,
    },
});
