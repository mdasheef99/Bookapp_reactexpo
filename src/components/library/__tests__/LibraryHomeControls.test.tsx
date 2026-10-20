import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { LibraryBookThumb } from '../LibraryBookThumb';
import { LibraryBookRow } from '../LibraryBookList';
import { LibraryHeader } from '../LibraryHeader';
import { LibraryFilterBar } from '../LibraryFilterBar';
import { getLibraryAppearance, MIN_TARGET } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { LibraryFilter } from '@/features/books/utils/libraryShelf';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));

const colors = getLibraryAppearance('daylight');
const chips = [{ key: 'all', label: 'All', count: 2 }, { key: 'reading', label: 'Reading', count: 1 }, { key: 'wishlist', label: 'Wishlist', count: 0 }] as const;
const keyEvent = (key: string) => ({ key, nativeEvent: { key }, preventDefault: jest.fn() });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
function radioControl(radio: any): any {
    for (let node = radio; node; node = node.parent) if (node.props.accessibilityRole === 'radio' && node.props.onKeyDown && node.props.onPress) return node;
    throw new Error('Expected radio keyboard handler');
}

describe('LibraryBookThumb and rows', () => {
    it('uses local initials and placeholder tokens without requesting a remote placeholder', () => {
        const ui = render(<LibraryBookThumb title="The Left Hand of Darkness" />);
        const placeholder = ui.getByTestId('library-book-thumb-placeholder', { includeHiddenElements: true });
        expect(placeholder.props.accessible).toBe(false);
        expect(placeholder.props['aria-hidden']).toBe(true);
        expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({ width: 56, height: 84, backgroundColor: colors.coverPlaceholder });
        expect(StyleSheet.flatten(ui.getByText('LH', { includeHiddenElements: true }).props.style).color).toBe(colors.coverPlaceholderInk);
        expect(ui.UNSAFE_queryAllByType(Image)).toHaveLength(0);
        expect(JSON.stringify(ui.toJSON())).not.toMatch(/https?:|placeholder\.com/);
    });

    it('makes web covers decorative with an empty alt and the saved cover URL', () => {
        const priorOS = Platform.OS;
        Platform.OS = 'web';
        try {
            const ui = render(<LibraryBookThumb title="A cover" coverUrl="https://example.com/cover.jpg" />);
            const image = ui.UNSAFE_getByType(Image);
            expect(image.props.accessible).toBe(false);
            expect(image.props.alt).toBe('');
            // expo-image renders no alt attribute for '', so the wrapper must hide the image (axe image-alt).
            expect(ui.getByTestId('library-book-thumb-cover', { includeHiddenElements: true }).props).toMatchObject({
                'aria-hidden': true, importantForAccessibility: 'no-hide-descendants',
            });
            expect(image.props.source).toEqual({ uri: 'https://example.com/cover.jpg' });
            expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: 56, height: 84 });
            ui.unmount();
        } finally { Platform.OS = priorOS; }
    });

    it.each([
        [null, 'lent_out', 'Lent out'], ['reading', null, 'Reading'], [null, null, null],
    ])('omits missing caption parts for status=%s ownership=%s', (reading_status, ownership, caption) => {
        const ui = render(<LibraryBookRow item={{ id: 'missing', reading_status, ownership, book: { title: 'Missing facts' } }} onPress={jest.fn()} />);
        expect(ui.getAllByRole('button')).toHaveLength(1);
        expect(ui.getByRole('button', { name: 'Open Missing facts' })).toBeOnTheScreen();
        if (caption) expect(ui.getByText(caption)).toBeOnTheScreen();
        expect(ui.queryByText(/undefined|null| · /)).toBeNull();
    });
});

describe('Library radio controls', () => {
    const priorOS = Platform.OS;
    beforeEach(() => { Platform.OS = 'web'; });
    afterEach(() => { Platform.OS = priorOS; });

    function Filters({ disabled = false }: { disabled?: boolean }) {
        const [value, setValue] = React.useState<LibraryFilter>('all');
        return <LibraryFilterBar chips={[...chips]} activeFilter={value} onChange={setValue} disabled={disabled} />;
    }

    it('names the filter group, checks one chip and uses plain counts, a check cue, tokens and 48dp targets', () => {
        const ui = render(<Filters />);
        const group = ui.getByLabelText('Filter books');
        expect(group.props.accessibilityRole).toBe('radiogroup');
        const radios = within(group).getAllByRole('radio');
        expect(radios.map(radio => radio.props.accessibilityLabel)).toEqual(['All, 2 books', 'Reading, 1 book', 'Wishlist, 0 books']);
        expect(radios.map(radio => radio.props.accessibilityState.checked)).toEqual([true, false, false]);
        expect(radios.map(radio => radio.props.tabIndex)).toEqual([0, -1, -1]);
        expect(ui.getByText('✓ All 2')).toBeOnTheScreen();
        expect(ui.getByText('Reading 1')).toBeOnTheScreen();
        expect(StyleSheet.flatten(ui.getByText('Reading 1').props.style)).toMatchObject(LIBRARY_TEXT.label);
        for (const radio of radios) {
            expect(StyleSheet.flatten(radio.props.style)).toMatchObject({ minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderColor: colors.controlBorder });
        }
        expect(StyleSheet.flatten(radios[0].props.style).backgroundColor).toBe(colors.chipSelectedBackground);
        expect(StyleSheet.flatten(radios[1].props.style).backgroundColor).toBe('transparent');
        fireEvent.press(radios[1]);
        expect(ui.getByText('✓ Reading 1')).toBeOnTheScreen();
        expect(ui.getAllByRole('radio').map(radio => radio.props.tabIndex)).toEqual([-1, 0, -1]);
    });

    it.each(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'])('moves filter selection and focus with %s and wraps', (key) => {
        const ui = render(<Filters />);
        const controls = ui.UNSAFE_getAllByType(View).filter(node => node.props.accessibilityRole === 'radio');
        const focus = controls.map(node => { const spy = jest.fn(); node.instance.focus = spy; return spy; });
        const next = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : 2;
        const event = keyEvent(key);
        fireEvent(ui.getAllByRole('radio')[0], 'keyDown', event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(focus[next]).toHaveBeenCalledTimes(1);
        expect(ui.getAllByRole('radio').map(radio => radio.props.accessibilityState.checked)).toEqual(chips.map((_, i) => i === next));
        fireEvent(ui.getAllByRole('radio')[next], 'keyDown', keyEvent(key === 'ArrowRight' || key === 'ArrowDown' ? 'ArrowLeft' : 'ArrowRight'));
        expect(ui.getAllByRole('radio')[0].props.accessibilityState.checked).toBe(true);
    });

    it('activates a radio with Space once and guards disabled clicks and keys', async () => {
        const onChange = jest.fn();
        const ui = render(<LibraryFilterBar chips={[...chips]} activeFilter="all" onChange={onChange} />);
        const control = () => radioControl(ui.getAllByRole('radio')[1]);
        const target = {};
        act(() => control().props.onKeyDown({ ...keyEvent(' '), target, currentTarget: target }));
        expect(onChange.mock.calls).toEqual([['reading']]);
        act(() => control().props.onKeyDown({ ...keyEvent(' '), target, currentTarget: target, repeat: true }));
        expect(onChange).toHaveBeenCalledTimes(1);
        onChange.mockClear();
        ui.rerender(<LibraryFilterBar chips={[...chips]} activeFilter="all" onChange={onChange} disabled />);
        for (const radio of ui.getAllByRole('radio')) {
            expect(radio).toBeDisabled(); expect(radio.props.tabIndex).toBe(-1);
        }
        act(() => { control().props.onPress(); control().props.onKeyDown(keyEvent('ArrowRight')); });
        await flush();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('names Shelf/List radios, roves focus and retains focusSelectedView on remount', () => {
        const onChange = jest.fn();
        const ui = render(<LibraryHeader onAdd={jest.fn()} viewMode="list" onViewModeChange={onChange} />);
        expect(ui.getByLabelText('Library view').props.accessibilityRole).toBe('radiogroup');
        expect(ui.getByRole('heading', { name: 'My Library' }).props['aria-level']).toBe(1);
        expect(StyleSheet.flatten(ui.getByText('My Library').props.style)).toMatchObject(LIBRARY_TEXT.title);
        expect(ui.getAllByRole('radio').map(radio => radio.props.tabIndex)).toEqual([-1, 0]);
        const controls = ui.UNSAFE_getAllByType(View).filter(node => node.props.accessibilityRole === 'radio');
        const focus = controls.map(node => { const spy = jest.fn(); node.instance.focus = spy; return spy; });
        fireEvent(ui.getByRole('radio', { name: 'List view' }), 'keyDown', keyEvent('ArrowRight'));
        expect(onChange.mock.calls).toEqual([['shelf']]);
        expect(focus[0]).toHaveBeenCalledTimes(1);
        ui.rerender(<LibraryHeader onAdd={jest.fn()} viewMode="shelf" onViewModeChange={onChange} focusSelectedView />);
        expect(focus[0]).toHaveBeenCalledTimes(2);
        expect(ui.getAllByRole('radio').map(radio => radio.props.tabIndex)).toEqual([0, -1]);
        for (const radio of ui.getAllByRole('radio')) expect(StyleSheet.flatten(radio.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
        expect(StyleSheet.flatten(ui.getByRole('button', { name: 'Add a book' }).props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
    });

    it('keeps view and Add disabled while arranging, including direct handler calls', async () => {
        const onChange = jest.fn(), onAdd = jest.fn();
        const ui = render(<LibraryHeader onAdd={onAdd} onViewModeChange={onChange} disabled />);
        for (const radio of ui.getAllByRole('radio')) { expect(radio).toBeDisabled(); expect(radio.props.tabIndex).toBe(-1); }
        expect(ui.getByRole('button', { name: 'Add a book' })).toBeDisabled();
        const radio = radioControl(ui.getAllByRole('radio')[0]);
        act(() => { radio.props.onPress(); radio.props.onKeyDown(keyEvent('ArrowLeft')); });
        fireEvent.press(ui.getByRole('button', { name: 'Add a book' }));
        await flush();
        expect(onChange).not.toHaveBeenCalled(); expect(onAdd).not.toHaveBeenCalled();
    });
});
