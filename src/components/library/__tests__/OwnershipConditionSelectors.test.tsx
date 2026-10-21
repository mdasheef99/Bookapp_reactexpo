import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { OwnershipSelector, type Ownership } from '../OwnershipSelector';
import { ConditionPicker, type Condition } from '../ConditionPicker';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));

describe('OwnershipSelector', () => {
  it.each(['owned', 'lent_out', 'borrowed', 'wishlist'] as Ownership[])('uses the exact ordered labels and checks %s from the prop', ownership => {
    const ui = render(<OwnershipSelector ownership={ownership} onChange={jest.fn()} />);
    const group = ui.getByLabelText('Ownership');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(['Owned', 'Lent out', 'Borrowed', 'Wishlist']);
    expect(radios.map(r => r.props.accessibilityState.checked)).toEqual(['owned', 'lent_out', 'borrowed', 'wishlist'].map(v => v === ownership));
  });
  it('sends lent_out and forwards disabled', () => {
    const onChange = jest.fn();
    const ui = render(<OwnershipSelector ownership="owned" onChange={onChange} />);
    fireEvent.press(ui.getByRole('radio', { name: 'Lent out' }));
    expect(onChange.mock.calls).toEqual([['lent_out']]);
    ui.rerender(<OwnershipSelector ownership="owned" onChange={onChange} disabled />);
    expect(ui.getAllByRole('radio').every(r => r.props.accessibilityState.disabled)).toBe(true);
  });
});

describe('ConditionPicker', () => {
  it.each(['new', 'like_new', 'good', 'acceptable', 'poor'] as Condition[])('uses the exact ordered labels and checks %s from the prop', condition => {
    const ui = render(<ConditionPicker condition={condition} onChange={jest.fn()} />);
    const group = ui.getByLabelText('Condition');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(['New', 'Like new', 'Good', 'Fair', 'Poor']);
    expect(radios.map(r => r.props.accessibilityState.checked)).toEqual(['new', 'like_new', 'good', 'acceptable', 'poor'].map(v => v === condition));
  });
  it('sends acceptable for Fair and forwards disabled', () => {
    const onChange = jest.fn();
    const ui = render(<ConditionPicker condition="good" onChange={onChange} />);
    fireEvent.press(ui.getByRole('radio', { name: 'Fair' }));
    expect(onChange.mock.calls).toEqual([['acceptable']]);
    ui.rerender(<ConditionPicker condition="good" onChange={onChange} disabled />);
    expect(ui.getAllByRole('radio').every(r => r.props.accessibilityState.disabled)).toBe(true);
  });
});
