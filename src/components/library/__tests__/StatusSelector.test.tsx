import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { StatusSelector } from '../StatusSelector';

let mockPhase: 'daylight' | 'golden' | 'midnight' = 'daylight';
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: mockPhase, colors: {} }) }));

describe('StatusSelector radio group', () => {
  it('exposes exactly one tabbable radio on web and labels Finished', () => {
    const tree = render(<StatusSelector status="reading" onChange={jest.fn()} />);
    const group = tree.getByLabelText('Reading status');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.map((r: any) => r.props.tabIndex)).toEqual([-1, 0, -1]);
    expect(tree.getByRole('radio', { name: 'Finished' })).toBeTruthy();
    expect(tree.queryByRole('radio', { name: 'Completed' })).toBeNull();
  });

  it('never calls onChange for the already-checked value', () => {
    const onChange = jest.fn();
    const tree = render(<StatusSelector status="reading" onChange={onChange} />);
    const group = tree.getByLabelText('Reading status');
    fireEvent.press(within(group).getByRole('radio', { name: 'Reading' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('arrow keys move and call onChange with the next value, never the current one', () => {
    const onChange = jest.fn();
    const tree = render(<StatusSelector status="reading" onChange={onChange} />);
    const group = tree.getByLabelText('Reading status');
    const radios = within(group).getAllByRole('radio');
    const preventDefault = jest.fn();
    fireEvent(radios[1], 'keyDown', { nativeEvent: { key: 'ArrowRight' }, preventDefault });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('completed');
    expect(preventDefault).toHaveBeenCalledTimes(1);
    onChange.mockClear();
    preventDefault.mockClear();
    tree.rerender(<StatusSelector status="completed" onChange={onChange} />);
    const nextRadios = within(tree.getByLabelText('Reading status')).getAllByRole('radio');
    fireEvent(nextRadios[2], 'keyDown', { nativeEvent: { key: 'ArrowRight' }, preventDefault });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('want_to_read');
  });

  it('sets busy on the group while keeping radios disabled', () => {
    const tree = render(<StatusSelector status="reading" onChange={jest.fn()} disabled busy />);
    const group = tree.getByLabelText('Reading status');
    expect(group.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    for (const radio of within(group).getAllByRole('radio')) {
      expect(radio.props.accessibilityState.disabled).toBe(true);
    }
  });
});

describe('large-type wrapping (fontScale 2.0)', () => {
  it('renders full segment labels without truncation props and keeps >= 44dp targets', () => {
    const tree = render(<StatusSelector status="reading" onChange={jest.fn()} />);
    const group = tree.getByLabelText('Reading status');
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      const texts = (radio as unknown as { findAll: (predicate: (node: { type?: unknown }) => boolean) => { props: { numberOfLines?: number; ellipsizeMode?: string } }[] })
        .findAll((node) => node.type === Text);
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) {
        expect(text.props.numberOfLines).toBeUndefined();
        expect(text.props.ellipsizeMode).toBeUndefined();
      }
      const style = StyleSheet.flatten(radio.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.height).toBeUndefined();
    }
    // Hidden measurement copies must not truncate either.
    for (const label of ['Want to read', 'Reading', 'Finished']) {
      for (const node of tree.UNSAFE_getAllByProps({ children: label })) {
        expect(node.props.numberOfLines).toBeUndefined();
      }
    }
  });
});

describe('Flow A fix round 1 status fallback', () => {
  it('R7 gives an unknown status a first-radio tab stop with none checked', () => {
    const ui = render(<StatusSelector status={'paused' as any} onChange={jest.fn()} />);
    const radios = within(ui.getByLabelText('Reading status')).getAllByRole('radio');
    expect(radios.map(radio => radio.props.tabIndex)).toEqual([0, -1, -1]);
    expect(radios.map(radio => radio.props.accessibilityState.checked)).toEqual([false, false, false]);
  });
});
