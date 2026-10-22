import React from 'react';
import { AccessibilityInfo, Alert, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';

import { LIBRARY_SPACING, MIN_TARGET, getLibraryAppearance } from '../../LibraryAppearance';
import { BookButton } from '../BookButton';
import { BookFeedbackProvider, BookFeedbackSlot, useBookFeedback } from '../BookFeedback';
import type { BookConfirmSpec, BookFeedbackApi } from '../BookFeedback';

void [Modal, TextInput, View];
const ReactNative = require('react-native') as typeof import('react-native');
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));

const spec: BookConfirmSpec = { title: 'Delete page 12?', message: 'This will remove the saved page from your vault.', keep: 'Cancel', confirm: 'Delete', destructive: true };
let api: BookFeedbackApi;
function Probe({ onRender }: { onRender?: (api: BookFeedbackApi) => void }) {
  api = useBookFeedback();
  onRender?.(api);
  return null;
}
function mount(children?: React.ReactNode) {
  return render(<BookFeedbackProvider><Probe />{children}</BookFeedbackProvider>);
}
function notify(kind: 'success' | 'error' | 'info', message: string) {
  act(() => api.notify({ kind, message }));
}
function confirm(input = spec) {
  let pending!: Promise<boolean>;
  act(() => { pending = api.confirm(input); });
  return pending;
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

it.each(['success', 'info'] as const)('shows %s until exactly 4000ms in a persistent live region', kind => {
  mount();
  const region = screen.getByTestId('book-feedback-live-region');
  expect(region.props.accessibilityLiveRegion).toBe('polite');
  notify(kind, 'Saved');
  expect(screen.getByText('Saved')).toBeOnTheScreen();
  act(() => jest.advanceTimersByTime(3999));
  expect(screen.getByText('Saved')).toBeOnTheScreen();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByText('Saved')).toBeNull();
  expect(screen.getByTestId('book-feedback-live-region')).toBe(region);
});

it('keeps an error and its alert role until Dismiss is pressed', () => {
  mount(); notify('error', 'Could not save');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  act(() => jest.advanceTimersByTime(10001));
  expect(screen.getByText('Could not save')).toBeOnTheScreen();
  const dismiss = screen.getByRole('button', { name: 'Dismiss' });
  expect(StyleSheet.flatten(dismiss.props.style).minHeight).toBe(MIN_TARGET);
  expect(screen.UNSAFE_getByType(BookButton).props.variant).toBe('text');
  fireEvent.press(dismiss);
  expect(screen.queryByText('Could not save')).toBeNull();
});

it('replaces the old toast and clears its timer instead of dismissing the newer toast', () => {
  mount(); notify('success', 'Old');
  act(() => jest.advanceTimersByTime(3000));
  notify('info', 'New');
  expect(screen.queryByText('Old')).toBeNull();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('New')).toBeOnTheScreen();
  act(() => jest.advanceTimersByTime(3000));
  expect(screen.queryByText('New')).toBeNull();
  notify('success', 'Timed'); notify('error', 'Persistent');
  act(() => jest.advanceTimersByTime(10001));
  expect(screen.getByText('Persistent')).toBeOnTheScreen();
});

it.each(['success', 'error', 'info'] as const)('uses the %s palette surface, edge and primary ink', kind => {
  mount(); notify(kind, 'Feedback');
  const colors = getLibraryAppearance('daylight');
  expect(StyleSheet.flatten(screen.getByTestId('book-feedback-toast').props.style)).toMatchObject({
    backgroundColor: colors[`${kind}Surface`], borderColor: colors[kind], borderWidth: 1,
  });
  expect(StyleSheet.flatten(screen.getByText('Feedback').props.style).color).toBe(colors.textPrimary);
  expect(StyleSheet.flatten(screen.getByTestId('book-feedback-host').props.style)).toMatchObject({
    position: 'absolute', top: 24 + LIBRARY_SPACING.xs,
  });
  expect(screen.getByTestId('book-feedback-host').props.pointerEvents).toBe('box-none');
});

it.each(['web', 'ios', 'android'] as const)('shows feedback on %s without native alerts and announces only on iOS', os => {
  const priorOS = Platform.OS;
  try {
    Platform.OS = os;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    mount(); notify('success', 'Visible feedback');
    expect(screen.getByText('Visible feedback')).toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledTimes(os === 'ios' ? 1 : 0);
    if (os === 'ios') expect(announce).toHaveBeenCalledWith('Visible feedback');
    expect(screen.getByTestId('book-feedback-live-region').props.accessibilityLiveRegion).toBe('polite');
  } finally { Platform.OS = priorOS; }
});

it('keeps API identities stable and does not rerender API consumers for toast changes', () => {
  const onRender = jest.fn();
  const ui = render(<BookFeedbackProvider><Probe onRender={onRender} /></BookFeedbackProvider>);
  const first = api;
  notify('success', 'Saved'); notify('error', 'Failed');
  expect(onRender).toHaveBeenCalledTimes(1);
  ui.rerender(<BookFeedbackProvider><Probe onRender={onRender} /></BookFeedbackProvider>);
  expect(api).toBe(first); expect(api.notify).toBe(first.notify); expect(api.confirm).toBe(first.confirm);
  const pending = confirm();
  expect(api.confirm).toBe(first.confirm);
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  return expect(pending).resolves.toBe(false);
});

it.each(['hook', 'slot'])('throws a clear provider error for a %s outside its provider', target => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(target === 'hook' ? <Probe /> : <BookFeedbackSlot />)).toThrow(/BookFeedbackProvider/);
});

it.each([true, false])('resolves true only on Confirm, destructive=%s', destructive => {
  mount(); const pending = confirm({ ...spec, destructive });
  expect(screen.getByRole('header', { name: spec.title })).toBeOnTheScreen();
  expect(screen.getByText(spec.message)).toBeOnTheScreen();
  const buttons = screen.UNSAFE_getAllByType(BookButton);
  expect(buttons.find(button => button.props.label === 'Cancel')?.props.variant).toBe('secondary');
  expect(buttons.find(button => button.props.label === 'Delete')?.props.variant).toBe(destructive ? 'destructive' : 'primary');
  expect(screen.UNSAFE_getByType(Modal).props).toMatchObject({ transparent: true, animationType: 'none' });
  expect(screen.getByTestId('book-confirm-card').props).toMatchObject({ accessible: false, accessibilityViewIsModal: true });
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.queryByText(spec.title)).toBeNull();
  return expect(pending).resolves.toBe(true);
});

it.each(['keep', 'scrim', 'back'] as const)('resolves false on %s', action => {
  mount(); const pending = confirm();
  if (action === 'keep') fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  else if (action === 'scrim') fireEvent.press(screen.getByTestId('book-confirm-scrim'));
  else act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
  expect(screen.queryByText(spec.title)).toBeNull();
  return expect(pending).resolves.toBe(false);
});

it('stops card presses from dismissing the dialog', async () => {
  mount(); const pending = confirm(); const stopPropagation = jest.fn();
  fireEvent.press(screen.getByTestId('book-confirm-card'), { stopPropagation });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(screen.getByText(spec.title)).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await expect(pending).resolves.toBe(false);
});

it('settles once on double press and closes before the continuation runs', async () => {
  mount(); const settled = jest.fn(() => expect(screen.queryByText(spec.title)).toBeNull());
  const pending = confirm().then(settled);
  const press = screen.UNSAFE_getAllByType(BookButton).find(button => button.props.label === 'Delete')!.props.onPress;
  act(() => { press(); press(); });
  await pending;
  expect(settled).toHaveBeenCalledTimes(1); expect(settled).toHaveBeenCalledWith(true);
});

it('cancels the first confirm when a second opens and ignores the stale action', async () => {
  mount(); const first = confirm();
  const stalePress = screen.UNSAFE_getAllByType(BookButton).find(button => button.props.label === 'Delete')!.props.onPress;
  const second = confirm({ ...spec, title: 'Second dialog' });
  await expect(first).resolves.toBe(false);
  act(() => stalePress());
  expect(screen.getByText('Second dialog')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await expect(second).resolves.toBe(false);
});

it('settles a pending confirm as false and clears the toast timer on provider unmount', async () => {
  const ui = mount(); notify('success', 'Saved'); const pending = confirm();
  ui.unmount();
  await expect(pending).resolves.toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

it('moves toast display into a slot once and restores the host after slot unmount', () => {
  const tree = (show: boolean) => <BookFeedbackProvider><Probe />{show && <BookFeedbackSlot />}</BookFeedbackProvider>;
  const ui = render(tree(false)); notify('error', 'Modal error');
  const hostRegion = within(screen.getByTestId('book-feedback-host')).getByTestId('book-feedback-live-region');
  ui.rerender(tree(true));
  expect(within(screen.getByTestId('book-feedback-slot')).getByText('Modal error')).toBeOnTheScreen();
  expect(within(screen.getByTestId('book-feedback-host')).queryByText('Modal error')).toBeNull();
  expect(within(screen.getByTestId('book-feedback-host')).getByTestId('book-feedback-live-region')).toBe(hostRegion);
  expect(screen.getAllByText('Modal error')).toHaveLength(1);
  ui.rerender(tree(false));
  expect(within(screen.getByTestId('book-feedback-host')).getByText('Modal error')).toBeOnTheScreen();
  expect(screen.getAllByText('Modal error')).toHaveLength(1);
});

it('does not duplicate a toast while multiple slots are mounted', () => {
  mount(<><BookFeedbackSlot /><BookFeedbackSlot /></>); notify('error', 'Only once');
  expect(screen.getAllByText('Only once')).toHaveLength(1);
  expect(within(screen.getByTestId('book-feedback-host')).queryByText('Only once')).toBeNull();
});

it('keeps displaying the toast when a mounted slot is replaced in the same commit', () => {
  const tree = (key: string) => <BookFeedbackProvider><Probe /><BookFeedbackSlot key={key} /></BookFeedbackProvider>;
  const ui = render(tree('first')); notify('error', 'Still visible');
  ui.rerender(tree('second'));
  expect(within(screen.getByTestId('book-feedback-slot')).getByText('Still visible')).toBeOnTheScreen();
  expect(screen.getAllByText('Still visible')).toHaveLength(1);
});

it('replaces an identical message inside the same live region so it can be announced again', () => {
  mount(); notify('success', 'Saved');
  const region = screen.getByTestId('book-feedback-live-region');
  const message = screen.getByText('Saved');
  notify('success', 'Saved');
  expect(screen.getByTestId('book-feedback-live-region')).toBe(region);
  expect(screen.getByText('Saved')).not.toBe(message);
});

it.each(['ios', 'android', 'web'] as const)('focuses Keep for an opened confirm only on native: %s', os => {
  const priorOS = Platform.OS;
  try {
    Platform.OS = os;
    const findNode = jest.spyOn(ReactNative, 'findNodeHandle').mockReturnValue(42);
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
    mount(); const pending = confirm();
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    act(() => screen.UNSAFE_getByType(Modal).props.onShow());
    expect(findNode).toHaveBeenCalledTimes(os === 'web' ? 0 : 1);
    expect(focus).toHaveBeenCalledTimes(os === 'web' ? 0 : 1);
    if (os !== 'web') { expect(focus).toHaveBeenCalledWith(42); expect(findNode.mock.calls[0][0]).not.toBeNull(); }
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    return expect(pending).resolves.toBe(false);
  } finally { Platform.OS = priorOS; }
});

it('never focuses or blurs the TextInput when a toast appears', () => {
  let focused = false;
  const ref = React.createRef<TextInput>();
  render(<BookFeedbackProvider><Probe /><TextInput ref={ref} accessibilityLabel="Draft" /></BookFeedbackProvider>);
  const focus = jest.spyOn(ref.current!, 'focus').mockImplementation(() => { focused = true; });
  const blur = jest.spyOn(ref.current!, 'blur').mockImplementation(() => { focused = false; });
  jest.spyOn(ref.current!, 'isFocused').mockImplementation(() => focused);
  act(() => ref.current!.focus()); focus.mockClear();
  const accessibilityFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  notify('error', 'Keep typing');
  expect(ref.current!.isFocused()).toBe(true);
  expect(focus).not.toHaveBeenCalled(); expect(blur).not.toHaveBeenCalled();
  expect(accessibilityFocus).not.toHaveBeenCalled();
});

it('exposes one Keep target and keeps the scrim and card out of keyboard focus (R3/R4)', () => {
  mount(); const pending = confirm();
  expect(screen.getByTestId('book-confirm-scrim').props.focusable).toBe(false);
  expect(screen.getByTestId('book-confirm-card').props.focusable).toBe(false);
  expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  return expect(pending).resolves.toBe(false);
});

it('shows a toast that arrives while a confirm is open inside the confirm dialog (R2)', () => {
  mount(); const pending = confirm();
  notify('success', 'Review saved!');
  expect(within(screen.getByTestId('book-confirm-card')).getByText('Review saved!')).toBeOnTheScreen();
  expect(screen.getAllByText('Review saved!')).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  return expect(pending).resolves.toBe(false);
});

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
it.each(['DeleteBookModal', 'ManualEntryModal'] as const)('shows an error raised while the real %s is open inside that modal, not in the host', name => {
  const noop = jest.fn();
  const element = name === 'DeleteBookModal'
    ? React.createElement(require('../../DeleteBookModal').DeleteBookModal, { visible: true, onClose: noop, onConfirm: noop, isDeleting: false })
    : React.createElement(require('../../search/ManualEntryModal').ManualEntryModal, { visible: true, title: '', author: '', submitting: false, onTitleChange: noop, onAuthorChange: noop, onCancel: noop, onSave: noop });
  mount(element);
  notify('error', 'Something failed');
  expect(screen.getAllByText('Something failed')).toHaveLength(1);
  expect(
    within(screen.getByTestId('book-feedback-host', { includeHiddenElements: true })).queryByText(
      'Something failed',
      { includeHiddenElements: true },
    ),
  ).toBeNull();
});

it.each(['host', 'slot'] as const)('lets taps pass through success and info toasts in the %s but keeps error toasts tappable', location => {
  mount(location === 'slot' ? <BookFeedbackSlot /> : undefined);
  const region = within(screen.getByTestId(`book-feedback-${location}`)).getByTestId('book-feedback-live-region');
  expect(region.props.pointerEvents).toBe('box-none');
  notify('success', 'Saved'); expect(screen.getByTestId('book-feedback-toast').props.pointerEvents).toBe('none');
  notify('info', 'FYI'); expect(screen.getByTestId('book-feedback-toast').props.pointerEvents).toBe('none');
  notify('error', 'Oops'); expect(screen.getByTestId('book-feedback-toast').props.pointerEvents).toBe('auto');
});

it('renders an optional Retry action which runs its callback without changing existing callers', () => {
  mount();
  const retry = jest.fn();
  act(() => api.notify({ kind: 'error', message: 'history down', action: { label: 'Retry', onPress: retry } }));
  const action = screen.getByRole('button', { name: 'Retry' });
  expect(action).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Dismiss' })).toBeOnTheScreen();
  fireEvent.press(action);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByText('history down')).toBeOnTheScreen();
});

it('allows action only on error toasts; success and info toasts never render an action', () => {
  mount();
  const retry = jest.fn();
  act(() => api.notify({ kind: 'success', message: 'Saved', action: { label: 'Retry', onPress: retry } } as any));
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(screen.getByText('Saved')).toBeOnTheScreen();
  act(() => api.notify({ kind: 'info', message: 'Note', action: { label: 'Retry', onPress: retry } } as any));
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(screen.getByText('Note')).toBeOnTheScreen();
});
