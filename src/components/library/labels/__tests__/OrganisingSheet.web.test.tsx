/** @jest-environment jsdom */
import React, { act } from 'react';
import { OrganisingSheet } from '../../organising/OrganisingSheet';
import { DeleteBookModal } from '../../DeleteBookModal';
import { NoteFullNoteSheet } from '../../notes-swipe/NoteFullNoteSheet';

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn() }));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => children,
  GestureDetector: ({ children }: any) => children,
  Gesture: { Pan: () => { const chain: any = {}; for (const key of ['minDistance', 'runOnJS', 'onEnd']) chain[key] = () => chain; return chain; }, Native: () => ({}) },
}));
jest.mock('@/components/library/ui', () => ({
  ...jest.requireActual('@/components/library/ui'), useBookFeedback: () => ({ notify: jest.fn() }), BookFeedbackSlot: () => null,
}));
jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => ({
  entities: { data: [{ id: 'borrowed', name: 'Borrowed', created_at: '2026-10-25' }] }, members: { data: [] }, suggestions: { data: [] }, refresh: jest.fn(),
}) }));
const { createRoot } = require('react-dom/client');

// jsdom does not perform the browser's default Tab movement. Move to the next
// tab stop only when keydown was not cancelled; real Modal focus events still run.
function tab(shiftKey = false) {
  const active = document.activeElement as HTMLElement;
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  active.dispatchEvent(event);
  if (event.defaultPrevented) return;
  const stops = Array.from(document.querySelectorAll<HTMLElement>('[tabindex],button,input,textarea,a[href]'))
    .filter(node => node.tabIndex >= 0 && !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true' && !node.closest('[inert], [aria-hidden="true"]'));
  stops[(stops.indexOf(active) + (shiftKey ? stops.length - 1 : 1)) % stops.length]?.focus();
}
async function withModal(content: React.ReactNode, check: () => void) {
  const previous = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<>{['Library', 'Exchange', 'Marketplace', 'Clubs', 'Profile'].map(name => <a key={name} href={`#${name}`} role="tab" tabIndex={0}>{name} tab</a>)}{content}</>));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    await act(async () => check());
  } finally {
    await act(async () => root.unmount()); container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previous;
  }
}
const button = (name: string) => document.querySelector<HTMLElement>(`[role="button"][aria-label="${name}"]`)!;

describe.each([
  ['labels', 'membership', undefined], ['labels', 'filter', undefined],
  ['collections', 'membership', undefined], ['collections', 'manage', 'new'],
 ] as const)('%s %s sheet', (kind, mode, initialStep) => {
  it.each([['Tab', false], ['Shift+Tab', true]] as const)('wraps %s between controls', async (_key, shift) => {
    await withModal(<OrganisingSheet actor="actor" kind={kind} mode={mode} target={mode === 'membership' ? 'target' : undefined} initialStep={initialStep} onClose={jest.fn()} />, () => {
      const first = button(`Back in ${kind}`), last = button(initialStep === 'new' ? 'Create collection' : 'Done');
      (shift ? first : last).focus(); tab(shift);
      expect(document.activeElement).toBe(shift ? last : first);
      expect(document.activeElement?.getAttribute('role')).not.toBe('tab');
    });
  });
});
it.each(['delete', 'full note'])('checks the installed %s Modal also contains focus despite outside tabbable links', async kind => {
  const card: any = { note: { id: 'note', content: 'Passage', page_number: 1, tag: 'quote' }, book: { title: 'Title', authors: [] } };
  const content = kind === 'delete'
    ? <DeleteBookModal visible bookTitle="Title" isDeleting={false} onClose={jest.fn()} onConfirm={jest.fn()} />
    : <NoteFullNoteSheet card={card} reduced onClose={jest.fn()} onOpenNote={jest.fn()} onOpenBook={jest.fn()} />;
  await withModal(content, () => {
    const first = button(kind === 'delete' ? 'Cancel' : 'Close full note'), last = button(kind === 'delete' ? 'Remove book' : 'Open book');
    last.focus(); tab();
    expect(document.activeElement?.getAttribute('role')).not.toBe('tab');
    first.focus(); tab(true);
    expect(document.activeElement?.getAttribute('role')).not.toBe('tab');
    expect(document.querySelector('[role="tab"]')?.getAttribute('tabindex')).toBe('0');
  });
});
