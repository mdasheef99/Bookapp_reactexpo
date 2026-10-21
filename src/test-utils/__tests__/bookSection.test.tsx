import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { BookButton } from '@/components/library/ui';
import { NoteButton } from '@/components/notes/ManualNoteUi';
import { countPrimaryButtons, expectSinglePrimary } from '../bookSection';
import type { BookSectionScreen } from '../bookSection';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('react-native-safe-area-context');

const noop = () => {};

function Imposter(props: { variant: string }) {
  return (
    <View>
      <Text>{props.variant}</Text>
    </View>
  );
}

describe('bookSection DP-03 primary-button helper', () => {
  it('counts one primary among secondary, text and destructive without throwing', () => {
    const tree = render(
      <>
        <BookButton label="Save" variant="primary" onPress={noop} />
        <BookButton label="Cancel" variant="secondary" onPress={noop} />
        <BookButton label="More" variant="text" onPress={noop} />
        <BookButton label="Delete" variant="destructive" onPress={noop} />
      </>,
    );
    expect(countPrimaryButtons(tree)).toBe(1);
    expect(() => expectSinglePrimary(tree)).not.toThrow();
  });

  it('reports zero primaries with the none label list', () => {
    const tree = render(<BookButton label="Cancel" variant="secondary" onPress={noop} />);
    expect(countPrimaryButtons(tree)).toBe(0);
    let message = '';
    try {
      expectSinglePrimary(tree);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('expected exactly 1');
    expect(message).toContain('found 0');
    expect(message).toContain('none');
  });

  it('reports two primaries with their labels and the make-others-secondary guidance', () => {
    const tree = render(
      <>
        <BookButton label="Save" variant="primary" onPress={noop} />
        <BookButton label="Edit" variant="primary" onPress={noop} />
      </>,
    );
    expect(countPrimaryButtons(tree)).toBe(2);
    let message = '';
    try {
      expectSinglePrimary(tree);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('found 2');
    expect(message).toContain('"Save"');
    expect(message).toContain('"Edit"');
    expect(message).toContain('Make the others variant="secondary", "text" or "destructive".');
  });

  it('allow: 2 passes for exactly two primaries and fails for one or three', () => {
    const two = render(
      <>
        <BookButton label="Save" variant="primary" onPress={noop} />
        <BookButton label="Edit" variant="primary" onPress={noop} />
      </>,
    );
    expect(countPrimaryButtons(two)).toBe(2);
    expect(() => expectSinglePrimary(two, { allow: 2 })).not.toThrow();

    const one = render(<BookButton label="Save" variant="primary" onPress={noop} />);
    let oneMessage = '';
    try {
      expectSinglePrimary(one, { allow: 2 });
    } catch (error) {
      oneMessage = (error as Error).message;
    }
    expect(oneMessage).toContain('expected exactly 2');
    expect(oneMessage).toContain('found 1');

    const three = render(
      <>
        <BookButton label="Save" variant="primary" onPress={noop} />
        <BookButton label="Edit" variant="primary" onPress={noop} />
        <BookButton label="Again" variant="primary" onPress={noop} />
      </>,
    );
    expect(() => expectSinglePrimary(three, { allow: 2 })).toThrow();
  });

  it('counts a disabled primary as the one primary', () => {
    const tree = render(<BookButton label="Save" variant="primary" onPress={noop} disabled />);
    expect(countPrimaryButtons(tree)).toBe(1);
    expect(() => expectSinglePrimary(tree)).not.toThrow();
  });

  it.each([
    ['display none', <View key="hidden" style={{ display: 'none' }}><BookButton label="Hidden" variant="primary" onPress={noop} /></View>],
    ['accessibilityElementsHidden', <View key="hidden" accessibilityElementsHidden><BookButton label="Hidden" variant="primary" onPress={noop} /></View>],
    ['importantForAccessibility', <View key="hidden" importantForAccessibility="no-hide-descendants"><BookButton label="Hidden" variant="primary" onPress={noop} /></View>],
    ['aria-hidden', <View key="hidden" aria-hidden><BookButton label="Hidden" variant="primary" onPress={noop} /></View>],
  ])('excludes a hidden primary (%s) and keeps the visible one', (_name, hiddenWrapper) => {
    const tree = render(
      <>
        <BookButton label="Save" variant="primary" onPress={noop} />
        {hiddenWrapper}
      </>,
    );
    expect(countPrimaryButtons(tree)).toBe(1);
    expect(() => expectSinglePrimary(tree)).not.toThrow();
  });

  it('counts only the variant prop, ignoring testIDs and imposter components', () => {
    const tree = render(
      <>
        <Pressable testID="primary" onPress={noop}>
          <Text>primary</Text>
        </Pressable>
        <Imposter variant="primary" />
      </>,
    );
    expect(countPrimaryButtons(tree)).toBe(0);
  });

  it('counts a NoteButton as a primary unless it is secondary', () => {
    const primary = render(<NoteButton label="Save" onPress={noop} />);
    expect(countPrimaryButtons(primary)).toBe(1);

    const secondary = render(<NoteButton label="Save" onPress={noop} secondary />);
    expect(countPrimaryButtons(secondary)).toBe(0);
  });

  it('accepts both the render result and the imported screen object', () => {
    render(<BookButton label="Save" variant="primary" onPress={noop} />);
    expect(countPrimaryButtons(screen)).toBe(1);
    expect(() => expectSinglePrimary(screen)).not.toThrow();
  });

  function neverInvokedAllowCheck(tree: BookSectionScreen) {
    // @ts-expect-error DP-03 only allows 2 for the composer choose step
    expectSinglePrimary(tree, { allow: 3 });
  }

  it('does not count a destructive button as a primary', () => {
    // DP-03 says a destructive confirm counts as its dialog state's one primary, but this helper follows the plan (it counts variant="primary" only), so flows assert a destructive-confirm dialog directly (for example the confirm button exists with the destructive variant and the screen behind it is hidden).
    const tree = render(<BookButton label="Delete" variant="destructive" onPress={noop} />);
    expect(countPrimaryButtons(tree)).toBe(0);
  });
});
