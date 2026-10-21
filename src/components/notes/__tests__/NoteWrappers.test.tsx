import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { BookButton, BookScreenHeader } from '@/components/library/ui';
import { NoteButton, NoteScreen } from '../ManualNoteUi';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('react-native-safe-area-context');

describe('notes wrappers delegate to shared library controls', () => {
  it.each([false, true])('maps secondary=%s to the shared variant while preserving button props', secondary => {
    const onPress = jest.fn();
    const tree = render(<NoteButton label="Save note" onPress={onPress} {...(secondary ? { secondary } : {})} />);
    expect(tree.UNSAFE_getByType(BookButton).props).toEqual({
      label: 'Save note', onPress, variant: secondary ? 'secondary' : 'primary', disabled: false,
    });
    fireEvent.press(tree.getByRole('button', { name: 'Save note' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    tree.rerender(<NoteButton label="Save note" onPress={onPress} secondary={secondary} disabled />);
    expect(tree.UNSAFE_getByType(BookButton).props.disabled).toBe(true);
    fireEvent.press(tree.getByRole('button', { name: 'Save note' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('forwards the screen header props and still renders ordinary children and footer', () => {
    const onBack = jest.fn();
    const tree = render(<NoteScreen title="Notes" bookTitle="A book" backLabel="Back to Library" onBack={onBack} footer={<Text>Footer</Text>}>
      <Text>Content</Text>
    </NoteScreen>);
    expect(tree.UNSAFE_getByType(BookScreenHeader).props).toEqual({ title: 'Notes', bookTitle: 'A book', backLabel: 'Back to Library', onBack });
    expect(tree.getByText('Content')).toBeTruthy();
    expect(tree.getByText('Footer')).toBeTruthy();
    fireEvent.press(tree.getByRole('button', { name: 'Back to Library' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('preserves render-prop header/footer ownership with scrollChrome=%s', scrollChrome => {
    const children = jest.fn((header: React.ReactNode, footer: React.ReactNode) => <>{header}<Text>Content</Text>{footer}</>);
    const tree = render(<NoteScreen title="Notes" backLabel="Back to Library" onBack={jest.fn()} scrollChrome={scrollChrome} footer={<Text>Footer</Text>}>
      {children}
    </NoteScreen>);
    expect(tree.UNSAFE_getAllByType(BookScreenHeader)).toHaveLength(1);
    expect(tree.getAllByText('Footer')).toHaveLength(1);
    expect(tree.getByText('Content')).toBeTruthy();
    const [header, footer] = children.mock.calls[0];
    if (scrollChrome) {
      expect(React.isValidElement(header) && header.type).toBe(BookScreenHeader);
      expect(React.isValidElement(footer)).toBe(true);
    } else {
      expect([header, footer]).toEqual([null, null]);
    }
  });
});
