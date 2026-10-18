import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { BookDetailsPrototype } from '../BookDetailsPrototype';
import PrototypeRoute from '../BookDetailsPrototypeRoute';
import { DetailRow } from '../components/DetailRow';
import { titleInitials } from '../components/CoverBlock';
import { FIXTURES, OPEN_ROWS, PRESETS } from '../fixtures';
import { PHASES, TYPE_SCALE } from '../prototypeTokens';
import { getLibraryAppearance, MIN_TARGET } from '@/components/library/LibraryAppearance';

let mockParams: Record<string, string | string[]> = {};
type TestNode = { type: unknown; props: Record<string, any>; parent: TestNode | null };
jest.mock('expo-router', () => {
    const { Text } = require('react-native');
    return {
        useLocalSearchParams: () => mockParams,
        Redirect: () => <Text>Release redirect</Text>,
        Link: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    };
});
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@expo/vector-icons', () => {
    const { Text } = require('react-native');
    return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});

beforeEach(() => { mockParams = {}; });

const keyText = (preset: string) => ({
    loading: 'Loading book', error: "Couldn't load this book.",
    'not-found': "This book isn't in your library.",
    'long-title': 'The Life and Opinions of Tristram Shandy, Gentleman',
}[preset] ?? 'Walden');

describe('FA-P1 state matrix', () => {
    it.each(PRESETS.flatMap(preset => PHASES.map(phase => ({ preset, phase }))))(
        '$preset / $phase renders its fixture and its accessible primary', ({ preset, phase }) => {
            const ui = render(<BookDetailsPrototype preset={preset} phase={phase} />);
            if (preset === 'loading') expect(ui.getByLabelText(keyText(preset))).toBeTruthy();
            else expect(ui.getByText(keyText(preset))).toBeTruthy();
            expect(ui.queryAllByTestId('fa-primary')).toHaveLength(preset === 'loading' ? 0 : 1);
            const page = ui.getByTestId('fa-page');
            expect(StyleSheet.flatten(page.props.style).backgroundColor).toBe(getLibraryAppearance(phase).bgPrimary);
            const controls = ui.getAllByRole(/^(button|radio|link)$/)
                .filter((node: TestNode) => node.props.accessibilityRole !== 'radio' || node.props.tabIndex === 0);
            const primaryIndex = controls.findIndex((node: TestNode) => node.props.testID === 'fa-primary');
            const beforePrimary = primaryIndex < 0 ? controls : controls.slice(0, primaryIndex + 1);
            const focusableCount = beforePrimary.filter((node: TestNode) => !node.props.accessibilityState?.disabled).length;
            expect(focusableCount).toBeLessThanOrEqual(4);
            expect(focusableCount)
                .toBe(['loading', 'offline'].includes(preset) ? 1 : ['error', 'not-found'].includes(preset) ? 2 : ['notes-error', 'refresh-failed'].includes(preset) ? 4 : 3);
            if (!['loading', 'error', 'not-found'].includes(preset)) {
                expect(primaryIndex).toBeGreaterThanOrEqual(0);
                for (const node of controls.slice(primaryIndex + 1)) {
                    if (node.props.testID?.startsWith('fa-row-')) {
                        expect(StyleSheet.flatten(node.props.style).backgroundColor).toBeUndefined();
                        let owner: TestNode | null = node.parent;
                        while (owner && owner.type !== DetailRow) {
                            expect(StyleSheet.flatten(owner.props.style)?.backgroundColor).toBeUndefined();
                            owner = owner.parent;
                        }
                        expect(owner?.type).toBe(DetailRow);
                    }
                }
            }
        },
    );

    it('shows only two newest passages, plain counts, and all partial states', () => {
        const ui = render(<BookDetailsPrototype preset="many-notes" phase="daylight" />);
        expect(ui.getAllByTestId(/^fa-note-.*-body$/)).toHaveLength(2);
        const count = ui.getByTestId('fa-note-count');
        expect(count.type).toBe('Text');
        expect(count.props.children).toBe('12 notes');
        let ancestor: TestNode | null = count;
        while (ancestor && ancestor.props.testID !== 'fa-notes-header') {
            expect(StyleSheet.flatten(ancestor.props.style)?.backgroundColor).toBeUndefined();
            ancestor = ancestor.parent;
        }
        expect(ancestor).toBeTruthy();
        expect(StyleSheet.flatten(ancestor!.props.style)?.backgroundColor).toBeUndefined();
        ui.rerender(<BookDetailsPrototype preset="zero-notes" phase="daylight" />);
        expect(ui.getByText('No notes yet.')).toBeTruthy();
        expect(ui.queryByTestId('fa-note-count')).toBeNull();
        expect(ui.queryByRole('link', { name: 'All notes' })).toBeNull();
        ui.rerender(<BookDetailsPrototype preset="notes-loading" phase="daylight" />);
        expect(ui.getByText('Loading notes…')).toBeTruthy();
        ui.rerender(<BookDetailsPrototype preset="notes-error" phase="daylight" />);
        expect(ui.getByText("Couldn't load your notes.")).toBeTruthy();
        expect(ui.getByRole('button', { name: 'Try again' })).toBeTruthy();
        ui.rerender(<BookDetailsPrototype preset="offline" phase="daylight" />);
        expect(ui.getByText('Offline · Showing saved content.')).toBeTruthy();
    });

    it('uses categoryLabel, deterministic dates, serif quotes, and omits null metadata', () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 9, 18, 12));
        try {
            const ui = render(<BookDetailsPrototype preset="populated" phase="golden" />);
            expect(ui.getByText('Quote · p. 42 · 14 Oct')).toBeTruthy();
            expect(ui.getByText('Thought · 12 Oct')).toBeTruthy();
            const quote = ui.getAllByTestId(/^fa-note-.*-body$/)[0];
            expect(quote.props.children).toBe(`“${FIXTURES.populated.notes[0].content}”`);
            expect(StyleSheet.flatten(quote.props.style).fontSize).toBe(TYPE_SCALE.bodySerif.fontSize);
            ui.rerender(<BookDetailsPrototype preset="uncategorised-note" phase="golden" />);
            expect(ui.getByText('14 Oct')).toBeTruthy();
            expect(ui.queryByText(/No category/)).toBeNull();
        } finally { jest.useRealTimers(); }
    });

    it('keeps one tab stop in the radio group and selects/focuses with arrow keys', () => {
        const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
        const group = ui.getByLabelText('Reading status');
        let radios = within(group).getAllByRole('radio');
        expect(radios.map(radio => radio.props.tabIndex)).toEqual([-1, 0, -1]);
        const preventDefault = jest.fn();
        fireEvent(radios[1], 'keyDown', { nativeEvent: { key: 'ArrowRight' }, preventDefault });
        radios = within(group).getAllByRole('radio');
        expect(radios[2].props.accessibilityState.checked).toBe(true);
        expect(radios.map(radio => radio.props.tabIndex)).toEqual([-1, -1, 0]);
        fireEvent(radios[2], 'keyDown', { nativeEvent: { key: 'ArrowRight' }, preventDefault });
        expect(within(group).getAllByRole('radio')[0].props.accessibilityState.checked).toBe(true);
        fireEvent(within(group).getAllByRole('radio')[0], 'keyDown', { nativeEvent: { key: 'ArrowLeft' }, preventDefault });
        expect(within(group).getAllByRole('radio')[2].props.accessibilityState.checked).toBe(true);
        expect(preventDefault).toHaveBeenCalledTimes(3);
    });

    it('collapses review and saved pages, hides absent pages, and renders the fixture score', () => {
        const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
        expect(ui.getByTestId('fa-row-review').props.accessibilityState.expanded).toBe(false);
        expect(ui.getByTestId('fa-row-saved').props.accessibilityState.expanded).toBe(false);
        expect(ui.queryByTestId('fa-own-score')).toBeNull();
        fireEvent.press(ui.getByTestId('fa-row-review'));
        expect(ui.getByTestId('fa-own-score').props.accessibilityLabel)
            .toBe(`Your rating: ${FIXTURES.populated.book.rating} of 5`);
        expect(ui.getAllByTestId('fa-star-filled', { includeHiddenElements: true })).toHaveLength(FIXTURES.populated.book.rating!);
        expect(ui.getByText('Private')).toBeTruthy();
        ui.rerender(<BookDetailsPrototype preset="saved-absent" phase="daylight" />);
        expect(ui.queryByTestId('fa-row-saved')).toBeNull();
    });

    it.each(['review', 'saved', 'info', 'ownership'] as const)('expands open=%s read-only', initialOpen => {
        const ui = render(<BookDetailsPrototype preset={initialOpen === 'ownership' ? 'lent-out' : 'populated'} phase="midnight" initialOpen={initialOpen} />);
        expect(ui.getByTestId(`fa-row-${initialOpen}`).props.accessibilityState.expanded).toBe(true);
    });

    it.each(PHASES)('keeps placeholder muted in %s', phase => {
        const ui = render(<BookDetailsPrototype preset="no-cover" phase={phase} />);
        const placeholder = ui.getByTestId('fa-cover-placeholder', { includeHiddenElements: true });
        const color = StyleSheet.flatten(placeholder.props.style).backgroundColor;
        expect(color).toBe(getLibraryAppearance(phase).coverPlaceholder);
        expect(['white', ...['fff', 'ffffff'].map(value => String.fromCharCode(35) + value)]).not.toContain(color.toLowerCase());
        expect(placeholder.props.accessible).toBe(false);
        expect(ui.getByText('W', { includeHiddenElements: true })).toBeTruthy();
    });

    it('keeps a small cover beside the title below 340px and stacks a title over four lines', () => {
        const dimensionSpy = jest.spyOn(Dimensions, 'get').mockReturnValue({ ...Dimensions.get('window'), fontScale: 1 });
        try {
            const ui = render(<BookDetailsPrototype preset="long-title" phase="daylight" />);
            const row = ui.getByTestId('fa-cover-row');
            fireEvent(row, 'layout', { nativeEvent: { layout: { width: 288 } } });
            expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
            fireEvent(row, 'layout', { nativeEvent: { layout: { width: 358 } } });
            fireEvent(ui.getByText(keyText('long-title')), 'layout', { nativeEvent: { layout: { height: TYPE_SCALE.title.lineHeight * Dimensions.get('window').fontScale * 5 } } });
            expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
            expect(ui.getByText(keyText('long-title')).props.numberOfLines).toBeUndefined();
        } finally { dimensionSpy.mockRestore(); }
    });

    it('uses named roles and minimum targets, with caption only on metadata', () => {
        const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" showSlots />);
        for (const element of ui.UNSAFE_root.findAll((node: TestNode) => typeof node.type === 'string' && node.props.onPress)) {
            expect(['button', 'radio', 'link']).toContain(element.props.accessibilityRole);
            expect(element.props.accessibilityLabel).toEqual(expect.any(String));
            const style = StyleSheet.flatten(element.props.style);
            expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
            expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TARGET);
        }
        for (const text of ui.UNSAFE_root.findAllByType(Text)) {
            if (StyleSheet.flatten(text.props.style)?.fontSize === TYPE_SCALE.caption.fontSize) {
                expect(text.props.testID).toMatch(/-meta$/);
            }
        }
        for (const slot of ui.getAllByTestId(/^fa-slot-(options|dates)$/, { includeHiddenElements: true })) {
            expect(slot.props['aria-hidden']).toBe(true);
        }
    });

    it('makes the dialog confirm the only accessible primary and hides the page', () => {
        const ui = render(<BookDetailsPrototype preset="populated" phase="midnight" initialOpen="remove" />);
        expect(ui.getAllByTestId('fa-primary')).toHaveLength(1);
        expect(ui.getByRole('button', { name: 'Remove book' })).toBeTruthy();
        expect(ui.getByTestId('fa-page', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no-hide-descendants');
        expect(ui.getByTestId('fa-page', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
        expect(ui.getByTestId('fa-dialog').props['aria-modal']).toBe(true);
        expect(ui.getAllByRole('dialog')).toHaveLength(1);
        expect(ui.getByText("Your notes, review and saved pages for this book will be deleted too. You can't undo this.")).toBeTruthy();
        fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
        expect(ui.queryByTestId('fa-dialog')).toBeNull();
        expect(ui.getByRole('button', { name: 'Add note' })).toBeTruthy();
        fireEvent.press(ui.getByRole('button', { name: 'Remove from library' }));
        fireEvent.press(ui.getByRole('button', { name: 'Remove book' }));
        expect(ui.queryByTestId('fa-dialog')).toBeNull();
    });

    it.each(['loading', 'error', 'not-found'] as const)('keeps %s accessible when open=remove has no loaded book', preset => {
        const ui = render(<BookDetailsPrototype preset={preset} phase="daylight" initialOpen="remove" />);
        expect(ui.getByTestId('fa-page').props['aria-hidden']).toBe(false);
        expect(ui.queryByTestId('fa-dialog')).toBeNull();
    });

    it('derives significant initials and performs prototype actions without leaving the fixture', () => {
        expect(titleInitials('Walden')).toBe('W');
        expect(titleInitials('The Life and Opinions of Tristram Shandy, Gentleman')).toBe('LO');
        const info = jest.spyOn(console, 'info').mockImplementation(() => {});
        try {
            const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
            fireEvent.press(ui.getByRole('button', { name: 'Back to Library' }));
            fireEvent.press(ui.getByRole('button', { name: 'Add note' }));
            fireEvent.press(ui.getByRole('link', { name: 'All notes' }));
            expect(info.mock.calls.flat()).toEqual(['[FA-P1] would go back', '[FA-P1] would add note', '[FA-P1] would open notes list']);
            expect(ui.getByText('Walden')).toBeTruthy();
        } finally { info.mockRestore(); }
    });

    it.each(['golden', 'midnight'] as const)('applies URL phase=%s without changing the theme hook', phase => {
        mockParams = { s: 'populated', phase };
        const ui = render(<PrototypeRoute />);
        expect(StyleSheet.flatten(ui.getByTestId('fa-page').props.style).backgroundColor).toBe(getLibraryAppearance(phase).bgPrimary);
        expect(ui.queryByTestId('fa-switcher')).toBeNull();
    });

    it('lists all preset/phase links and populated variants only in switcher mode', () => {
        const ui = render(<PrototypeRoute />);
        expect(ui.getByTestId('fa-switcher')).toBeTruthy();
        expect(ui.getAllByRole('link').length).toBe(PRESETS.length * PHASES.length + PHASES.length * (OPEN_ROWS.length + 1));
    });

    it('renders a release redirect when __DEV__ is false', () => {
        const previous = __DEV__;
        try {
            (globalThis as any).__DEV__ = false;
            let Route!: React.ComponentType;
            jest.isolateModules(() => { Route = require('../../../../app/(tabs)/library/dev-flow-a').default; });
            expect(render(<Route />).getByText('Release redirect')).toBeTruthy();
        } finally { (globalThis as any).__DEV__ = previous; }
    });
});
