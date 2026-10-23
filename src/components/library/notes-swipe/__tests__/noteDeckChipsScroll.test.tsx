import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NoteDeckChips } from '../NoteDeckChips';

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn(() => ({ phase: 'daylight' })) }));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const ReactForMock = require('react');
  const MockScrollView = ReactForMock.forwardRef((props: any, ref: any) => {
    ReactForMock.useEffect(() => {
      const fake = { scrollTo: (...args: any[]) => (globalThis as any).__mockChipScrollTo?.(...args) };
      if (typeof ref === 'function') ref(fake);
      else if (ref && typeof ref === 'object') {
        try {
          ref.current = fake;
        } catch {
          /* ignore */
        }
      }
    });
    const ActualScrollView = jest.requireActual('react-native').ScrollView;
    return ReactForMock.createElement(ActualScrollView, { ...props, ref: undefined });
  });
  return new Proxy(actual, {
    get(target: unknown, prop: string | symbol) {
      if (prop === 'ScrollView') return MockScrollView;
      return (target as Record<string | symbol, unknown>)[prop];
    },
  });
});

beforeEach(() => {
  (globalThis as any).__mockChipScrollTo = jest.fn();
});

describe('C3 chips scroll (G5 behavioural)', () => {
  it('scrolls the selected chip into view via scrollTo', () => {
    const { LIBRARY_SPACING } = require('../../LibraryAppearance');
    const scrollTo = (globalThis as any).__mockChipScrollTo as jest.Mock;
    const onSelect = jest.fn();
    const ui = render(<NoteDeckChips categories={['all', 'quote', 'reflect']} selected="all" onSelect={onSelect} />);
    const chips = ui.getAllByRole('radio');
    expect(chips).toHaveLength(3);
    const layouts = [0, 160, 320];
    chips.forEach((chip, index) => {
      fireEvent(chip, 'layout', { nativeEvent: { layout: { x: layouts[index], y: 0, width: 80, height: 48 } } });
    });
    scrollTo.mockClear();
    ui.rerender(<NoteDeckChips categories={['all', 'quote', 'reflect']} selected="quote" onSelect={onSelect} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: Math.max(0, 160 - LIBRARY_SPACING.md), animated: false });
    ui.unmount();
  });
});
