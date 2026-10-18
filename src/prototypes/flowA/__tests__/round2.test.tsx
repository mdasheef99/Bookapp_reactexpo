import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { BookDetailsPrototype } from '../BookDetailsPrototype';
import PrototypeSwitcher from '../PrototypeSwitcher';
import { LibraryTypographyProvider } from '@/components/library/LibraryTypography';
import { getLibraryAppearance, MIN_TARGET } from '@/components/library/LibraryAppearance';
import { NotePassages } from '../components/NotePassages';
import { FIXTURES, OPEN_ROWS, PRESETS } from '../fixtures';
import { PHASES, TYPE_SCALE } from '../prototypeTokens';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
    __esModule: true, default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-router', () => {
    const { Text } = require('react-native');
    return { Link: ({ children, ...props }: any) => <Text {...props}>{children}</Text> };
});
jest.mock('@expo/vector-icons', () => {
    const { Text } = require('react-native');
    return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});

const dimensions = jest.mocked(useWindowDimensions);
const colors = getLibraryAppearance('daylight');
const deletion = "Your notes, review and saved pages for this book will be deleted too. You can't undo this.";
const originalOS = Platform.OS;
type TestNode = { type: unknown; props: Record<string, any> };
beforeEach(() => {
    Platform.OS = 'web';
    dimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
});
afterEach(() => { Platform.OS = originalOS; });

it('A: names the book, associates the deletion description, focuses Cancel and makes the web page inert', () => {
    const ui = render(<BookDetailsPrototype preset="long-title" phase="daylight" initialOpen="remove" />);
    const page = ui.UNSAFE_getAllByType(View).find(node => node.props.testID === 'fa-page')!.instance;
    const cancel = ui.UNSAFE_getAllByType(View).find(node => node.props.accessibilityLabel === 'Cancel')!.instance;
    const focus = jest.spyOn(cancel, 'focus');
    const title = `Remove “${FIXTURES['long-title'].book.title}” from your library?`;
    const dialog = ui.getByTestId('fa-dialog');
    expect(ui.getByText(title)).toBeTruthy();
    expect(dialog.props.accessibilityLabel).toBe(title);
    const body = ui.getByText(deletion);
    expect(body.props.nativeID).toBeTruthy();
    expect(dialog.props['aria-describedby']).toBe(body.props.nativeID);
    expect(ui.getByRole('button', { name: 'Remove book' })).toBeTruthy();
    expect(page.inert).toBe(true);
    fireEvent(dialog, 'show');
    expect(focus).toHaveBeenCalled();
    fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
    expect(page.inert).toBe(false);
});

it('A: includes deletion consequences in the native dialog announcement', () => {
    Platform.OS = 'ios';
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" initialOpen="remove" />);
    expect(ui.getByTestId('fa-dialog').props.accessibilityLabel)
        .toBe(`Remove “Walden” from your library? ${deletion}`);
});

it.each(PHASES)('B: uses quiet unfilled offline text and disables edits semantically in %s', phase => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
        const ui = render(<BookDetailsPrototype preset="offline" phase={phase} />);
        const notice = ui.getByText('Offline · Showing saved content.');
        expect(StyleSheet.flatten(notice.props.style)).toMatchObject({
            color: getLibraryAppearance(phase).textSecondary, ...TYPE_SCALE.body,
        });
        let node = notice;
        while (node.props.testID !== 'fa-page') {
            expect(StyleSheet.flatten(node.props.style)?.backgroundColor).toBeUndefined();
            node = node.parent!;
        }
        const group = ui.getByLabelText('Reading status');
        expect(group.props.accessibilityState.disabled).toBe(true);
        expect(group.props['aria-disabled']).toBe(true);
        expect(StyleSheet.flatten(group.props.style).opacity).toBeLessThan(1);
        const radios = ui.getAllByRole('radio');
        for (const radio of radios) {
            expect(radio).toBeDisabled();
            expect(radio.props.tabIndex).toBe(-1);
        }
        const webRadios = (): TestNode[] => ui.UNSAFE_root.findAll((node: TestNode) =>
            node.props.accessibilityRole === 'radio' && 'aria-checked' in node.props);
        expect(webRadios().every(radio => radio.props['aria-disabled'] === true)).toBe(true);
        fireEvent.press(radios[0]);
        fireEvent(radios[1], 'keyDown', { key: 'ArrowRight', preventDefault: jest.fn() });
        expect(webRadios().map(radio => radio.props['aria-checked'])).toEqual([false, true, false]);
        const primary = ui.getByRole('button', { name: 'Add note' });
        expect(primary).toBeDisabled();
        expect(ui.UNSAFE_root.findAll((node: TestNode) => node.props.testID === 'fa-primary' &&
            'aria-disabled' in node.props)[0].props['aria-disabled']).toBe(true);
        expect(StyleSheet.flatten(primary.props.style).opacity).toBeLessThan(1);
        expect(ui.getByTestId('fa-action').findAll((node: TestNode) => typeof node.type === 'string' &&
            ['fa-connection-notice', 'fa-primary'].includes(node.props.testID)).map((node: TestNode) => node.props.testID))
            .toEqual(['fa-connection-notice', 'fa-primary']);
        expect(ui.getByText('Changes need a connection.')).toBeTruthy();
        fireEvent.press(primary);
        const remove = ui.getByRole('button', { name: 'Remove from library' });
        expect(remove).toBeDisabled();
        expect(StyleSheet.flatten(remove.props.style).opacity).toBeLessThan(1);
        fireEvent.press(remove);
        expect(ui.queryByTestId('fa-dialog')).toBeNull();
        expect(info).not.toHaveBeenCalled();
        expect(ui.getAllByTestId('fa-primary')).toHaveLength(1);
    } finally { info.mockRestore(); }
});

it('C: keeps saved content in refresh-failed and offers a quiet TextButton retry in every switcher phase', () => {
    expect(PRESETS).toContain('refresh-failed');
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
        const ui = render(<BookDetailsPrototype preset="refresh-failed" phase="daylight" />);
        expect(ui.getByText('Walden')).toBeTruthy();
        expect(ui.getAllByTestId(/^fa-note-.*-body$/)).toHaveLength(2);
        expect(ui.getByRole('button', { name: 'Add note' })).toBeEnabled();
        const notice = ui.getByText("Couldn't refresh.");
        expect(StyleSheet.flatten(notice.props.style)).toMatchObject({ color: colors.textSecondary, ...TYPE_SCALE.body });
        expect(StyleSheet.flatten(notice.parent!.props.style).backgroundColor).toBeUndefined();
        const retry = ui.getByRole('button', { name: 'Try again' });
        expect(retry.props.testID).not.toBe('fa-primary');
        expect(StyleSheet.flatten(retry.props.style).backgroundColor).toBeUndefined();
        fireEvent.press(retry);
        expect(info).toHaveBeenCalledWith('[FA-P1] would retry book');
        ui.unmount();
        const switcher = render(<PrototypeSwitcher phase="daylight" />);
        for (const phase of PHASES) expect(switcher.getByRole('link', { name: `refresh-failed · ${phase}` })).toBeTruthy();
    } finally { info.mockRestore(); }
});

it('D: uses the approved review and empty community copy, preserving ownership disclosures with extra details', () => {
    const ui = render(<BookDetailsPrototype preset="review-absent" phase="daylight" />);
    expect(ui.getByText('Your review')).toBeTruthy();
    expect(ui.getByText('No review yet.')).toBeTruthy();
    expect(ui.queryByText('My review')).toBeNull();
    const community = ui.getByText('No community reviews.');
    expect(community.parent!.props.onPress).toBeUndefined();
    expect(community.parent!.props.focusable).not.toBe(true);
    expect(community.parent!.props.accessibilityRole).toBeUndefined();
    expect(within(community.parent!).queryByText(/chevron/)).toBeNull();
    expect(ui.queryByTestId('fa-row-community')).toBeNull();
    expect(OPEN_ROWS).not.toContain('community');
    ui.rerender(<BookDetailsPrototype preset="lent-out" phase="daylight" />);
    fireEvent.press(ui.getByTestId('fa-row-ownership'));
    expect(ui.getByTestId('fa-expanded-ownership')).toBeTruthy();
});

it.each([
    ['error', "Couldn't load this book.", 'Try again', 'Check your connection and try again.'],
    ['not-found', "This book isn't in your library.", 'Back to Library', 'It may have been removed.'],
] as const)('D: keeps %s concise without redundant explanatory copy', (preset, heading, action, removed) => {
    const ui = render(<BookDetailsPrototype preset={preset} phase="daylight" />);
    expect(ui.getByText(heading)).toBeTruthy();
    expect(ui.getByTestId('fa-primary').props.accessibilityLabel).toBe(action);
    expect(ui.queryByText(removed)).toBeNull();
});

it.each(['quote', 'reflect', 'distill', 'apply', 'question', null] as const)(
    'E: uses bodySerif for category %s, with quotation marks only for quotes', tag => {
        const note = { ...FIXTURES.populated.notes[0], tag };
        const ui = render(<LibraryTypographyProvider><NotePassages notes={[note]} state="populated" colors={colors} /></LibraryTypographyProvider>);
        const passage = ui.getByTestId(`fa-note-${note.id}-body`);
        expect(StyleSheet.flatten(passage.props.style)).toMatchObject({ ...TYPE_SCALE.bodySerif, fontFamily: 'LibraryGaramondMedium' });
        expect(passage.props.children).toBe(tag === 'quote' ? `“${note.content}”` : note.content);
        expect(StyleSheet.flatten(ui.getByTestId(`fa-note-${note.id}-meta`).props.style)).toMatchObject(TYPE_SCALE.caption);
    },
);

it('F: exposes checked state and changes selection on DOM arrow events, including vertical arrows', () => {
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    const preventDefault = jest.fn();
    // Native Pressable consumes aria-* into accessibilityState. Inspect its
    // input props too: RN-web forwards these props to the DOM.
    const webRadios = (): TestNode[] => ui.UNSAFE_root.findAll((node: TestNode) =>
        node.props.accessibilityRole === 'radio' && 'aria-checked' in node.props);
    for (const [key, expected] of [['ArrowRight', 2], ['ArrowRight', 0], ['ArrowLeft', 2], ['ArrowDown', 0], ['ArrowUp', 2]] as const) {
        const current = ui.getAllByRole('radio').find(radio => radio.props.accessibilityState.checked);
        expect(current).toBeTruthy();
        fireEvent(current!, 'keyDown', { key, preventDefault });
        const radios = ui.getAllByRole('radio');
        expect(webRadios().map(radio => radio.props['aria-checked'])).toEqual([0, 1, 2].map(index => index === expected));
        expect(radios.map(radio => radio.props.accessibilityState.checked)).toEqual([0, 1, 2].map(index => index === expected));
        expect(radios.map(radio => radio.props.tabIndex)).toEqual([0, 1, 2].map(index => index === expected ? 0 : -1));
    }
});

it('F: exposes expanded state, a notes link without expanded state, and only the two page headings', () => {
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    const webRow = (id: string) => ui.UNSAFE_root.findAll((node: TestNode) =>
        node.props.testID === `fa-row-${id}` && 'aria-expanded' in node.props)[0];
    for (const id of ['review', 'saved', 'info']) {
        expect(webRow(id).props['aria-expanded']).toBe(false);
        fireEvent.press(ui.getByTestId(`fa-row-${id}`));
        expect(webRow(id).props['aria-expanded']).toBe(true);
        expect(ui.getByTestId(`fa-row-${id}`).props.accessibilityState.expanded).toBe(true);
    }
    const link = ui.getByRole('link', { name: 'All notes' });
    expect(link.props['aria-expanded']).toBeUndefined();
    expect(webRow('notes').props['aria-expanded']).toBeUndefined();
    expect(link.props.accessibilityState?.expanded).toBeUndefined();
    expect(ui.getByRole('heading', { name: 'Walden' }).props['aria-level']).toBe(1);
    expect(ui.getByRole('heading', { name: 'Your notes' }).props['aria-level']).toBe(2);
    expect(ui.getAllByRole('heading')).toHaveLength(2);
});

it('F: keeps native heading semantics', () => {
    Platform.OS = 'ios';
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    expect(ui.getByText('Walden').props.accessibilityRole).toBe('header');
    expect(ui.getByText('Your notes').props.accessibilityRole).toBe('header');
});

it.each(PHASES)('F: shows the custom focus ring on Back, radios, primary, text buttons and rows in %s', phase => {
    const ui = render(<BookDetailsPrototype preset="populated" phase={phase} />);
    const controls = [...ui.getAllByRole('button'), ...ui.getAllByRole('radio'), ui.getByRole('link', { name: 'All notes' })];
    for (const control of controls) {
        fireEvent(control, 'focus');
        expect(StyleSheet.flatten(control.props.style)).toMatchObject({
            outlineColor: getLibraryAppearance(phase).focusRing, outlineWidth: 2, outlineOffset: 2, outlineStyle: 'solid',
        });
        fireEvent(control, 'blur');
        expect(StyleSheet.flatten(control.props.style).outlineWidth).toBeUndefined();
    }
});

it('G/H: keeps an 80×120 placeholder beside a narrow title, and stacks only after four lines', () => {
    dimensions.mockReturnValue({ width: 320, height: 844, scale: 1, fontScale: 1 });
    const ui = render(<BookDetailsPrototype preset="long-title" phase="daylight" />);
    const row = ui.getByTestId('fa-cover-row');
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 288 } } });
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    expect(FIXTURES['long-title'].book.cover).toBeNull();
    expect(StyleSheet.flatten(ui.getByTestId('fa-cover-placeholder', { includeHiddenElements: true }).props.style))
        .toMatchObject({ width: 80, height: 120 });
    const title = ui.getByText(FIXTURES['long-title'].book.title);
    fireEvent(title, 'layout', { nativeEvent: { layout: { height: TYPE_SCALE.title.lineHeight * 4 } } });
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    fireEvent(title, 'layout', { nativeEvent: { layout: { height: TYPE_SCALE.title.lineHeight * 5 } } });
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
    expect(title.props.numberOfLines).toBeUndefined();
});

it.each([
    [390, 1, 'row', 'row'], [359, 1, 'row', 'column'], [390, 1.3, 'row', 'column'],
    [275, 1.5, 'column', 'column'], [195, 2, 'column', 'column'], [320, 2, 'row', 'column'],
] as const)('G: adapts cover/status at measured width %s, font scale %s without clipping labels', (width, fontScale, coverDirection, statusDirection) => {
    dimensions.mockReturnValue({ width, height: 844, scale: 1, fontScale });
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    fireEvent(ui.getByTestId('fa-cover-row'), 'layout', { nativeEvent: { layout: { width } } });
    fireEvent(ui.getByLabelText('Reading status'), 'layout', { nativeEvent: { layout: { width } } });
    ['want_to_read', 'reading', 'completed'].forEach((value, index) => {
        fireEvent(ui.getByTestId(`fa-status-measure-${value}`, { includeHiddenElements: true }), 'layout',
            { nativeEvent: { layout: { width: [96, 64, 68][index] * fontScale } } });
    });
    expect(StyleSheet.flatten(ui.getByTestId('fa-cover-row').props.style).flexDirection).toBe(coverDirection);
    const group = ui.getByLabelText('Reading status');
    expect(StyleSheet.flatten(group.props.style).flexDirection).toBe(statusDirection);
    expect(group.props['aria-orientation']).toBe(statusDirection === 'column' ? 'vertical' : 'horizontal');
    for (const label of ['Want to read', 'Reading', 'Finished']) {
        const radio = ui.getByRole('radio', { name: label });
        expect(StyleSheet.flatten(radio.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
        if (statusDirection === 'column') expect(StyleSheet.flatten(radio.props.style).width).toBe('100%');
        expect(ui.getByText(label).props.numberOfLines).toBeUndefined();
    }
});
