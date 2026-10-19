import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { BookCover, bookTitleInitials } from '../BookCover';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('expo-image', () => ({ Image: 'Image' }));

describe('Flow A fix round 1 cover', () => {
  it('R8 derives initials for stop-word-only, ordinary, padded and empty titles', () => {
    for (const [title, expected] of [
      ['The', 'T'], ['To The', 'TT'], ['To Be', 'B'], ['Be Here Now', 'BH'], ['The Hobbit', 'H'], ['  Dune  ', 'D'], ['', ''],
    ]) expect(bookTitleInitials(title)).toBe(expected);
  });

  it('R8 resets a measured long title when the title changes at the same font scale', () => {
    const ui = render(<BookCover title="A long title" authors={[]} coverUrl={null} />);
    fireEvent(ui.getByTestId('book-cover-row'), 'layout', { nativeEvent: { layout: { width: 600 } } });
    fireEvent(ui.getByText('A long title'), 'textLayout', { nativeEvent: { lines: Array(5).fill({ text: 'line' }) } });
    expect(StyleSheet.flatten(ui.getByTestId('book-cover-row').props.style).flexDirection).toBe('column');
    ui.rerender(<BookCover title="Dune" authors={[]} coverUrl={null} />);
    expect(StyleSheet.flatten(ui.getByTestId('book-cover-row').props.style).flexDirection).toBe('row');
  });
});
