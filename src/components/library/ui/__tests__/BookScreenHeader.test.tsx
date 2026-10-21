import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLibraryAppearance, MIN_TARGET } from '@/components/library/LibraryAppearance';
import { BookScreenHeader } from '@/components/library/ui';

const PHASES = ['daylight', 'golden', 'midnight'] as const;
let mockPhase: (typeof PHASES)[number] = 'daylight';
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: mockPhase, colors: {} }) }));
jest.mock('react-native-safe-area-context');

describe.each(PHASES)('BookScreenHeader in %s', phase => {
  beforeEach(() => {
    mockPhase = phase;
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 24, right: 0, bottom: 12, left: 0 });
  });

  it('keeps the existing header layout and palette, with a named Back destination', () => {
    const colors = getLibraryAppearance(phase);
    const onBack = jest.fn();
    const tree = render(<BookScreenHeader title="Notes" bookTitle="A book" backLabel="Back to Library" onBack={onBack} />);
    const back = tree.getByRole('button', { name: 'Back to Library' });
    expect(back.props.accessibilityLabel).toBe('Back to Library');
    expect(StyleSheet.flatten(back.props.style)).toMatchObject({
      minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center', alignSelf: 'flex-start',
    });
    expect(StyleSheet.flatten(tree.getByText('‹ Back to Library').props.style)).toEqual({ fontSize: 16, fontWeight: '600', color: colors.accent });
    expect(tree.getByRole('header').props.children).toBe('Notes');
    expect(StyleSheet.flatten(tree.getByRole('header').props.style)).toEqual({ fontSize: 25, fontWeight: '700', color: colors.textPrimary });
    expect(StyleSheet.flatten(tree.getByText('A book').props.style)).toEqual({ fontSize: 16, lineHeight: 24, color: colors.textSecondary });
    expect(StyleSheet.flatten(tree.UNSAFE_getAllByType(View)[0].props.style)).toEqual({
      paddingTop: 32, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 8, borderColor: colors.divider,
    });
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders without a book title and follows updated safe-area insets', () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    const tree = render(<BookScreenHeader title="Library" backLabel="Back to Home" onBack={jest.fn()} />);
    expect(tree.getByRole('header').props.children).toBe('Library');
    expect(tree.queryByText('A book')).toBeNull();
    // Back label + title only: dropping the `!!bookTitle &&` guard would add an empty third Text row.
    expect(tree.UNSAFE_getAllByType(Text)).toHaveLength(2);
    expect(StyleSheet.flatten(tree.UNSAFE_getAllByType(View)[0].props.style).paddingTop).toBe(8);
  });

  it('renders back-only with no title text and no bottom border', () => {
    const colors = getLibraryAppearance(phase);
    const onBack = jest.fn();
    const tree = render(<BookScreenHeader backLabel="Back to Library" backTestID="library-book-back-button" onBack={onBack} />);
    const back = tree.getByRole('button', { name: 'Back to Library' });
    expect(back.props.testID).toBe('library-book-back-button');
    expect(tree.queryByRole('header')).toBeNull();
    expect(tree.UNSAFE_getAllByType(Text)).toHaveLength(1);
    expect(tree.getByText('‹ Back to Library')).toBeTruthy();
    expect(StyleSheet.flatten(tree.UNSAFE_getAllByType(View)[0].props.style)).toMatchObject({
      borderBottomWidth: 0, borderColor: colors.divider,
    });
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('can show a short visible Back label with a fuller accessible name', () => {
    const tree = render(<BookScreenHeader backLabel="Library" backAccessibilityLabel="Back to Library" onBack={jest.fn()} />);
    expect(tree.getByText('‹ Library')).toBeTruthy();
    expect(tree.getByRole('button', { name: 'Back to Library' })).toBeTruthy();
    expect(tree.queryByRole('button', { name: 'Library' })).toBeNull();
  });

  it('keeps the bottom border when a title is given even with a back testID', () => {
    const colors = getLibraryAppearance(phase);
    const tree = render(<BookScreenHeader title="Notes" backLabel="Back to Library" backTestID="library-book-back-button" onBack={jest.fn()} />);
    expect(tree.getByRole('header').props.children).toBe('Notes');
    expect(tree.getByRole('button', { name: 'Back to Library' }).props.testID).toBe('library-book-back-button');
    expect(StyleSheet.flatten(tree.UNSAFE_getAllByType(View)[0].props.style).borderBottomWidth).toBe(1);
    expect(StyleSheet.flatten(tree.UNSAFE_getAllByType(View)[0].props.style).borderColor).toBe(colors.divider);
  });
});
