/** Actual shared picker output mapped by the installed RN Web DOM converter; no browser claim. */
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CategoryPicker } from '../ManualNoteUi';
import { NOTE_CATEGORIES } from '@/features/books/notes/manualNoteContract';

// Load lazy RN primitives before the first interaction's default timeout.
void [Pressable, Text, View];
// SDD-07 FU-1b: the picker resolves every colour from the book-section palette, which
// useLibraryAppearance derives from `phase` alone, so the phase is this mock's only key.
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));

const createDOMProps = require('react-native-web/dist/cjs/modules/createDOMProps') as
  (element: string, props: Record<string, unknown>) => Record<string, unknown>;
type RadioInstance = { props: Record<string, unknown> & { accessibilityRole?: string; accessibilityLabel?: string } };
function radios(): RadioInstance[] {
  // Outermost matching instances retain the component-produced props before native Pressable normalizes them.
  return screen.UNSAFE_root.findAll((radio: RadioInstance) => radio.props.accessibilityRole === 'radio', { deep: false });
}
function expectSelection(selectedLabel: string | null) {
  for (const radio of radios()) {
    const expected = radio.props.accessibilityLabel === selectedLabel;
    const dom = createDOMProps('div', radio.props);
    expect(dom.role).toBe('radio'); expect(dom['aria-label']).toBe(radio.props.accessibilityLabel);
    expect(dom['aria-checked']).toBe(expected);
    // Preserve the native control contract as well as the actual web mapping.
    expect(radio.props.accessibilityState).toEqual({ checked: expected, selected: expected });
  }
}

it('exposes every optional category as unchecked when no category is chosen', () => {
  render(<CategoryPicker selected={null} onChange={jest.fn()} />);
  expect(radios().map(radio => radio.props.accessibilityLabel)).toEqual(NOTE_CATEGORIES.map(category => category.label));
  expectSelection(null);
});

it('updates checked web state for each category change and clearing category, keeping native state and labels', () => {
  const onChange = jest.fn(); const mounted = render(<CategoryPicker selected={null} onChange={onChange} />);
  for (const category of NOTE_CATEGORIES) {
    fireEvent.press(screen.getByRole('radio', { name: category.label })); expect(onChange).toHaveBeenLastCalledWith(category.value);
    mounted.rerender(<CategoryPicker selected={category.value} onChange={onChange} />);
    expectSelection(category.label); expect(screen.getByText(`✓ ${category.label}`)).toBeTruthy();
  }
  mounted.rerender(<CategoryPicker selected={null} onChange={onChange} />); expectSelection(null);
});

it('treats All as the null filter without adding a sixth note category', () => {
  const onChange = jest.fn(); const mounted = render(<CategoryPicker selected={null} includeAll onChange={onChange} />);
  expect(radios()).toHaveLength(6); expectSelection('All');
  mounted.rerender(<CategoryPicker selected="question" includeAll onChange={onChange} />); expectSelection('Question');
  fireEvent.press(screen.getByRole('radio', { name: 'All' })); expect(onChange).toHaveBeenLastCalledWith(null);
  mounted.rerender(<CategoryPicker selected={null} includeAll onChange={onChange} />); expectSelection('All');
});

it('activates a web radio once with Space and Enter through the installed responder, ignoring unrelated and repeated Space keys', () => {
  const priorOS = Platform.OS; const priorDocument = (globalThis as any).document;
  const listeners = new Map<string, (event: any) => void>();
  const PressResponder = require('react-native-web/dist/cjs/modules/usePressEvents/PressResponder');
  try {
    Platform.OS = 'web';
    (globalThis as any).document = { addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener), removeEventListener: (type: string) => listeners.delete(type) };
    const onChange = jest.fn(); render(<CategoryPicker selected="quote" onChange={onChange} />);
    const props = radios().find(radio => radio.props.accessibilityLabel === 'Thought')!.props;
    const target = { tagName: 'DIV', getAttribute: (name: string) => name === 'role' ? props.accessibilityRole : null };
    const responder = new PressResponder({ onPress: props.onPress });
    const press = (key: string, repeat = false) => {
      const event = { key, repeat, target, currentTarget: target, nativeEvent: { key, type: 'keydown' }, persist() {}, preventDefault: jest.fn(), stopPropagation() {} };
      // Installed Pressable calls its responder before the component's supported custom onKeyDown.
      responder.getEventHandlers().onKeyDown(event);
      (props.onKeyDown as ((event: unknown) => void) | undefined)?.(event);
      listeners.get('keyup')?.({ ...event, nativeEvent: { ...event.nativeEvent, type: 'keyup' } });
      return event;
    };
    try {
      const space = press(' '); expect(onChange).toHaveBeenCalledTimes(1); expect(onChange).toHaveBeenLastCalledWith('reflect'); expect(space.preventDefault).toHaveBeenCalled();
      press('Enter'); expect(onChange).toHaveBeenCalledTimes(2); expect(onChange).toHaveBeenLastCalledWith('reflect');
      press('a'); press(' ', true); expect(onChange).toHaveBeenCalledTimes(2);
      // Flow B: the chips are one radio group, so arrow keys move to and select the next chip.
      const arrow = press('ArrowDown'); expect(onChange).toHaveBeenCalledTimes(3); expect(onChange).toHaveBeenLastCalledWith('distill'); expect(arrow.preventDefault).toHaveBeenCalled();
      press('ArrowUp'); expect(onChange).toHaveBeenLastCalledWith('quote');
    } finally { responder.reset(); }
  } finally { Platform.OS = priorOS; (globalThis as any).document = priorDocument; }
});

it('retains native onPress and omits the web key handler', () => {
  const onChange = jest.fn(); render(<CategoryPicker selected={null} includeAll onChange={onChange} />);
  expect(radios().every(radio => radio.props.onKeyDown === undefined)).toBe(true);
  fireEvent.press(screen.getByRole('radio', { name: 'All' })); expect(onChange).toHaveBeenCalledTimes(1); expect(onChange).toHaveBeenCalledWith(null);
});
