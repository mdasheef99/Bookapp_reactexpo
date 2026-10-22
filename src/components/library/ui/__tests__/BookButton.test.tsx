import React from 'react';
import { StyleSheet, type PressableProps } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { getLibraryAppearance, MIN_TARGET } from '@/components/library/LibraryAppearance';
import { BookButton, type BookButtonVariant } from '@/components/library/ui';

const PHASES = ['daylight', 'golden', 'midnight'] as const;
let mockPhase: (typeof PHASES)[number] = 'daylight';
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: mockPhase, colors: {} }) }));

const VARIANTS: BookButtonVariant[] = ['primary', 'secondary', 'text', 'destructive'];

describe.each(PHASES)('BookButton in %s', phase => {
  beforeEach(() => { mockPhase = phase; });

  it.each(VARIANTS)('renders an accessible %s button with the matching palette and original typography', variant => {
    const colors = getLibraryAppearance(phase);
    const expected = {
      primary: { backgroundColor: colors.accent, borderColor: colors.controlBorder, color: colors.textOnAccent },
      secondary: { backgroundColor: colors.bgCard, borderColor: colors.controlBorder, color: colors.textPrimary },
      text: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.accent },
      destructive: { backgroundColor: colors.error, borderColor: colors.error, color: colors.onErrorSurface },
    }[variant];
    const tree = render(<BookButton label="Save note" variant={variant} onPress={jest.fn()} />);
    const button = tree.getByRole('button', { name: 'Save note' });

    expect(button.props.accessibilityLabel).toBe('Save note');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      minHeight: MIN_TARGET, minWidth: MIN_TARGET,
      paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center', opacity: 1,
      backgroundColor: expected.backgroundColor, borderColor: expected.borderColor,
    });
    const labelStyle = StyleSheet.flatten(tree.getByText('Save note').props.style);
    expect(labelStyle).toMatchObject({ color: expected.color, fontSize: 16, fontWeight: '600', textAlign: 'center' });
    expect(labelStyle.fontFamily).toBeUndefined();
    expect(tree.UNSAFE_getAllByType(BookButton)[0].props.variant).toBe(variant);
  });

  it.each(VARIANTS)('keeps disabled semantics and opacity ahead of pressed feedback for %s', variant => {
    const onPress = jest.fn();
    const tree = render(<BookButton label="Save note" variant={variant} onPress={onPress} />);
    const pressable = () => tree.UNSAFE_root.find((node: { props: PressableProps }) => node.props.accessibilityRole === 'button' && typeof node.props.style === 'function');
    expect(tree.getByRole('button').props.accessibilityState.disabled).toBe(false);
    expect(pressable().props.disabled).toBe(false);
    expect(StyleSheet.flatten(pressable().props.style({ pressed: true })).opacity).toBe(0.8);
    fireEvent.press(tree.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);

    onPress.mockClear();
    tree.rerender(<BookButton label="Save note" variant={variant} onPress={onPress} disabled />);
    const button = tree.getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(pressable().props.disabled).toBe(true);
    expect(StyleSheet.flatten(button.props.style).opacity).toBe(0.55);
    expect(StyleSheet.flatten(pressable().props.style({ pressed: true })).opacity).toBe(0.55);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

it('uses minHeight (not a fixed height) so labels can grow at fontScale 2.0', () => {
  const tree = render(<BookButton label="Read again" variant="secondary" onPress={jest.fn()} />);
  const style = StyleSheet.flatten(tree.getByRole('button', { name: 'Read again' }).props.style);
  expect(style.minHeight).toBe(MIN_TARGET);
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
  expect(style.height).toBeUndefined();
  expect(tree.getByText('Read again').props.numberOfLines).toBeUndefined();
});

it('passes through an optional testID without making it the variant contract', () => {
  const tree = render(<BookButton label="Save" variant="primary" onPress={jest.fn()} testID="save" />);
  expect(tree.getByRole('button', { name: 'Save' }).props.testID).toBe('save');
});

it('preserves an empty accessibility label so an empty-label caller remains visible', () => {
  const tree = render(<BookButton label="" variant="primary" onPress={jest.fn()} />);
  expect(tree.getByRole('button').props.accessibilityLabel).toBe('');
});

it('defaults the accessible name to the label and lets accessibilityLabel override it', () => {
  const plain = render(<BookButton label="Edit" variant="text" onPress={jest.fn()} />);
  expect(plain.getByRole('button', { name: 'Edit' }).props.accessibilityLabel).toBe('Edit');
  plain.unmount();
  const named = render(
    <BookButton label="Edit" accessibilityLabel="Edit your rating and review" variant="text" onPress={jest.fn()} />,
  );
  const button = named.getByRole('button', { name: 'Edit your rating and review' });
  expect(button.props.accessibilityLabel).toBe('Edit your rating and review');
  expect(named.getByText('Edit')).toBeOnTheScreen();
});
