/** @jest-environment jsdom */
/** Actual installed RN-web DOM: dialog naming, category focus, overflow announcements. */
import React, { act } from 'react';
import { CategoryPicker, NoteDialog, NoteForm } from '../ManualNoteUi';
import type { NoteCategory, NoteFields } from '@/features/books/notes/manualNoteContract';

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const { createRoot } = require('react-dom/client');

it('moves DOM focus with selection on two consecutive ArrowRight keys from the focused chip', async () => {
  const priorActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  function Picker() {
    const [selected, setSelected] = React.useState<NoteCategory | null>('quote');
    return <CategoryPicker selected={selected} includeNone onChange={setSelected} />;
  }
  const radio = (label: string) => container.querySelector<HTMLElement>(`[role="radio"][aria-label="${label}"]`)!;
  const expectSelectedFocus = (label: string) => {
    expect(document.activeElement).toBe(radio(label));
    expect(radio(label).getAttribute('aria-checked')).toBe('true');
    expect(radio(label).tabIndex).toBe(0);
    expect(container.querySelectorAll('[role="radio"][tabindex="0"]')).toHaveLength(1);
  };
  try {
    await act(async () => root.render(<Picker />));
    await act(async () => radio('Quote').focus());
    expectSelectedFocus('Quote');
    for (const label of ['Thought', 'Takeaway']) {
      await act(async () => {
        document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      });
      expectSelectedFocus(label);
    }
  } finally {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
  }
});

it('keeps web overflow announcements unchanged while editing after Save and clears them at the limit', async () => {
  const priorActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const words = (count: number) => Array(count).fill('word').join(' ');
  let observer: MutationObserver | undefined;
  function Form() {
    const [fields, setFields] = React.useState<NoteFields>({ text: words(500), category: null, page: '' });
    const [saveAttempt, setSaveAttempt] = React.useState(0);
    return <><NoteForm fields={fields} onChange={setFields} locked={false} showErrors={saveAttempt > 0} saveAttempt={saveAttempt} />
      <button onClick={() => setSaveAttempt(attempt => attempt + 1)}>Save note</button></>;
  }
  const typeWords = async (count: number) => {
    const input = container.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, words(count));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const liveMessages = () => Array.from(container.querySelectorAll('[aria-live="polite"], [role="alert"]')).map(node => node.textContent);
  try {
    await act(async () => root.render(<Form />));
    await typeWords(501);
    await act(async () => container.querySelector('button')!.click());
    const announcements = liveMessages();
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toBe('Remove 1 word to save. Your text has been kept.');
    let liveMutations = 0;
    observer = new MutationObserver(records => { liveMutations += records.length; });
    observer.observe(alert, { childList: true, characterData: true, attributes: true, subtree: true });
    await typeWords(502);
    expect(container.textContent).toContain('Remove 2 words to save. Your text has been kept.');
    expect(liveMessages()).toEqual(announcements);
    expect(container.querySelector('[role="alert"]')).toBe(alert);
    expect(liveMutations).toBe(0);
    observer.disconnect();
    await act(async () => container.querySelector('button')!.click());
    const nextAlert = container.querySelector('[role="alert"]')!;
    expect(nextAlert).not.toBe(alert);
    expect(nextAlert.textContent).toBe('Remove 2 words to save. Your text has been kept.');
    await typeWords(500);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(liveMessages().every(message => !message)).toBe(true);
    await typeWords(503);
    expect(liveMessages()).toContain('Remove 3 words to save. Your text has been kept.');
  } finally {
    observer?.disconnect();
    await act(async () => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
  }
});

it('names the rendered web dialog and updates its name when the confirmation changes', async () => {
  const priorActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const show = async (title: string) => {
    await act(async () => root.render(<NoteDialog spec={{ title, message: 'Confirm the action.', keep: 'Keep editing', confirm: 'Confirm', action: jest.fn() }} onKeep={jest.fn()} />));
    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].getAttribute('aria-label')).toBe(title);
    expect(dialogs[0].getAttribute('aria-modal')).toBe('true');
  };
  try {
    await show('Delete this note?');
    await show('Replace saved version?');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
  }
});
