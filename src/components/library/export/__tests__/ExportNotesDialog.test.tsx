import React from 'react';
import { AccessibilityInfo, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { ExportNotesDialog } from '../ExportNotesDialog';
import { BookFeedbackProvider } from '../../ui';
import { getLibraryAppearance, MIN_TARGET } from '../../LibraryAppearance';
import { DIALOG_MAX_WIDTH } from '../../bookDetails/bookDetailsTokens';
import { useNotesExport } from '@/features/books/export/useExportActions';
import { loadBookNotesForExport } from '@/features/books/export/loaders';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/books/export/loaders', () => ({ loadBookNotesForExport: jest.fn() }));
jest.mock('@/features/books/export/deliver', () => jest.requireActual('@/features/books/export/deliver.web'));
function setup(props: Partial<React.ComponentProps<typeof ExportNotesDialog>> = {}) {
  const onClose = jest.fn(), onExport = jest.fn();
  const element = (overrides = {}) => <BookFeedbackProvider>
    <ExportNotesDialog visible busy={false} onClose={onClose} onExport={onExport} {...props} {...overrides} />
  </BookFeedbackProvider>;
  const ui = render(element());
  // The provider also owns a hidden confirmation Modal. Query only this dialog's subtree.
  const modal = () => within(ui.UNSAFE_getByType(ExportNotesDialog)).UNSAFE_getByType(Modal);
  return { ...ui, element, modal, onClose, onExport };
}

it('names the dialog, describes privacy, and defaults to Markdown / This book', () => {
  const ui = setup();
  const modal = ui.modal();
  expect(modal.props).toMatchObject({ role: 'dialog', 'aria-modal': true });
  expect(ui.getByRole('dialog', { name: 'Export notes' })).toBeOnTheScreen();
  const dialog = ui.UNSAFE_root.find((node: any) => node.type === 'View' && node.props.accessibilityViewIsModal === true);
  expect(dialog.props.accessibilityLabel).toBe('Export notes');
  expect(ui.getByRole('header', { name: 'Export notes' })).toBeOnTheScreen();
  expect(ui.getByLabelText('Format').props.accessibilityRole).toBe('radiogroup');
  expect(ui.getByLabelText('Scope').props.accessibilityRole).toBe('radiogroup');
  expect(ui.getByRole('radio', { name: 'Markdown file' }).props.accessibilityState.checked).toBe(true);
  expect(ui.getByRole('radio', { name: 'PDF' }).props.accessibilityState.checked).toBe(false);
  expect(ui.getByRole('radio', { name: 'This book' }).props.accessibilityState.checked).toBe(true);
  expect(ui.getByRole('radio', { name: 'All books' }).props.accessibilityState.checked).toBe(false);
  const privacy = ui.getByText('Includes private notes. Notes still saving are not included.');
  expect(dialog.props['aria-describedby']).toBe(privacy.props.nativeID);
  expect(ui.getAllByRole('button')).toHaveLength(2);
  const colors = getLibraryAppearance('daylight');
  expect(StyleSheet.flatten(ui.getByRole('button', { name: 'Export' }).props.style).backgroundColor).toBe(colors.accent);
  expect(StyleSheet.flatten(ui.getByRole('button', { name: 'Cancel' }).props.style).backgroundColor).toBe(colors.bgCard);
});

it('shows the ready copy with Print as the only primary and an enabled secondary Cancel', () => {
  const onPrint = jest.fn();
  const ui = setup({ ready: true, onPrint });
  expect(ui.getByRole('dialog', { name: 'Export notes' })).toBeOnTheScreen();
  expect(ui.getByText('Your PDF is ready. Choose Print, then Save as PDF.')).toBeOnTheScreen();
  const print = ui.getByRole('button', { name: 'Print' });
  const cancel = ui.getByRole('button', { name: 'Cancel' });
  const colors = getLibraryAppearance('daylight');
  expect(ui.getAllByRole('button')).toHaveLength(2);
  expect(ui.queryByRole('button', { name: 'Export' })).toBeNull();
  expect(ui.queryAllByRole('radio')).toHaveLength(0);
  expect(StyleSheet.flatten(print.props.style).backgroundColor).toBe(colors.accent);
  expect(StyleSheet.flatten(cancel.props.style).backgroundColor).toBe(colors.bgCard);
  expect(print).toBeEnabled(); expect(cancel).toBeEnabled();
  expect(print.props.accessibilityState.busy).toBe(false);
  fireEvent.press(print);
  expect(onPrint).toHaveBeenCalledTimes(1);
  expect(ui.onExport).not.toHaveBeenCalled();
});

describe('PDF preparation and final press with real web delivery', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let frame: any, printWindow: any;
  beforeEach(() => {
    printWindow = { print: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() };
    frame = { style: {}, setAttribute: jest.fn(), remove: jest.fn(), contentWindow: printWindow,
      contentDocument: { open: jest.fn(), write: jest.fn(), close: jest.fn() } };
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
      createElement: jest.fn(() => frame), body: { appendChild: jest.fn() },
    } });
    (loadBookNotesForExport as jest.Mock).mockResolvedValue([{ title: 'Walden', authors: ['Thoreau'], notes: [{
      content: 'Saved note', tag: null, page_number: null, created_at: null, updated_at: null,
    }] }]);
  });
  afterEach(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  function Harness({ visible = true }: { visible?: boolean }) {
    const action = useNotesExport('actor', 'book');
    const [open, setOpen] = React.useState(true);
    return <BookFeedbackProvider>
      <Text testID="export-busy">{String(action.busy)}</Text>
      {action.feedback && <Text>{action.feedback.message}</Text>}
      {open && <ExportNotesDialog visible={visible} busy={action.busy} ready={action.ready} onDispose={action.dispose}
        onExport={choice => { void action.run(choice).then(ready => { if (!ready) setOpen(false); }); }}
        onClose={() => { action.cancel(); setOpen(false); }} onPrint={() => { action.print(); setOpen(false); }} />}
    </BookFeedbackProvider>;
  }
  async function readyPdf() {
    const ui = render(<Harness />);
    fireEvent.press(ui.getByRole('radio', { name: 'PDF' }));
    await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Export' })); });
    expect(ui.getByText('Your PDF is ready. Choose Print, then Save as PDF.')).toBeOnTheScreen();
    expect(ui.getByTestId('export-busy', { includeHiddenElements: true }).props.children).toBe('false');
    expect(printWindow.print).not.toHaveBeenCalled();
    expect(frame.remove).not.toHaveBeenCalled();
    return ui;
  }
  it('calls contentWindow.print inside the same synchronous Print press, then closes without feedback', async () => {
    const ui = await readyPdf();
    let promiseResolved = false;
    const pending = Promise.resolve().then(() => { promiseResolved = true; });
    printWindow.print.mockImplementation(() => { expect(promiseResolved).toBe(false); });
    fireEvent.press(ui.getByRole('button', { name: 'Print' }));
    expect(printWindow.print).toHaveBeenCalledTimes(1);
    expect(promiseResolved).toBe(false);
    expect(ui.queryByRole('dialog', { name: 'Export notes' })).toBeNull();
    expect(ui.queryByText('Saved to your downloads.')).toBeNull();
    expect(ui.queryByText("Couldn't export. Try again.")).toBeNull();
    expect(frame.remove).toHaveBeenCalledTimes(1);
    await pending;
  });
  it.each(['Cancel', 'unmount', 'close'] as const)('removes the iframe on %s before printing', async reason => {
    const ui = await readyPdf();
    if (reason === 'Cancel') fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
    else if (reason === 'unmount') ui.unmount();
    else ui.rerender(<Harness visible={false} />);
    expect(frame.remove).toHaveBeenCalledTimes(1);
    expect(printWindow.removeEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function));
    expect(printWindow.print).not.toHaveBeenCalled();
  });
});

it('exports the selected format/scope, and resets choices when reopened', () => {
  const ui = setup();
  fireEvent.press(ui.getByRole('button', { name: 'Export' }));
  expect(ui.onExport).toHaveBeenLastCalledWith({ format: 'markdown', scope: 'book' });
  fireEvent.press(ui.getByRole('radio', { name: 'PDF' }));
  fireEvent.press(ui.getByRole('radio', { name: 'All books' }));
  fireEvent.press(ui.getByRole('button', { name: 'Export' }));
  expect(ui.onExport).toHaveBeenLastCalledWith({ format: 'pdf', scope: 'all' });
  ui.rerender(ui.element({ visible: false })); ui.rerender(ui.element());
  expect(ui.getByRole('radio', { name: 'Markdown file' }).props.accessibilityState.checked).toBe(true);
  expect(ui.getByRole('radio', { name: 'This book' }).props.accessibilityState.checked).toBe(true);
});

it('disables all controls and blocks Escape/Back while exporting, then enables Cancel', () => {
  const ui = setup({ busy: true });
  const button = ui.getByRole('button', { name: 'Export' });
  expect(button).toBeDisabled();
  // Native Pressable consumes aria-busy into the host accessibility state.
  expect(button.props.accessibilityState.busy).toBe(true);
  // The same control passes the web busy attribute to Pressable.
  let webControl: typeof button | null = button;
  while (webControl && webControl.props['aria-busy'] === undefined) webControl = webControl.parent;
  expect(webControl?.props['aria-busy']).toBe(true);
  expect(ui.getByText('Exporting…')).toBeOnTheScreen();
  expect(ui.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  for (const radio of ui.getAllByRole('radio')) expect(radio).toBeDisabled();
  fireEvent.press(button); fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
  fireEvent(ui.modal(), 'requestClose');
  expect(ui.onExport).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  ui.rerender(ui.element({ busy: false }));
  fireEvent(ui.modal(), 'requestClose');
  expect(ui.onClose).toHaveBeenCalledTimes(1);
  fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
  expect(ui.onClose).toHaveBeenCalledTimes(2);
});

it('disables Export after losing connection and leaves Cancel available', () => {
  const ui = setup({ disabled: true });
  expect(ui.getByText('Export needs a connection.')).toBeOnTheScreen();
  expect(ui.getByRole('button', { name: 'Export' })).toBeDisabled();
  expect(ui.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  fireEvent.press(ui.getByRole('button', { name: 'Export' }));
  expect(ui.onExport).not.toHaveBeenCalled();
});

it.each(['web', 'ios'] as const)('focuses Cancel using the %s API on show', platform => {
  const original = Platform.OS; Platform.OS = platform;
  const nativeFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  const handle = jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(42);
  try {
    const ui = setup();
    const cancel = ui.UNSAFE_getAllByType(View).find(node => node.props.accessibilityLabel === 'Cancel')!.instance;
    const focus = jest.spyOn(cancel, 'focus'); focus.mockClear(); nativeFocus.mockClear(); handle.mockClear();
    fireEvent(ui.modal(), 'show');
    if (platform === 'web') { expect(focus).toHaveBeenCalledTimes(1); expect(nativeFocus).not.toHaveBeenCalled(); }
    else { expect(handle).toHaveBeenCalledWith(cancel); expect(nativeFocus).toHaveBeenCalledWith(42); expect(focus).not.toHaveBeenCalled(); }
  } finally { Platform.OS = original; jest.restoreAllMocks(); }
});

it('bounds and scrolls content, wraps options, and preserves 48dp button/radio targets', () => {
  const ui = setup();
  const dialog = ui.UNSAFE_root.find((node: any) => node.type === 'View' && node.props.accessibilityViewIsModal === true);
  expect(StyleSheet.flatten(dialog.props.style)).toMatchObject({ maxHeight: '90%', width: '100%', maxWidth: DIALOG_MAX_WIDTH });
  const scroll = dialog.findByType(ScrollView);
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  expect(within(scroll).getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  for (const control of [...ui.getAllByRole('button'), ...ui.getAllByRole('radio')]) {
    expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(StyleSheet.flatten(control.props.style).minWidth).toBeGreaterThanOrEqual(MIN_TARGET);
  }
  expect(StyleSheet.flatten(ui.getByRole('button', { name: 'Export' }).props.style).maxWidth).toBe('100%');
});
