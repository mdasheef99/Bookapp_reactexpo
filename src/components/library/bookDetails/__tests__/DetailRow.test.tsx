import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DetailRow } from '../DetailRow';
import { getLibraryAppearance } from '../../LibraryAppearance';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});

describe('DetailRow', () => {
  const colors = getLibraryAppearance('daylight');

  it('renders a non-interactive View when onPress is omitted', () => {
    const ui = render(<DetailRow id="info" label="Book information" secondary="No details" absent />);
    const row = ui.getByTestId('book-row-info');
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(row.props.onPress).toBeUndefined();
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      minHeight: 56,
      borderColor: colors.divider,
    });
    expect(StyleSheet.flatten(row.props.style).backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(ui.getByText('No details').props.style).color).toBe(colors.textTertiary);
  });

  it('lets the summary wrap to two lines so narrow widths do not hide it', () => {
    const ui = render(<DetailRow id="ownership" label="Ownership & condition" secondary="Owned · Like new" onPress={jest.fn()} expanded={false} />);
    expect(ui.getByText('Owned · Like new').props.numberOfLines).toBe(2);
  });

  it('renders a link row with role="link" and no expanded state', () => {
    const onPress = jest.fn();
    const ui = render(<DetailRow id="notes" label="All notes" link onPress={onPress} />);
    const row = ui.getByRole('link', { name: 'All notes' });
    expect(row.props.testID).toBe('book-row-notes');
    expect(row.props.accessibilityState?.expanded).toBeUndefined();
    expect(row.props['aria-expanded']).toBeUndefined();
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a disclosure row with expanded state, accessible name, and expanded container', () => {
    const onPress = jest.fn();
    const ui = render(
      <DetailRow id="review" label="Your review" secondary="No review yet." absent expanded={false} onPress={onPress}>
        <Text>Expanded content</Text>
      </DetailRow>
    );
    const webRow = () =>
      ui.UNSAFE_root.findAll((node: any) => node.props.testID === 'book-row-review' && 'aria-expanded' in node.props)[0];
    const row = ui.getByRole('button', { name: 'Your review, No review yet.' });
    expect(row.props.accessibilityState).toEqual({ expanded: false });
    expect(webRow().props['aria-expanded']).toBe(false);
    expect(ui.queryByTestId('book-expanded-review')).toBeNull();

    ui.rerender(
      <DetailRow id="review" label="Your review" secondary="First line" expanded={true} onPress={onPress}>
        <Text>Expanded content</Text>
      </DetailRow>
    );
    const openRow = ui.getByRole('button', { name: 'Your review, First line' });
    expect(openRow.props.accessibilityState).toEqual({ expanded: true });
    expect(webRow().props['aria-expanded']).toBe(true);
    expect(StyleSheet.flatten(ui.getByText('First line').props.style).color).toBe(colors.textSecondary);
    expect(ui.getByTestId('book-expanded-review')).toBeTruthy();
    expect(ui.getByText('Expanded content')).toBeTruthy();
  });

  it('shows web focus ring on focus and removes it on blur', () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web';
    try {
      const ui = render(<DetailRow id="notes" label="All notes" link onPress={() => {}} />);
      const row = ui.getByTestId('book-row-notes');
      fireEvent(row, 'focus');
      expect(StyleSheet.flatten(ui.getByTestId('book-row-notes').props.style)).toMatchObject({
        outlineWidth: 2,
        outlineOffset: 2,
        outlineStyle: 'solid',
        outlineColor: colors.focusRing,
      });
      fireEvent(ui.getByTestId('book-row-notes'), 'blur');
      expect(StyleSheet.flatten(ui.getByTestId('book-row-notes').props.style).outlineWidth).toBeUndefined();
    } finally {
      Platform.OS = previousOS;
    }
  });
});
