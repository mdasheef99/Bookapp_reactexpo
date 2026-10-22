import React from 'react';
import { AccessibilityInfo, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { DeleteBookModal } from '../DeleteBookModal';
import { BookButton, BookFeedbackProvider } from '../ui';
import { getLibraryAppearance, MIN_TARGET } from '../LibraryAppearance';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));

function renderModal(props: Partial<React.ComponentProps<typeof DeleteBookModal>> = {}) {
  const onClose = props.onClose ?? jest.fn();
  const onConfirm = props.onConfirm ?? jest.fn();
  const ui = render(
    <BookFeedbackProvider>
      <DeleteBookModal
        visible={props.visible ?? true}
        onClose={onClose}
        onConfirm={onConfirm}
        isDeleting={props.isDeleting ?? false}
        bookTitle={props.bookTitle ?? 'Walden'}
      />
    </BookFeedbackProvider>,
  );
  return { onClose, onConfirm, ...ui };
}

describe('DeleteBookModal', () => {
  const colors = getLibraryAppearance('daylight');
  const description =
    "Your notes, review, saved pages and reading history for this book will be deleted too. You can't undo this.";

  it('renders D07-14 copy, dialog semantics, secondary Cancel and destructive Remove book at >= 48dp', () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web';
    try {
      const ui = renderModal({ bookTitle: 'Walden' });
      const title = 'Remove “Walden” from your library?';
      expect(ui.getByRole('header', { name: title })).toBeOnTheScreen();
      const body = ui.getByText(description);
      expect(body.props.nativeID).toBeTruthy();

      const modal = ui.UNSAFE_getAllByType(Modal).find((m) => m.props.role === 'dialog')!;
      expect(modal.props['aria-modal']).toBe(true);
      expect(modal.props.role).toBe('dialog');
      const dialog = ui.UNSAFE_root.find((node: any) => node.type === 'View' && node.props.accessibilityViewIsModal === true);
      expect(dialog.props.accessibilityLabel).toBe(title);
      expect(dialog.props['aria-describedby']).toBe(body.props.nativeID);

      const buttons = ui.UNSAFE_getAllByType(BookButton);
      const cancelBtn = buttons.find((b) => b.props.label === 'Cancel')!;
      const removeBtn = buttons.find((b) => b.props.label === 'Remove book')!;
      expect(cancelBtn.props.variant).toBe('secondary');
      expect(removeBtn.props.variant).toBe('destructive');

      const cancelHost = ui.getByRole('button', { name: 'Cancel' });
      const removeHost = ui.getByRole('button', { name: 'Remove book' });
      expect(StyleSheet.flatten(cancelHost.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(StyleSheet.flatten(removeHost.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(StyleSheet.flatten(removeHost.props.style).backgroundColor).toBe(colors.error);
    } finally {
      Platform.OS = previousOS;
    }
  });

  it('T5 puts the native dialog label and description association on a rendered host', () => {
    const previousOS = Platform.OS;
    Platform.OS = 'ios';
    try {
      const ui = renderModal({ bookTitle: 'Walden' });
      const dialog = ui.UNSAFE_root.find((node: any) => node.type === 'View' && node.props.accessibilityViewIsModal === true);
      expect(dialog.props.accessibilityLabel).toBe(
        `Remove “Walden” from your library? ${description}`,
      );
      expect(dialog.props['aria-describedby']).toBe(ui.getByText(description).props.nativeID);
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
      expect(within(dialog).getByRole('button', { name: 'Remove book' })).toBeOnTheScreen();
    } finally {
      Platform.OS = previousOS;
    }
  });

  it.each(['ios', 'web'] as const)('T3 focuses Cancel on show using the %s focus API', os => {
    const previousOS = Platform.OS;
    Platform.OS = os;
    const nativeFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
    const findHandle = jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(42);
    try {
      const ui = renderModal();
      const cancelNode = ui.UNSAFE_getAllByType(View).find(node => node.props.accessibilityLabel === 'Cancel')!.instance;
      const focus = jest.spyOn(cancelNode, 'focus');
      focus.mockClear();
      nativeFocus.mockClear();
      findHandle.mockClear();
      const modal = ui.UNSAFE_getAllByType(Modal).find(m => m.props.role === 'dialog')!;
      fireEvent(modal, 'show');
      if (os === 'ios') {
        expect(findHandle).toHaveBeenCalledWith(cancelNode);
        expect(nativeFocus).toHaveBeenCalledWith(42);
        expect(focus).not.toHaveBeenCalled();
      } else {
        expect(focus).toHaveBeenCalledTimes(1);
        expect(nativeFocus).not.toHaveBeenCalled();
        expect(findHandle).not.toHaveBeenCalled();
      }
    } finally { Platform.OS = previousOS; jest.restoreAllMocks(); }
  });

  it.each(['Walden', 'The Life and Opinions of Tristram Shandy, Gentleman'])('T4 bounds and scrolls the dialog for %s with both actions reachable', bookTitle => {
    const ui = renderModal({ bookTitle });
    const header = ui.getByRole('header', { name: `Remove “${bookTitle}” from your library?` });
    let dialog = header.parent;
    while (dialog && StyleSheet.flatten(dialog.props.style)?.maxWidth === undefined) dialog = dialog.parent;
    expect(dialog).not.toBeNull();
    expect(StyleSheet.flatten(dialog!.props.style)).toMatchObject({ maxHeight: '90%', width: '100%', alignSelf: 'center' });
    const scroll = dialog!.findByType(ScrollView);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(within(scroll).getByRole('header', { name: `Remove “${bookTitle}” from your library?` })).toBeOnTheScreen();
    expect(within(scroll).getByText(description)).toBeOnTheScreen();
    expect(within(scroll).getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    expect(within(scroll).getByRole('button', { name: 'Remove book' })).toBeOnTheScreen();
  });

  it('shows "Removing…" and disables both buttons while isDeleting is true', () => {
    const ui = renderModal({ isDeleting: true });
    const cancelHost = ui.getByRole('button', { name: 'Cancel' });
    const removeHost = ui.getByRole('button', { name: 'Removing…' });
    expect(cancelHost.props.accessibilityState.disabled).toBe(true);
    expect(removeHost.props.accessibilityState.disabled).toBe(true);
    expect(ui.queryByRole('button', { name: 'Remove book' })).toBeNull();
  });

  it('calls onClose on Cancel press or Modal onRequestClose, and onConfirm on Remove book press', () => {
    const ui = renderModal();
    fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
    expect(ui.onClose).toHaveBeenCalledTimes(1);
    expect(ui.onConfirm).not.toHaveBeenCalled();

    const modal = ui.UNSAFE_getAllByType(Modal).find((m) => m.props.role === 'dialog')!;
    fireEvent(modal, 'requestClose');
    expect(ui.onClose).toHaveBeenCalledTimes(2);

    fireEvent.press(ui.getByRole('button', { name: 'Remove book' }));
    expect(ui.onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('Flow A fix round 1 dialog dismissal', () => {
  it('R9 ignores requestClose while deleting and closes once deletion is idle', () => {
    const ui = renderModal({ isDeleting: true });
    fireEvent(ui.UNSAFE_getAllByType(Modal).find(modal => modal.props.role === 'dialog')!, 'requestClose');
    expect(ui.onClose).not.toHaveBeenCalled();
    ui.rerender(
      <BookFeedbackProvider>
        <DeleteBookModal visible onClose={ui.onClose} onConfirm={ui.onConfirm} isDeleting={false} bookTitle="Walden" />
      </BookFeedbackProvider>,
    );
    fireEvent(ui.UNSAFE_getAllByType(Modal).find(modal => modal.props.role === 'dialog')!, 'requestClose');
    expect(ui.onClose).toHaveBeenCalledTimes(1);
  });
});
