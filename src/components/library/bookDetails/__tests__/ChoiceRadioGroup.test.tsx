import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { ChoiceRadioGroup } from '../ChoiceRadioGroup';
import { getLibraryAppearance } from '../../LibraryAppearance';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));

const options = [
  { value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' },
] as const;
const keyEvent = (key: string) => ({ nativeEvent: { key }, preventDefault: jest.fn() });
// RN consumes aria props before the host View; inspect the nearest control ancestor.
function radioControl(radio: any): any {
  for (let current = radio; current; current = current.parent) {
    if (current.props.accessibilityRole === 'radio' && current.props['aria-checked'] !== undefined) return current;
  }
  throw new Error('Expected radio control with aria-checked');
}


describe('ChoiceRadioGroup', () => {
  it('web Space selects a focused unchecked radio once, ignoring repeats and checked values', async () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web';
    try {
      const onChange = jest.fn();
      const ui = render(<ChoiceRadioGroup label="Choose" value="a" options={options} onChange={onChange} />);
      const beta = ui.getByRole('radio', { name: 'Beta' });
      fireEvent(beta, 'focus');
      const event = { ...keyEvent(' '), repeat: true };
      fireEvent(beta, 'keyDown', event);
      await act(async () => { await Promise.resolve(); });
      expect(onChange).not.toHaveBeenCalled();
      fireEvent(beta, 'keyDown', { ...event, repeat: false });
      expect(onChange.mock.calls).toEqual([['b']]);
      expect(event.preventDefault).toHaveBeenCalledTimes(2);
      ui.rerender(<ChoiceRadioGroup label="Choose" value="b" options={options} onChange={onChange} />);
      expect(ui.getAllByRole('radio').map(radio => radio.props.accessibilityState.checked)).toEqual([false, true, false]);
      expect(ui.getAllByRole('radio').map(radio => radio.props.tabIndex)).toEqual([-1, 0, -1]);
      fireEvent(ui.getByRole('radio', { name: 'Beta' }), 'keyDown', keyEvent(' '));
      await act(async () => { await Promise.resolve(); });
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally { Platform.OS = previousOS; }
  });

  it.each(['web', 'ios'] as const)('Space respects disabled on web and leaves native activation alone (%s)', async platform => {
    const previousOS = Platform.OS;
    Platform.OS = platform;
    try {
      const onChange = jest.fn();
      const ui = render(<ChoiceRadioGroup label="Choose" value="a" options={options} onChange={onChange} disabled={platform === 'web'} />);
      const event = keyEvent(' ');
      act(() => radioControl(ui.getByRole('radio', { name: 'Beta' })).props.onKeyDown(event));
      await act(async () => { await Promise.resolve(); });
      expect(onChange).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    } finally { Platform.OS = previousOS; }
  });

  it('names the group and ordered radios, checks one, and roves with the controlled value', () => {
    const ui = render(<ChoiceRadioGroup label="Choose" value="b" options={options} onChange={jest.fn()} testID="choices" />);
    const group = ui.getByLabelText('Choose');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.testID).toBe('choices');
    expect(ui.getByText('Choose')).toBeOnTheScreen();
    expect(group.props.accessibilityState.disabled).toBe(false);
    expect(group.props['aria-disabled']).toBe(false);
    const radios = within(group).getAllByRole('radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(radios.map(r => r.props.accessibilityState.checked)).toEqual([false, true, false]);
    expect(ui.getAllByRole('radio').map(radioControl).map(r => r.props['aria-checked'])).toEqual([false, true, false]);
    expect(radios.map(r => r.props.tabIndex)).toEqual([-1, 0, -1]);
    ui.rerender(<ChoiceRadioGroup label="Choose" value="c" options={options} onChange={jest.fn()} />);
    expect(ui.getAllByRole('radio').map(r => r.props.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('tabs to the first option when no value is checked', () => {
    const ui = render(<ChoiceRadioGroup<string> label="Choose" value="missing" options={options} onChange={jest.fn()} />);
    expect(ui.getAllByRole('radio').map(r => r.props.tabIndex)).toEqual([0, -1, -1]);
    expect(ui.getAllByRole('radio').every(r => !r.props.accessibilityState.checked)).toBe(true);
  });

  it.each([
    ['ArrowRight', 'c', 2, 'a', 0], ['ArrowLeft', 'a', 0, 'c', 2],
    ['ArrowDown', 'b', 1, 'c', 2], ['ArrowUp', 'b', 1, 'a', 0],
  ] as const)('%s selects and focuses its neighbour, wrapping at either end', (key, value, index, next, nextIndex) => {
    const onChange = jest.fn();
    const ui = render(<ChoiceRadioGroup label="Choose" value={value} options={options} onChange={onChange} />);
    const focus = ui.UNSAFE_getAllByType(View).filter(node => node.props.accessibilityRole === 'radio')
      .map(node => { const focus = jest.fn(); node.instance.focus = focus; return focus; });
    const event = keyEvent(key);
    fireEvent(ui.getAllByRole('radio')[index], 'keyDown', event);
    expect(onChange.mock.calls).toEqual([[next]]);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(focus[nextIndex]).toHaveBeenCalledTimes(1);
    focus.filter((_, i) => i !== nextIndex).forEach(spy => expect(spy).not.toHaveBeenCalled());
  });

  it('ignores checked presses and arrows to the checked value, but sends raw values for changes', () => {
    const onChange = jest.fn();
    const ui = render(<ChoiceRadioGroup label="Choose" value="b" options={options} onChange={onChange} />);
    fireEvent.press(ui.getByRole('radio', { name: 'Beta' }));
    fireEvent(ui.getByRole('radio', { name: 'Alpha' }), 'keyDown', keyEvent('ArrowRight'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(ui.getByRole('radio', { name: 'Gamma' }));
    expect(onChange.mock.calls).toEqual([['c']]);
  });

  it('guards disabled presses and keys inside the handlers, disables every radio and removes all tab stops', () => {
    const onChange = jest.fn();
    const ui = render(<ChoiceRadioGroup label="Choose" value="b" options={options} onChange={onChange} disabled />);
    const group = ui.getByLabelText('Choose');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityState.disabled).toBe(true);
    expect(group.props['aria-disabled']).toBe(true);
    expect(StyleSheet.flatten(group.props.style).opacity).toBe(0.5);
    for (const radio of ui.getAllByRole('radio')) {
      expect(radio.props.accessibilityState.disabled).toBe(true);
      expect(ui.getAllByRole('radio').map(radioControl).every(r => r.props['aria-disabled'] === true)).toBe(true);
      expect(radio.props.tabIndex).toBe(-1);
      fireEvent.press(radio);
      fireEvent(radio, 'keyDown', keyEvent('ArrowRight'));
    }
    // Bypass Pressable's own event suppression to prove the component guards too.
    for (const radio of ui.getAllByRole('radio').map(radioControl)) {
      radio.props.onPress();
      const event = keyEvent('ArrowLeft');
      radio.props.onKeyDown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses 48 dp targets, selected borders and different text weight, plus a web focus ring', () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web';
    try {
      const ui = render(<ChoiceRadioGroup label="Choose" value="b" options={options} onChange={jest.fn()} />);
      const colors = getLibraryAppearance('daylight');
      for (const radio of ui.getAllByRole('radio')) {
        const style = StyleSheet.flatten(radio.props.style);
        expect(style.minHeight).toBeGreaterThanOrEqual(48);
        expect(style.minWidth).toBeGreaterThanOrEqual(48);
        expect(style.borderWidth).toBe(1);
      }
      const checked = ui.getByRole('radio', { name: 'Beta' });
      const unchecked = ui.getByRole('radio', { name: 'Alpha' });
      const weight = (radio: typeof checked) => StyleSheet.flatten(within(radio).UNSAFE_getByType(Text).props.style).fontWeight ?? '400';
      expect(weight(checked)).toBe('700');
      expect(weight(unchecked)).toBe('400');
      expect(StyleSheet.flatten(checked.props.style)).toMatchObject({ backgroundColor: colors.bgCard, borderColor: colors.controlBorder });
      expect(StyleSheet.flatten(unchecked.props.style)).toMatchObject({ backgroundColor: colors.bgSecondary, borderColor: colors.bgSecondary });
      fireEvent(checked, 'focus');
      expect(StyleSheet.flatten(ui.getByRole('radio', { name: 'Beta' }).props.style)).toMatchObject({ outlineColor: colors.focusRing, outlineWidth: 2 });
      fireEvent(checked, 'blur');
      expect(StyleSheet.flatten(ui.getByRole('radio', { name: 'Beta' }).props.style).outlineWidth).toBeUndefined();
    } finally { Platform.OS = previousOS; }
  });
});
