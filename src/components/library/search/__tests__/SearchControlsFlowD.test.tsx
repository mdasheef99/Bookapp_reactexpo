import React from 'react';
import { Animated, Modal, Platform, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BookCard, BookCardProps } from '../BookCard';
import { SwipeableBookCard } from '../SwipeableBookCard';
import { FilterChips, FilterModal } from '../FilterModal';
import { SortModal } from '../SortModal';
import { ManualEntryModal } from '../ManualEntryModal';
import { RecentSearches } from '../RecentSearches';
import { SearchSuggestions } from '../SearchSuggestions';
import { BookFeedbackProvider } from '@/components/library/ui/BookFeedback';
import { expectSinglePrimary, countPrimaryButtons } from '@/test-utils/bookSection';
import { getLibraryAppearance, MIN_TARGET } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { SortOption } from '@/lib/constants';

const PressResponder = require('react-native-web/src/modules/usePressEvents/PressResponder').default;

function pressControl(node: any): any {
    for (let current = node; current; current = current.parent) if (current.props.onPress) return current;
    throw new Error('Expected press control');
}

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: 'Swipeable' }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' } }));

const props: BookCardProps = {
    book: { id: 'book', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], pageCount: 320, previewLink: 'https://example.test' } },
    index: 0, isInLibrary: false, isAdding: false, isInWishlist: false, isTogglingWishlist: false,
    onAdd: jest.fn(), onWishlistToggle: jest.fn(), onPreview: jest.fn(), onShare: jest.fn(),
};
const expectTargets = (screen: ReturnType<typeof render>) => {
    for (const role of ['button', 'radio'] as const) for (const control of screen.queryAllByRole(role)) {
        const style = StyleSheet.flatten(control.props.style);
        expect({ label: control.props.accessibilityLabel, minHeight: style?.minHeight }).toEqual({
            label: expect.any(String), minHeight: expect.any(Number),
        });
        expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
    }
};

it('card Add shows a named busy state and secondary action with 48dp controls', () => {
    const screen = render(<BookCard {...props} isAdding />);
    expect(screen.getByText('Adding…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adding…: Dune' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Adding…: Dune' }).props.style).backgroundColor).toBe(getLibraryAppearance('daylight').bgCard);
    expect(countPrimaryButtons(screen)).toBe(0);
    expectTargets(screen);
});

it('card Add starts its accessible name with the visible label and still adds the book', () => {
    const onAdd = jest.fn();
    const screen = render(<BookCard {...props} onAdd={onAdd} />);
    const add = screen.getByRole('button', { name: 'Add to library: Dune' });
    expect(screen.getByText('Add to library')).toBeOnTheScreen();
    fireEvent.press(add);
    expect(onAdd).toHaveBeenCalledWith(props.book);
});

it.each([false, true])('swipe action labels use label typography (already saved: %s)', saved => {
    const screen = render(<SwipeableBookCard {...props} isInLibrary={saved} isInWishlist={saved} />);
    const swipeable = screen.UNSAFE_getByType(Swipeable);
    const drag = new Animated.Value(0);
    const actions = render(<>{swipeable.props.renderRightActions(drag, drag)}{swipeable.props.renderLeftActions(drag, drag)}</>);
    for (const label of [saved ? 'In\nLibrary' : 'Add to\nLibrary', saved ? 'Remove\nWishlist' : 'Add to\nWishlist']) {
        expect(StyleSheet.flatten(actions.getByText(label).props.style)).toMatchObject(LIBRARY_TEXT.label);
    }
});

it('in-library status is a caption and missing ratings produce no stars', () => {
    const screen = render(<BookCard {...props} isInLibrary />);
    expect(screen.getByText('In your library')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add to library: Dune' })).toBeNull();
    expect(screen.queryByLabelText(/out of 5/)).toBeNull();
    expect(screen.getByTestId('library-book-thumb-placeholder', { includeHiddenElements: true })).toBeOnTheScreen();
});

it('ratings and their count come only from returned data', () => {
    const screen = render(<BookCard {...props} book={{ ...props.book, volumeInfo: { ...props.book.volumeInfo, averageRating: 4, ratingsCount: 12 } }} />);
    expect(screen.getByText('4.0 (12)')).toBeOnTheScreen();
    screen.rerender(<BookCard {...props} book={{ ...props.book, volumeInfo: { ...props.book.volumeInfo, averageRating: 3 } }} />);
    expect(screen.getByText('3.0')).toBeOnTheScreen();
    expect(screen.queryByText(/\(0\)/)).toBeNull();
});

it('Sort has a named radio group, 48dp options and selects then closes', () => {
    const onSelect = jest.fn(), onClose = jest.fn();
    const screen = render(<SortModal visible currentSort="relevance" onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByLabelText('Sort results').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'Relevance' }).props.accessibilityState.checked).toBe(true);
    expectTargets(screen);
    fireEvent.press(screen.getByRole('radio', { name: 'Title A-Z' }));
    expect(onSelect).toHaveBeenCalledWith('title');
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('Filter has one named radio group per facet and 48dp controls', () => {
    const screen = render(<FilterModal visible filters={{}} onApply={jest.fn()} onClose={jest.fn()} />);
    for (const name of ['Genre', 'Language', 'Price']) expect(screen.getByLabelText(name).props.accessibilityRole).toBe('radiogroup');
    expectTargets(screen);
});

it('Sort selecting the current value still closes and Back closes both sheets', () => {
    const onSelect = jest.fn(), onClose = jest.fn();
    const screen = render(<SortModal visible currentSort="relevance" onSelect={onSelect} onClose={onClose} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Relevance' }));
    expect(onSelect).toHaveBeenCalledWith('relevance');
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(2);
    screen.unmount();
    const filter = render(<FilterModal visible filters={{}} onApply={jest.fn()} onClose={onClose} />);
    fireEvent(filter.UNSAFE_getByType(Modal), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(3);
});

it.each(['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'])('Sort %s selects and moves focus without closing, then a press closes', async key => {
    const onSelect = jest.fn(), onClose = jest.fn(), preventDefault = jest.fn();
    function Sheet({ currentSort = 'relevance' }: { currentSort?: SortOption }) {
        const [visible, setVisible] = React.useState(true);
        return <SortModal visible={visible} currentSort={currentSort} onSelect={onSelect} onClose={() => { onClose(); setVisible(false); }} />;
    }
    const screen = render(<Sheet />);
    const controls = screen.UNSAFE_getAllByType(View).filter(node => node.props.accessibilityRole === 'radio');
    const focus = controls.map(node => { const spy = jest.fn(); node.instance.focus = spy; return spy; });
    const next = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : 3;
    fireEvent(screen.getByRole('radio', { name: 'Relevance' }), 'keyDown', { key, preventDefault });
    await act(async () => { await Promise.resolve(); });
    const nextSort = next === 1 ? 'rating' : 'title';
    expect(onSelect.mock.calls).toEqual([[nextSort]]);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(true);
    expect(focus[next]).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('radio').map(radio => radio.props.tabIndex)).toEqual(next === 1 ? [-1, 0, -1, -1] : [-1, -1, -1, 0]);
    expect(screen.getAllByRole('radio').map(radio => radio.props.accessibilityState.checked)).toEqual([true, false, false, false]);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    screen.rerender(<Sheet currentSort={nextSort} />);
    expect(screen.getAllByRole('radio').map(radio => radio.props.accessibilityState.checked)).toEqual(next === 1 ? [false, true, false, false] : [false, false, false, true]);
    expect(screen.getAllByRole('radio').map(radio => radio.props.tabIndex)).toEqual(next === 1 ? [-1, 0, -1, -1] : [-1, -1, -1, 0]);
    fireEvent.press(screen.getAllByRole('radio')[next]);
    expect(onSelect.mock.calls).toEqual([[nextSort], [nextSort]]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
});

it('Sort Space applies the focused radio and closes once, and reopening restores the saved tab stop', async () => {
    const onSelect = jest.fn(), onClose = jest.fn();
    const screen = render(<SortModal visible currentSort="relevance" onSelect={onSelect} onClose={onClose} />);
    const target = {};
    fireEvent(screen.getByRole('radio', { name: 'Relevance' }), 'keyDown', { key: 'ArrowDown', preventDefault: jest.fn() });
    await act(async () => { await Promise.resolve(); });
    expect(onSelect.mock.calls).toEqual([['rating']]);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(screen.getByRole('radio', { name: 'Highest Rated' }), 'keyDown', { key: ' ', target, currentTarget: target, preventDefault: jest.fn() });
    fireEvent(screen.getByRole('radio', { name: 'Highest Rated' }), 'keyDown', { key: ' ', target, currentTarget: target, repeat: true, preventDefault: jest.fn() });
    expect(onSelect.mock.calls).toEqual([['rating'], ['rating']]);
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.rerender(<SortModal visible={false} currentSort="relevance" onSelect={onSelect} onClose={onClose} />);
    screen.rerender(<SortModal visible currentSort="relevance" onSelect={onSelect} onClose={onClose} />);
    expect(screen.getAllByRole('radio').map(radio => radio.props.tabIndex)).toEqual([0, -1, -1, -1]);
});

it('Sort Enter applies through the web press responder and closes once', () => {
    const onSelect = jest.fn(), onClose = jest.fn();
    const screen = render(<SortModal visible currentSort="relevance" onSelect={onSelect} onClose={onClose} />);
    const radio = pressControl(screen.getByRole('radio', { name: 'Title A-Z' }));
    const responder = new PressResponder({ onPress: radio.props.onPress });
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const listeners = new Map<string, (event: unknown) => void>();
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
        removeEventListener: (name: string) => listeners.delete(name),
    } });
    try {
        const target = { tagName: 'DIV', getAttribute: () => 'radio' };
        const event = { key: 'Enter', target, currentTarget: target, persist: jest.fn(), preventDefault: jest.fn(), stopPropagation: jest.fn(), nativeEvent: { type: 'keydown', key: 'Enter' } };
        act(() => {
            fireEvent(radio, 'keyDown', event);
            responder.getEventHandlers().onKeyDown(event);
            listeners.get('keyup')?.({ ...event, nativeEvent: { type: 'keyup', key: 'Enter' } });
        });
        expect(onSelect.mock.calls).toEqual([['title']]);
        expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
        responder.reset();
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});

it('Sort panel heading and whitespace stay open, while the scrim closes', async () => {
    const onClose = jest.fn();
    const screen = render(<SortModal visible currentSort="relevance" onSelect={jest.fn()} onClose={onClose} />);
    const stopPropagation = jest.fn();
    fireEvent.press(screen.getByText('Sort results'), { stopPropagation });
    await act(async () => { await Promise.resolve(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    const panel = pressControl(screen.getByText('Sort results'));
    fireEvent.press(panel, { stopPropagation });
    await act(async () => { await Promise.resolve(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalledTimes(2);
    fireEvent.press(pressControl(panel.parent));
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('filter chips and recent-search controls are named 48dp targets', () => {
    const remove = jest.fn();
    const screen = render(<><FilterChips filters={{ genre: 'fiction' }} onRemove={remove} />
        <RecentSearches searches={['Dune']} onSearch={jest.fn()} onRemove={jest.fn()} /></>);
    expectTargets(screen);
    fireEvent.press(screen.getByRole('button', { name: 'Remove fiction filter' }));
    expect(remove).toHaveBeenCalledWith('genre');
    expect(screen.getByRole('button', { name: 'Remove Dune from recent searches' })).toBeOnTheScreen();
});

it('suggestion rows remain named 48dp controls', () => {
    const onSelect = jest.fn();
    const screen = render(<SearchSuggestions visible suggestions={['Dune Messiah']} recentSearches={['Dune']} onSelect={onSelect} />);
    expectTargets(screen);
    fireEvent.press(screen.getByLabelText('Search for Dune Messiah'));
    expect(onSelect).toHaveBeenCalledWith('Dune Messiah');
});

it('manual entry has one primary, its feedback slot, and 48dp fields and actions', () => {
    const screen = render(<BookFeedbackProvider><ManualEntryModal visible title="Dune" author="" submitting={false}
        onTitleChange={jest.fn()} onAuthorChange={jest.fn()} onSave={jest.fn()} onCancel={jest.fn()} /></BookFeedbackProvider>);
    expectSinglePrimary(screen);
    expect(screen.getByTestId('book-feedback-slot')).toBeOnTheScreen();
    expectTargets(screen);
    for (const id of ['library-manual-entry-title', 'library-manual-entry-author']) {
        expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
    }
});

it('all web modal wrappers carry the actual dialog accessible name', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    try {
        const screen = render(<BookFeedbackProvider>
            <FilterModal visible filters={{}} onApply={jest.fn()} onClose={jest.fn()} />
            <SortModal visible currentSort="relevance" onSelect={jest.fn()} onClose={jest.fn()} />
            <ManualEntryModal visible title="" author="" submitting={false} onTitleChange={jest.fn()} onAuthorChange={jest.fn()} onSave={jest.fn()} onCancel={jest.fn()} />
        </BookFeedbackProvider>);
        // RN Web's Modal spreads these props onto its role="dialog" View, so map them with the installed converter.
        const createDOMProps = require('react-native-web/dist/cjs/modules/createDOMProps') as
            (element: string, props: Record<string, unknown>) => Record<string, unknown>;
        expect(screen.UNSAFE_getAllByType(Modal).filter(modal => modal.props.visible)
            .map(modal => createDOMProps('div', { ...modal.props, role: 'dialog' })['aria-label']))
            .toEqual(['Filters', 'Sort results', 'Add book manually']);
    } finally { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); }
});
