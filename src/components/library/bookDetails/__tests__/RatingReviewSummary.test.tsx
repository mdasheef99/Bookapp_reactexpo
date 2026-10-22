import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RatingReviewSummary } from '../RatingReviewSummary';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});

function renderSummary(props: Partial<React.ComponentProps<typeof RatingReviewSummary>> = {}) {
  const onOpenReview = jest.fn();
  const ui = render(
    <RatingReviewSummary rating={0} reviewFirstLine="" isPrivate={false} onOpenReview={onOpenReview} {...props} />,
  );
  return { ui, onOpenReview };
}

describe('RatingReviewSummary (display-only stars, D07-24)', () => {
  it('has no radios or radiogroup for the rating', () => {
    const { ui } = renderSummary({ rating: 3 });
    expect(ui.queryAllByRole('radio')).toHaveLength(0);
    expect(ui.queryByLabelText('Your rating')).toBeNull();
  });

  it('labels the display image "Not rated yet" at 0 and "Your rating: 3 of 5" at 3', () => {
    const zero = renderSummary({ rating: 0 });
    const zeroDisplay = zero.ui.getByTestId('book-rating-display');
    expect(zeroDisplay.props.accessibilityRole).toBe('image');
    expect(zeroDisplay.props.accessibilityLabel).toBe('Not rated yet');
    zero.ui.unmount();

    const three = renderSummary({ rating: 3 });
    const display = three.ui.getByTestId('book-rating-display');
    expect(display.props.accessibilityRole).toBe('image');
    expect(display.props.accessibilityLabel).toBe('Your rating: 3 of 5');
  });

  it('fills the stars to match the rating', () => {
    const { ui } = renderSummary({ rating: 3 });
    expect(ui.getAllByText('star', { includeHiddenElements: true })).toHaveLength(3);
    expect(ui.getAllByText('star-outline', { includeHiddenElements: true })).toHaveLength(2);
  });

  it('shows the "Not rated yet" caption only at 0', () => {
    const zero = renderSummary({ rating: 0 });
    expect(zero.ui.getByText('Not rated yet')).toBeOnTheScreen();
    zero.ui.unmount();
    const rated = renderSummary({ rating: 3 });
    expect(rated.ui.queryByText('Not rated yet')).toBeNull();
  });

  it('always shows an Edit button named "Edit your rating and review"', () => {
    for (const props of [{ rating: 0 }, { rating: 3 }, { rating: 0, reviewFirstLine: 'Great' }]) {
      const { ui } = renderSummary(props);
      const button = ui.getByRole('button', { name: 'Edit your rating and review' });
      expect(button.props.testID).toBe('library-review-open');
      expect(ui.getByText('Edit')).toBeOnTheScreen();
      ui.unmount();
    }
  });

  it('opens the review from the button and from the quote; tapping the stars does nothing', () => {
    const { ui, onOpenReview } = renderSummary({ rating: 3, reviewFirstLine: 'A fine book', isPrivate: true });
    fireEvent.press(ui.getByTestId('book-rating-display'));
    expect(onOpenReview).not.toHaveBeenCalled();
    fireEvent.press(ui.getByTestId('library-review-open'));
    expect(onOpenReview).toHaveBeenCalledTimes(1);
    fireEvent.press(ui.getByTestId('library-review-quote'));
    expect(onOpenReview).toHaveBeenCalledTimes(2);
    expect(ui.getByText('Private')).toBeOnTheScreen();
  });

  it('shows no quote without a review', () => {
    const { ui } = renderSummary({ rating: 3 });
    expect(ui.queryByTestId('library-review-quote')).toBeNull();
  });

  it('disabled blocks both presses', () => {
    const { ui, onOpenReview } = renderSummary({ rating: 3, reviewFirstLine: 'A fine book', disabled: true });
    expect(ui.getByTestId('library-review-open').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(ui.getByTestId('library-review-open'));
    fireEvent.press(ui.getByTestId('library-review-quote'));
    expect(onOpenReview).not.toHaveBeenCalled();
  });
});
