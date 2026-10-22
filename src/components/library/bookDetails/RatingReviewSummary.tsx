import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton } from '../ui/BookButton';
import { ICON_SIZE, MAX_SCORE, ROW_SUMMARY_LINES } from './bookDetailsTokens';

export interface RatingReviewSummaryProps {
  rating: number;
  /** First non-blank review line, or '' when there is no review. */
  reviewFirstLine: string;
  isPrivate: boolean;
  onOpenReview: () => void;
  disabled?: boolean;
}

/**
 * Rating + review entry directly under the cover (SDD-07 §14.2b, D07-23).
 * Always visible: the stars never hide, even while the Finished panel shows.
 * The stars are display-only here; the rating is changed on the review page
 * (owner, 2026-10-23: tapping stars on Book Details made it too easy to change).
 */
export function RatingReviewSummary({
  rating,
  reviewFirstLine,
  isPrivate,
  onOpenReview,
  disabled = false,
}: RatingReviewSummaryProps) {
  const colors = useLibraryAppearance();
  const hasReview = reviewFirstLine.length > 0;

  return (
    <View testID="book-rating-review" style={styles.block}>
      <View
        testID="book-rating-display"
        accessible
        accessibilityRole="image"
        accessibilityLabel={rating > 0 ? `Your rating: ${rating} of ${MAX_SCORE}` : 'Not rated yet'}
        style={styles.stars}
      >
        {Array.from({ length: MAX_SCORE }, (_, index) => (
          <Ionicons
            key={index}
            name={index < rating ? 'star' : 'star-outline'}
            size={ICON_SIZE}
            color={index < rating ? colors.textPrimary : colors.textSecondary}
            accessible={false}
            aria-hidden
          />
        ))}
      </View>
      {rating > 0 ? null : (
        // The stars already announce "Not rated yet"; this caption is for sighted readers only.
        <Text accessible={false} importantForAccessibility="no" aria-hidden style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Not rated yet</Text>
      )}
      <BookButton
        label="Edit"
        accessibilityLabel="Edit your rating and review"
        variant="text"
        disabled={disabled}
        onPress={onOpenReview}
        testID="library-review-open"
      />
      {hasReview ? (
        <Pressable
          testID="library-review-quote"
          accessibilityRole="button"
          accessibilityLabel={`Open your review, ${reviewFirstLine}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onOpenReview}
          style={styles.quote}
        >
          <Text
            numberOfLines={ROW_SUMMARY_LINES}
            ellipsizeMode="tail"
            style={[LIBRARY_TEXT.bodySerif, styles.quoteText, { color: colors.textPrimary }]}
          >
            {reviewFirstLine}
          </Text>
          {isPrivate ? (
            <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Private</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
    paddingVertical: LIBRARY_SPACING.sm,
    minWidth: 0,
    maxWidth: '100%',
  },
  stars: {
    flexDirection: 'row',
    gap: LIBRARY_SPACING.xs,
  },
  quote: {
    alignItems: 'center',
    gap: LIBRARY_SPACING.xxs,
    minWidth: 0,
    maxWidth: '100%',
  },
  quoteText: {
    textAlign: 'center',
  },
});
