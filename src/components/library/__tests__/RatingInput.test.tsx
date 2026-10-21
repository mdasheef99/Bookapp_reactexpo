import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { RatingInput } from '../RatingInput';
import { getLibraryAppearance } from '../LibraryAppearance';
import { ICON_SIZE } from '../bookDetails/bookDetailsTokens';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
const keyEvent = (key: string) => ({ nativeEvent: { key }, preventDefault: jest.fn() });
// RN consumes aria props before the host View; inspect the nearest control ancestor.
function radioControl(radio: any): any {
  for (let current = radio; current; current = current.parent) {
    if (current.props.accessibilityRole === 'radio' && current.props['aria-checked'] !== undefined) return current;
  }
  throw new Error('Expected radio control with aria-checked');
}


describe('RatingInput radio group', () => {
  it.each([0, 1, 2, 3, 4, 5])('names five ordered radios and checks only rating %i, with roving tabIndex', rating => {
    const ui = render(<RatingInput rating={rating} onChange={jest.fn()} />);
    const group = ui.getByLabelText('Your rating');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(ui.getByText('Your rating')).toBeOnTheScreen();
    expect(group.props.accessibilityState.disabled).toBe(false);
    expect(group.props['aria-disabled']).toBe(false);
    const radios = within(group).getAllByRole('radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(['1 star', '2 stars', '3 stars', '4 stars', '5 stars']);
    expect(radios.map(r => r.props.accessibilityState.checked)).toEqual([1, 2, 3, 4, 5].map(v => v === rating));
    expect(ui.getAllByRole('radio').map(radioControl).map(r => r.props['aria-checked'])).toEqual([1, 2, 3, 4, 5].map(v => v === rating));
    expect(radios.map(r => r.props.tabIndex)).toEqual([1, 2, 3, 4, 5].map(v => v === (rating || 1) ? 0 : -1));
  });

  it('still calls onChange(3) when pressing the checked third star', () => {
    const onChange = jest.fn();
    const ui = render(<RatingInput rating={3} onChange={onChange} />);
    fireEvent.press(ui.getByRole('radio', { name: '3 stars' }));
    expect(onChange.mock.calls).toEqual([[3]]);
  });

  it('blocks disabled presses and keys inside handlers and removes all tab stops', () => {
    const onChange = jest.fn();
    const ui = render(<RatingInput rating={3} onChange={onChange} disabled />);
    const group = ui.getByLabelText('Your rating');
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
    for (const radio of ui.getAllByRole('radio').map(radioControl)) {
      radio.props.onPress();
      const event = keyEvent('ArrowLeft');
      radio.props.onKeyDown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ['ArrowRight', 5, 1], ['ArrowLeft', 1, 5], ['ArrowDown', 3, 4], ['ArrowUp', 3, 2],
  ] as const)('%s moves selection and focus with wrapping', (key, rating, next) => {
    const onChange = jest.fn();
    const ui = render(<RatingInput rating={rating} onChange={onChange} />);
    const focus = ui.UNSAFE_getAllByType(View).filter(node => node.props.accessibilityRole === 'radio')
      .map(node => { const focus = jest.fn(); node.instance.focus = focus; return focus; });
    const event = keyEvent(key);
    fireEvent(ui.getAllByRole('radio')[rating - 1], 'keyDown', event);
    expect(onChange.mock.calls).toEqual([[next]]);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(focus[next - 1]).toHaveBeenCalledTimes(1);
    focus.filter((_, i) => i !== next - 1).forEach(spy => expect(spy).not.toHaveBeenCalled());
  });

  it('uses 48 dp targets and hidden token-sized icons without star text, with a web focus ring', () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web';
    try {
      const ui = render(<RatingInput rating={3} onChange={jest.fn()} />);
      const colors = getLibraryAppearance('daylight');
      for (const radio of ui.getAllByRole('radio')) {
        const style = StyleSheet.flatten(radio.props.style);
        expect(style.minHeight).toBeGreaterThanOrEqual(48);
        expect(style.minWidth).toBeGreaterThanOrEqual(48);
      }
      const icons = ui.UNSAFE_getAllByType('Ionicons' as any);
      expect(icons).toHaveLength(5);
      icons.forEach((icon, index) => {
        expect(icon.props.accessible).toBe(false);
        expect(icon.props['aria-hidden']).toBe(true);
        expect(icon.props.name).toBe(index < 3 ? 'star' : 'star-outline');
        expect(icon.props.color).toBe(index < 3 ? colors.textPrimary : colors.textSecondary);
        expect(icon.props.size).toBe(ICON_SIZE);
      });
      for (const node of ui.UNSAFE_getAllByType(Text)) expect(JSON.stringify(node.props.children)).not.toContain('★');
      fireEvent(ui.getByRole('radio', { name: '3 stars' }), 'focus');
      expect(StyleSheet.flatten(ui.getByRole('radio', { name: '3 stars' }).props.style)).toMatchObject({ outlineColor: colors.focusRing, outlineWidth: 2 });
      fireEvent(ui.getByRole('radio', { name: '3 stars' }), 'blur');
      expect(StyleSheet.flatten(ui.getByRole('radio', { name: '3 stars' }).props.style).outlineWidth).toBeUndefined();
    } finally { Platform.OS = previousOS; }
  });
});
