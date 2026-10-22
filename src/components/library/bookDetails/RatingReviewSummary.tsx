import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { RatingInput } from '@/components/library';
import { BookButton } from '../ui/BookButton';
import { ROW_SUMMARY_LINES } from './bookDetailsTokens';

export interface RatingReviewSummaryProps {
  rating: number;
  onRate: (rating: number) => void;
  /** First non-blank review line, or '' when there is no review. */
  reviewFirstLine: string;
  isPrivate: boolean;
  onOpenReview: () => void;
  disabled?: boolean;
}

/**
 * Rating + review entry directly under the cover (SDD-07 §14.2b, D07-23).
 * Always visible: the stars never hide, even while the Finished panel shows.
 */
export function RatingReviewSummary({
  rating,
  onRate,
  reviewFirstLine,
  isPrivate,
  onOpenReview,
  disabled = false,
}: RatingReviewSummaryProps) {
  const colors = useLibraryAppearance();
  const hasReview = reviewFirstLine.length > 0;

  return (
    <View testID="book-rating-review" style={styles.block}>
      <RatingInput rating={rating} onChange={onRate} disabled={disabled} centered />
      <BookButton
        label={hasReview ? 'Edit review' : 'Write a review'}
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
