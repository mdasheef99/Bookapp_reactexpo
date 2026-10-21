import React from 'react';
import { AccessibilityInfo, Dimensions, Modal, PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { captureCardPng, releaseCardCapture } from '@/features/books/export/captureCard';
import { PassageCardPreview } from '../PassageCardPreview';
import { PassageCard } from '../PassageCard';
import { deliverImageFile, ExportUnavailableError } from '@/features/books/export/deliver';

jest.mock('@/features/books/export/captureCard', () => ({ captureCardPng: jest.fn(), releaseCardCapture: jest.fn() }));
jest.mock('@/features/books/export/deliver', () => ({
  deliverImageFile: jest.fn(), ExportUnavailableError: class ExportUnavailableError extends Error {},
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
let mockSerif = 'LibraryGaramondMedium';
jest.mock('../../LibraryTypography', () => ({
  ...jest.requireActual('../../LibraryTypography'), useLibraryTypography: () => ({
    serif: mockSerif, heading: 'LibraryGaramondSemiBold', body: 'LibraryManrope', label: 'LibraryManropeBold',
  }),
}));
const props = { visible: true, quote: 'Saved quote', title: 'Walden', author: 'Thoreau', page: 12 };
const capture = jest.mocked(captureCardPng), deliver = jest.mocked(deliverImageFile);
const captureCard = (ui: ReturnType<typeof render>) => ui.UNSAFE_getAllByType(PassageCard).find(card => card.props.onFit)!;
function settleFit(ui: ReturnType<typeof render>) {
  const card = captureCard(ui);
  if (card) fireEvent(card.findAllByType(Text)[0], 'textLayout', { nativeEvent: { lines: [{ text: `“${card.props.quote}”` }] } });
}
function setup(overrides: Partial<React.ComponentProps<typeof PassageCardPreview>> = {}, fitted = true) {
  const onClose = jest.fn();
  const element = (changes = {}) => <PassageCardPreview {...props} onClose={onClose} {...overrides} {...changes} />;
  const ui = render(element());
  if (fitted) settleFit(ui);
  return { ...ui, element, onClose };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks(); mockSerif = 'LibraryGaramondMedium';
  jest.useFakeTimers().setSystemTime(new Date('2026-10-21T12:00:00Z'));
  capture.mockResolvedValue('file:///capture.png'); deliver.mockResolvedValue('shared');
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('names the dialog and has Share image as the single primary with text Cancel', () => {
  const ui = setup();
  expect(ui.getByRole('dialog', { name: 'Share quote as image' })).toBeOnTheScreen();
  expect(ui.UNSAFE_getByType(Modal).props).toMatchObject({ role: 'dialog', 'aria-modal': true });
  expect(ui.getAllByRole('button')).toHaveLength(2);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
  expect(ui.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  const width = Dimensions.get('window').width;
  expect(ui.UNSAFE_getAllByType(PassageCard)[0].props.width).toBe(Math.min(width - 48, 360));
});

it('keeps Share disabled until the current quote has a rendered fit', () => {
  const ui = setup({}, false);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  fireEvent.press(ui.getByRole('button', { name: 'Share image' }));
  expect(capture).not.toHaveBeenCalled();
  settleFit(ui);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
  ui.rerender(ui.element({ quote: 'Another quote' }));
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  expect(ui.queryByText('Shortened to fit the card.')).toBeNull();
  settleFit(ui);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
});

it('enables Share after 2000 ms without a capture-card layout event', () => {
  const ui = setup({}, false);
  act(() => { jest.advanceTimersByTime(1999); });
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  act(() => { jest.advanceTimersByTime(1); });
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
  expect(ui.UNSAFE_getAllByType(PassageCard)[0].props.fit).toEqual({
    text: props.quote, fontSize: 26, lineHeight: 36, shortened: false,
  });
  expect(jest.getTimerCount()).toBe(0);
});

it('refits when the meta lines change for the same quote', () => {
  const ui = setup();
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
  ui.rerender(ui.element({ author: null, page: null }));
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  settleFit(ui);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
});

it('waits for the library serif before allowing capture', async () => {
  mockSerif = 'serif'; const ui = setup();
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  fireEvent.press(ui.getByRole('button', { name: 'Share image' })); expect(capture).not.toHaveBeenCalled();
  mockSerif = 'LibraryGaramondMedium'; ui.rerender(ui.element());
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  settleFit(ui);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
});

it('captures only the output surface ref, delivers the quote filename, and closes with no caption', async () => {
  const ui = setup();
  const cards = ui.UNSAFE_getAllByType(PassageCard);
  const outputRef = cards[1].props.ref;
  expect(cards[0].props.ref).toBeUndefined();
  expect(outputRef.current).toBeTruthy();
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Share image' })); });
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith(outputRef);
  expect(deliver).toHaveBeenCalledWith({ fileName: 'bookconnect-quote-walden-2026-10-21.png', sourceUri: 'file:///capture.png' });
  expect(ui.onClose).toHaveBeenCalledTimes(1); expect(ui.onClose).toHaveBeenCalledWith();
  expect(ui.queryByText('Saved to your downloads.')).toBeNull();
  expect(ui.queryByText('Image shared.')).toBeNull();
  expect(ui.queryByText('Note text copied.')).toBeNull();
});

it.each([2, 3, 3.5])('lays out an off-screen 1080×1350 pixel surface at density %s', density => {
  jest.spyOn(PixelRatio, 'get').mockReturnValue(density);
  const ui = setup();
  const capture = captureCard(ui);
  expect(capture.props.width).toBe(1080 / density);
  const root = capture.findAllByType(View)[0];
  expect(StyleSheet.flatten(root.props.style).width).toBe(1080 / density);
  expect(StyleSheet.flatten(root.props.style).height).toBeCloseTo(1350 / density);
  const offscreen = ui.UNSAFE_getAllByType(View).find(node => node.props.importantForAccessibility === 'no-hide-descendants')!;
  expect(offscreen.props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true });
  expect(StyleSheet.flatten(offscreen.props.style)).toMatchObject({ position: 'absolute', left: -10000, top: 0 });
  expect(ui.getAllByRole('image')).toHaveLength(1);
  expect(ui.getByRole('image').props.accessibilityLabel).toContain(props.quote);
  const preview = ui.UNSAFE_getAllByType(PassageCard)[0];
  expect(preview.props.fit).toEqual({ text: props.quote, fontSize: 26, lineHeight: 36, shortened: false });
});

it.each(['unavailable', 'delivery', 'capture'] as const)('announces the %s error politely and allows retry', async stage => {
  if (stage === 'capture') capture.mockRejectedValueOnce(new Error('capture failed'));
  else deliver.mockRejectedValueOnce(stage === 'unavailable' ? new ExportUnavailableError() : new Error('share failed'));
  const ui = setup();
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Share image' })); });
  const error = ui.getByText(stage === 'unavailable' ? "Sharing isn't available on this device." : "Couldn't share. Try again.");
  expect(error.props.accessibilityLiveRegion).toBe('polite'); expect(ui.onClose).not.toHaveBeenCalled();
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
  if (stage === 'capture') expect(deliver).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Share image' })); });
  expect(ui.onClose).toHaveBeenCalledTimes(1);
});

it('clears an old share error when the author changes', async () => {
  deliver.mockRejectedValueOnce(new Error('share failed'));
  const ui = setup();
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Share image' })); });
  expect(ui.getByText("Couldn't share. Try again.")).toBeOnTheScreen();
  ui.rerender(ui.element({ author: 'Another author' }));
  expect(ui.queryByText("Couldn't share. Try again.")).toBeNull();
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  settleFit(ui);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
});

it('clears busy after a successful share when the host keeps the dialog visible', async () => {
  const pending = deferred<'shared'>(); deliver.mockReturnValueOnce(pending.promise);
  const ui = setup();
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Share image' })); });
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  expect(ui.getByRole('button', { name: 'Share image' }).props.accessibilityState.busy).toBe(true);
  await act(async () => pending.resolve('shared'));
  expect(ui.onClose).toHaveBeenCalledTimes(1);
  expect(ui.getByRole('dialog', { name: 'Share quote as image' })).toBeOnTheScreen();
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
  expect(ui.getByRole('button', { name: 'Share image' }).props.accessibilityState.busy).toBe(false);
});

it('blocks two synchronous presses and keeps Cancel enabled while busy', async () => {
  const pending = deferred<'shared'>(); deliver.mockReturnValueOnce(pending.promise);
  const ui = setup(); const button = ui.getByRole('button', { name: 'Share image' });
  await act(async () => { fireEvent.press(button); fireEvent.press(button); });
  expect(capture).toHaveBeenCalledTimes(1); expect(deliver).toHaveBeenCalledTimes(1);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  expect(ui.getByRole('button', { name: 'Share image' }).props.accessibilityState.busy).toBe(true);
  expect(ui.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  await act(async () => pending.resolve('shared')); expect(ui.onClose).toHaveBeenCalledTimes(1);
});

it.each(['Cancel', 'back', 'unmount', 'hide'] as const)('ignores a late delivery after %s', async action => {
  const pending = deferred<'shared'>(); deliver.mockReturnValueOnce(pending.promise);
  const ui = setup();
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Share image' })); });
  if (action === 'Cancel') fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
  if (action === 'back') fireEvent(ui.UNSAFE_getByType(Modal), 'requestClose');
  if (action === 'unmount') ui.unmount();
  if (action === 'hide') ui.rerender(ui.element({ visible: false }));
  const expected = action === 'Cancel' || action === 'back' ? 1 : 0;
  expect(ui.onClose).toHaveBeenCalledTimes(expected);
  await act(async () => pending.resolve('shared'));
  expect(ui.onClose).toHaveBeenCalledTimes(expected);
});

it('drops an in-flight capture when the card inputs change, and allows a fresh share', async () => {
  const pending = deferred<string>(); capture.mockReturnValueOnce(pending.promise);
  const ui = setup();
  fireEvent.press(ui.getByRole('button', { name: 'Share image' }));
  ui.rerender(ui.element({ page: 13 }));
  await act(async () => pending.resolve('file:///stale.png'));
  expect(releaseCardCapture).toHaveBeenCalledWith('file:///stale.png'); expect(deliver).not.toHaveBeenCalled();
  expect(ui.onClose).not.toHaveBeenCalled();
  settleFit(ui);
  const button = ui.getByRole('button', { name: 'Share image' });
  expect(button).toBeEnabled(); expect(button.props.accessibilityState.busy).toBeFalsy();
  await act(async () => { fireEvent.press(button); });
  expect(deliver).toHaveBeenCalledTimes(1);
});

it('releases a capture that finishes after Cancel without opening a share sheet', async () => {
  const pending = deferred<string>(); capture.mockReturnValueOnce(pending.promise);
  const ui = setup();
  fireEvent.press(ui.getByRole('button', { name: 'Share image' }));
  fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
  await act(async () => pending.resolve('file:///late.png'));
  expect(releaseCardCapture).toHaveBeenCalledWith('file:///late.png'); expect(deliver).not.toHaveBeenCalled();
  expect(ui.onClose).toHaveBeenCalledTimes(1);
});

it('ignores a late failure after unmount', async () => {
  let reject!: (reason: Error) => void;
  deliver.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  const ui = setup();
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Share image' })); });
  ui.unmount(); await act(async () => reject(new Error('late')));
  expect(ui.onClose).not.toHaveBeenCalled();
});

it('shows the caption from the fitted shortened flag, independently of the character guess', () => {
  const ui = setup({}, false);
  expect(ui.queryByText('Shortened to fit the card.')).toBeNull();
  const fit = { text: 'Saved…', fontSize: 18, lineHeight: 26, shortened: true };
  act(() => captureCard(ui).props.onFit(fit));
  expect(ui.getByText('Shortened to fit the card.')).toBeOnTheScreen();
  expect(ui.UNSAFE_getAllByType(PassageCard)[0].props.fit).toEqual(fit);
  ui.rerender(ui.element({ quote: 'a'.repeat(381) }));
  expect(ui.queryByText('Shortened to fit the card.')).toBeNull();
  act(() => captureCard(ui).props.onFit({ ...fit, text: 'A measured fit', shortened: false }));
  expect(ui.queryByText('Shortened to fit the card.')).toBeNull();
});

it.each(['Cancel', 'back'] as const)('isolates a new opening from an in-flight capture closed by %s', async action => {
  const oldCapture = deferred<string>(), newCapture = deferred<string>();
  capture.mockReturnValueOnce(oldCapture.promise).mockReturnValueOnce(newCapture.promise);
  const ui = setup();
  fireEvent.press(ui.getByRole('button', { name: 'Share image' }));
  if (action === 'Cancel') fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
  else fireEvent(ui.UNSAFE_getByType(Modal), 'requestClose');
  expect(ui.onClose).toHaveBeenCalledTimes(1);
  ui.rerender(ui.element({ visible: false }));
  ui.rerender(ui.element({ visible: true }));
  expect(ui.getByRole('button', { name: 'Share image' }).props.accessibilityState.busy).toBe(false);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  settleFit(ui);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeEnabled();
  fireEvent.press(ui.getByRole('button', { name: 'Share image' }));
  expect(capture).toHaveBeenCalledTimes(2);
  await act(async () => oldCapture.resolve('file:///old.png'));
  expect(releaseCardCapture).toHaveBeenCalledWith('file:///old.png');
  expect(deliver).not.toHaveBeenCalled();
  expect(ui.onClose).toHaveBeenCalledTimes(1);
  expect(ui.getByRole('button', { name: 'Share image' }).props.accessibilityState.busy).toBe(true);
  expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
  await act(async () => newCapture.resolve('file:///new.png'));
  expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ sourceUri: 'file:///new.png' }));
  expect(ui.onClose).toHaveBeenCalledTimes(2);
});

it.each(['web', 'ios'] as const)('focuses Cancel on show using the %s API', platform => {
  const original = Platform.OS; Platform.OS = platform;
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(42);
  try {
    const ui = setup();
    const cancel = ui.UNSAFE_getAllByType(View).find(node => node.props.accessibilityLabel === 'Cancel')!.instance;
    const webFocus = jest.spyOn(cancel, 'focus'); webFocus.mockClear(); focus.mockClear();
    fireEvent(ui.UNSAFE_getByType(Modal), 'show');
    if (platform === 'web') expect(webFocus).toHaveBeenCalledTimes(1);
    else expect(focus).toHaveBeenCalledWith(42);
  } finally { Platform.OS = original; }
});
