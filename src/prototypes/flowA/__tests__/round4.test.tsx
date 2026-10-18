import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { BookDetailsPrototype } from '../BookDetailsPrototype';
import { noteDate } from '../components/NotePassages';
import { FIXTURES } from '../fixtures';
import { TYPE_SCALE } from '../prototypeTokens';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';

jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@expo/vector-icons', () => {
    const { Text } = require('react-native');
    return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});

const originalOS = Platform.OS;
afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
    jest.useRealTimers();
});

it.each(['ios', 'android'] as const)('exposes three separate native radios on %s without grouping them into one accessible element', os => {
    Platform.OS = os;
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    const group = ui.getByLabelText('Reading status');
    expect(group.props.accessible).toBeUndefined();
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(within(group).getAllByRole('radio').map(radio => radio.props.accessibilityLabel))
        .toEqual(['Want to read', 'Reading', 'Finished']);
});

it.each(['Good', 'Fair', undefined])('shows the owned summary with fixture condition %s as a plain row', condition => {
    jest.replaceProperty(FIXTURES, 'populated', {
        ...FIXTURES.populated, book: { ...FIXTURES.populated.book, condition },
    });
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" initialOpen="ownership" />);
    const row = ui.getByTestId('fa-row-ownership');
    expect(within(row).getByText('Ownership & condition')).toBeTruthy();
    const summary = within(row).getByText(condition ? `Owned · ${condition}` : 'Owned');
    expect(StyleSheet.flatten(summary.props.style).color).toBe(getLibraryAppearance('daylight').textSecondary);
    expect(row.props.onPress).toBeUndefined();
    expect(row.props.focusable).not.toBe(true);
    expect(row.props.tabIndex).toBeUndefined();
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(row.props['aria-expanded']).toBeUndefined();
    expect(within(row).queryByText(/chevron/)).toBeNull();
    fireEvent.press(row);
    expect(ui.queryByTestId('fa-expanded-ownership')).toBeNull();
});

it('keeps lent-out condition details expandable only when they add to the summary', () => {
    const ui = render(<BookDetailsPrototype preset="lent-out" phase="daylight" />);
    expect(ui.getByRole('button', { name: 'Ownership & condition, Lent out' })).toBeTruthy();
    fireEvent.press(ui.getByTestId('fa-row-ownership'));
    expect(within(ui.getByTestId('fa-expanded-ownership')).getByText('Good')).toBeTruthy();
    jest.replaceProperty(FIXTURES, 'lent-out', {
        ...FIXTURES['lent-out'], book: { ...FIXTURES['lent-out'].book, condition: undefined },
    });
    ui.rerender(<BookDetailsPrototype preset="lent-out" phase="daylight" />);
    const row = ui.getByTestId('fa-row-ownership');
    expect(within(row).getByText('Lent out')).toBeTruthy();
    expect(row.props.onPress).toBeUndefined();
    expect(within(row).queryByText(/chevron/)).toBeNull();
    expect(ui.queryByTestId('fa-expanded-ownership')).toBeNull();
});

it.each([false, true])('opens the empty-review editor without disclosure or visibility state (public=%s)', review_is_public => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.replaceProperty(FIXTURES, 'review-absent', {
        ...FIXTURES['review-absent'],
        book: { ...FIXTURES['review-absent'].book, review_is_public, rating: 4 },
    });
    const ui = render(<BookDetailsPrototype preset="review-absent" phase="daylight" initialOpen="review" />);
    const row = ui.getByRole('button', { name: 'Your review, No review yet.' });
    expect(within(row).getByText('Your review')).toBeTruthy();
    expect(within(row).getByText('No review yet.')).toBeTruthy();
    expect(row.props['aria-expanded']).toBeUndefined();
    expect(row.props.accessibilityState?.expanded).toBeUndefined();
    expect(ui.queryByText(/^(Public|Private)$/)).toBeNull();
    expect(ui.queryByTestId('fa-own-score')).toBeNull();
    expect(ui.queryByTestId('fa-expanded-review')).toBeNull();
    fireEvent.press(row);
    expect(info).toHaveBeenCalledWith('[FA-P1] would open review editor');
    expect(ui.queryByTestId('fa-expanded-review')).toBeNull();
});

it.each([false, true])('shows visibility only inside an existing review (public=%s)', review_is_public => {
    jest.replaceProperty(FIXTURES, 'populated', {
        ...FIXTURES.populated, book: { ...FIXTURES.populated.book, review_is_public },
    });
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    expect(ui.queryByText(/^(Public|Private)$/)).toBeNull();
    fireEvent.press(ui.getByTestId('fa-row-review'));
    expect(within(ui.getByTestId('fa-expanded-review')).getByText(review_is_public ? 'Public' : 'Private')).toBeTruthy();
});

it('renders each saved page as a secondary caption followed by its first excerpt line in passage typography', () => {
    const page = FIXTURES.populated.savedPages[0];
    const savedPages = [
        { ...page, content_excerpt: `${page.content_excerpt}\nHidden second line.` },
        { ...page, id: 'second-page', page_number: 84, content_excerpt: 'Another saved passage.\nAnother hidden line.' },
    ];
    jest.replaceProperty(FIXTURES, 'populated', { ...FIXTURES.populated, savedPages });
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" initialOpen="saved" />);
    const expanded = within(ui.getByTestId('fa-expanded-saved'));
    const noteStyle = StyleSheet.flatten(ui.getByTestId('fa-note-walden-quote-body').props.style);
    for (const saved of savedPages) {
        const caption = expanded.getByText(`Page ${saved.page_number}`);
        const excerpt = expanded.getByText(saved.content_excerpt.split('\n')[0]);
        expect(caption === excerpt).toBe(false);
        expect(StyleSheet.flatten(caption.props.style)).toMatchObject({
            ...TYPE_SCALE.caption, color: getLibraryAppearance('daylight').textSecondary,
        });
        expect(StyleSheet.flatten(excerpt.props.style)).toEqual(noteStyle);
    }
    expect(expanded.queryByText(/Hidden|hidden/)).toBeNull();
    expect(expanded.queryByText(/^p\. \d+ ·/)).toBeNull();
});

it('formats local note dates in en-GB, omitting only the current local year', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 12));
    const format = jest.spyOn(Date.prototype, 'toLocaleDateString');
    expect(noteDate(new Date(2026, 9, 14, 0, 15).toISOString())).toBe('14 Oct');
    expect(noteDate(new Date(2024, 9, 14, 23, 45).toISOString())).toBe('14 Oct 2024');
    expect(noteDate(new Date(2027, 9, 14, 0, 15).toISOString())).toBe('14 Oct 2027');
    expect(format).toHaveBeenNthCalledWith(1, 'en-GB', { day: 'numeric', month: 'short' });
    expect(format).toHaveBeenNthCalledWith(2, 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
});

it('uses the local calendar day and current year at a New Year boundary', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 1, 0, 15));
    expect(noteDate(new Date(2026, 0, 1, 0, 5).toISOString())).toBe('1 Jan');
    expect(noteDate(new Date(2025, 11, 31, 23, 45).toISOString())).toBe('31 Dec 2025');
});
