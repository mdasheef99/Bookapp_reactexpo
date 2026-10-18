import React from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { BookDetailsPrototype } from '../BookDetailsPrototype';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
    __esModule: true, default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@expo/vector-icons', () => {
    const { Text } = require('react-native');
    return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});

const dimensions = jest.mocked(useWindowDimensions);
const originalOS = Platform.OS;
const layout = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 48 } } });
const values = ['want_to_read', 'reading', 'completed'];
const labels = ['Want to read', 'Reading', 'Finished'];

beforeEach(() => {
    Platform.OS = 'web';
    dimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
});
afterEach(() => { Platform.OS = originalOS; });

it('stacks the cover and full-width status rows at a measured 195px despite a 390px window', () => {
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    fireEvent(ui.getByTestId('fa-cover-row'), 'layout', layout(195));
    fireEvent(ui.getByLabelText('Reading status'), 'layout', layout(195));
    expect(StyleSheet.flatten(ui.getByTestId('fa-cover-row').props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(ui.getByTestId('fa-title-block').props.style)).toMatchObject({ width: '100%', minWidth: 0 });
    expect(StyleSheet.flatten(ui.getByLabelText('Reading status').props.style).flexDirection).toBe('column');
    expect(ui.getByLabelText('Reading status').props['aria-orientation']).toBe('vertical');
    for (const label of labels) {
        expect(StyleSheet.flatten(ui.getByRole('radio', { name: label }).props.style))
            .toMatchObject({ width: '100%', minHeight: 48, flex: 0 });
    }
    for (const label of ['Walden', 'Henry David Thoreau', ...labels]) {
        expect(StyleSheet.flatten(ui.getByText(label).props.style))
            .toMatchObject({ overflowWrap: 'normal', wordWrap: 'normal', wordBreak: 'normal' });
        expect(ui.getByText(label).props.numberOfLines).toBeUndefined();
    }
});

it('stacks only when the measured space beside the small cover is below 180px, and recovers on resize', () => {
    const ui = render(<BookDetailsPrototype preset="no-cover" phase="daylight" />);
    const row = ui.getByTestId('fa-cover-row');
    fireEvent(row, 'layout', layout(275));
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
    expect(StyleSheet.flatten(ui.getByTestId('fa-cover-placeholder', { includeHiddenElements: true }).props.style))
        .toMatchObject({ width: 80, height: 120 });
    fireEvent(row, 'layout', layout(276));
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    fireEvent(row, 'layout', layout(195));
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
    fireEvent(row, 'layout', layout(390));
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
});

it('uses measured single-line label widths, including padding and borders, then rechecks font changes', () => {
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    const group = ui.getByLabelText('Reading status');
    fireEvent(group, 'layout', layout(390));
    const measure = (widths: number[]) => values.forEach((value, index) => {
        fireEvent(ui.getByTestId(`fa-status-measure-${value}`, { includeHiddenElements: true }), 'layout', layout(widths[index]));
    });
    measure([96, 64, 68]);
    expect(group.props['aria-orientation']).toBe('horizontal');
    // Each 127.33px segment has 8px horizontal padding and two 1px borders.
    measure([118, 64, 68]);
    expect(group.props['aria-orientation']).toBe('vertical');
    measure([96, 64, 68]);
    expect(group.props['aria-orientation']).toBe('horizontal');
    fireEvent(group, 'layout', layout(359));
    expect(group.props['aria-orientation']).toBe('vertical');
    fireEvent(group, 'layout', layout(390));
    expect(group.props['aria-orientation']).toBe('horizontal');
    expect(ui.getAllByRole('radio')).toHaveLength(3);
    for (const value of values) {
        const probe = ui.getByTestId(`fa-status-measure-${value}`, { includeHiddenElements: true });
        expect(StyleSheet.flatten(probe.props.style).fontWeight).toBe('700');
        expect(ui.queryByTestId(`fa-status-measure-${value}`)).toBeNull();
    }
});

it('keeps rows when the measured space and labels fit even with a narrow window and large font scale', () => {
    dimensions.mockReturnValue({ width: 320, height: 844, scale: 1, fontScale: 2 });
    const ui = render(<BookDetailsPrototype preset="populated" phase="daylight" />);
    fireEvent(ui.getByTestId('fa-cover-row'), 'layout', layout(620));
    fireEvent(ui.getByLabelText('Reading status'), 'layout', layout(620));
    values.forEach((value, index) => {
        fireEvent(ui.getByTestId(`fa-status-measure-${value}`, { includeHiddenElements: true }), 'layout', layout([192, 128, 136][index]));
    });
    expect(StyleSheet.flatten(ui.getByTestId('fa-cover-row').props.style).flexDirection).toBe('row');
    expect(ui.getByLabelText('Reading status').props['aria-orientation']).toBe('horizontal');
});
