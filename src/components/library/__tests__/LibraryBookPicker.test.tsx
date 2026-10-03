import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FlatList, Modal, StyleSheet } from 'react-native';
import { LibraryBookPicker } from '../LibraryBookPicker';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));

const books = [{ id: 'first', ownership: 'owned', reading_status: 'reading', book: { title: 'Duplicate title', authors: ['First Author'] } },
    { id: 'second', ownership: 'wishlist', reading_status: 'completed', book: { title: 'Duplicate title', authors: null } }];

describe('review R5 accessible book chooser', () => {
    it('uses separate 44px controls and full-width book rows for both pointer and keyboard activation', () => {
        const onPress = jest.fn();
        const { getByTestId, getByLabelText, queryByTestId, UNSAFE_getByType } = render(<LibraryBookPicker books={books} onBookPress={onPress} />);
        expect(queryByTestId('library-book-picker-panel')).toBeNull();
        const opener = getByTestId('library-book-picker-open');
        expect(StyleSheet.flatten(opener.props.style).minHeight).toBeGreaterThanOrEqual(44);
        fireEvent.press(opener);
        expect(getByTestId('library-book-picker-panel').props.accessibilityViewIsModal).toBe(true);
        expect(getByLabelText('Open Duplicate title by First Author')).toBeTruthy();
        expect(StyleSheet.flatten(getByTestId('library-book-picker-close').props.style).minWidth).toBe(44);
        expect(StyleSheet.flatten(UNSAFE_getByType(FlatList).props.style).flex).toBe(1);
        const target = getByTestId('library-book-picker-entry-second');
        expect(StyleSheet.flatten(target.props.style).minHeight).toBe(64);
        fireEvent.press(target);
        expect(onPress).toHaveBeenCalledWith(books[1]);
        expect(queryByTestId('library-book-picker-panel')).toBeNull();
    });

    it('keeps the active book caption complete while preserving the title chooser action', () => {
        const activeBook = {
            id: 'active', ownership: 'owned', reading_status: 'reading',
            book: { title: 'A Very Long Title That Must Remain Fully Visible', authors: ['First Author', 'Second Author'] },
        };
        const { getByTestId, getByLabelText } = render(<LibraryBookPicker books={books} activeBook={activeBook} onBookPress={jest.fn()} />);
        const opener = getByLabelText('Highlighted book: A Very Long Title That Must Remain Fully Visible by First Author, Second Author. Opens the title chooser.');
        expect(StyleSheet.flatten(opener.props.style).minHeight).toBeGreaterThanOrEqual(44);
        expect(getByTestId('library-active-book-caption-title').props.children).toBe(activeBook.book.title);
        expect(getByTestId('library-active-book-caption-title').props.numberOfLines).toBeUndefined();
        expect(getByTestId('library-active-book-caption-author').props.children).toBe('First Author, Second Author');
        fireEvent.press(opener);
        expect(getByTestId('library-book-picker-panel').props.accessibilityViewIsModal).toBe(true);
    });

    it('closes without navigation through the close button and native Back/Escape request', () => {
        const onPress = jest.fn();
        const { getByTestId, queryByTestId, UNSAFE_getByType } = render(<LibraryBookPicker books={books} onBookPress={onPress} />);
        fireEvent.press(getByTestId('library-book-picker-open'));
        fireEvent.press(getByTestId('library-book-picker-close'));
        expect(queryByTestId('library-book-picker-panel')).toBeNull();
        fireEvent.press(getByTestId('library-book-picker-open'));
        fireEvent(UNSAFE_getByType(Modal), 'requestClose');
        expect(queryByTestId('library-book-picker-panel')).toBeNull();
        expect(onPress).not.toHaveBeenCalled();
    });

    it('closes a stale chooser after a filter/data change and omits it on an empty shelf', () => {
        const { getByTestId, queryByTestId, rerender } = render(<LibraryBookPicker books={books} onBookPress={jest.fn()} />);
        fireEvent.press(getByTestId('library-book-picker-open'));
        rerender(<LibraryBookPicker books={[books[1]]} onBookPress={jest.fn()} />);
        expect(queryByTestId('library-book-picker-panel')).toBeNull();
        fireEvent.press(getByTestId('library-book-picker-open'));
        expect(queryByTestId('library-book-picker-entry-first')).toBeNull();
        expect(getByTestId('library-book-picker-entry-second')).toBeTruthy();
        rerender(<LibraryBookPicker books={[]} onBookPress={jest.fn()} />);
        expect(queryByTestId('library-book-picker-open')).toBeNull();
    });
});
