import React from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
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
    "Your notes, review and saved pages for this book will be deleted too. You can't undo this.";

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
      expect(modal.props.accessibilityViewIsModal).toBe(true);
      expect(modal.props['aria-modal']).toBe(true);
      expect(modal.props.role).toBe('dialog');
      expect(modal.props.accessibilityLabel).toBe(title);
      expect(modal.props['aria-describedby']).toBe(body.props.nativeID);

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

  it('includes title and body in native dialog accessibilityLabel', () => {
    const previousOS = Platform.OS;
    Platform.OS = 'ios';
    try {
      const ui = renderModal({ bookTitle: 'Walden' });
      const modal = ui.UNSAFE_getAllByType(Modal).find((m) => m.props.role === 'dialog')!;
      expect(modal.props.accessibilityLabel).toBe(
        `Remove “Walden” from your library? ${description}`,
      );
    } finally {
      Platform.OS = previousOS;
    }
  });

  it('focuses the Cancel button on show via its ref', () => {
    const ui = renderModal();
    const cancelNode = ui
      .UNSAFE_getAllByType(View)
      .find((node) => node.props.accessibilityLabel === 'Cancel')!.instance;
    const focusSpy = jest.spyOn(cancelNode, 'focus');
    const modal = ui.UNSAFE_getAllByType(Modal).find((m) => m.props.role === 'dialog')!;
    fireEvent(modal, 'show');
    expect(focusSpy).toHaveBeenCalledTimes(1);
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
