jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => ({ entities: { data: [] }, members: { data: [] }, refresh: jest.fn() }) }));
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import NotesSwipeScreen from '../notes-swipe';
import { BookFeedbackProvider } from '@/components/library/ui';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { noteKeys, NoteDeckCard } from '@/features/books/notes/manualNoteContract';

let mockOffline = false;
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({ canGoBack: () => false, replace: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useRoute: () => ({ key: 'swipe' }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'seed' }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({
  ...jest.requireActual('@/features/books/notes/useManualNotes'),
  useNoteContext: () => ({ actorId: 'actor', book: {} }),
}));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { deckIndex: jest.fn(), deckCards: jest.fn() } }));
jest.mock('@/components/library/notes-swipe/useNoteSwipeMotion', () => ({ useReducedNoteMotion: () => true, useNoteSwipeHint: () => false }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('react-native-gesture-handler', () => {
  const chain = () => {
    const g: Record<string, unknown> = {};
    for (const key of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'numberOfTaps', 'maxDelay', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) g[key] = () => g;
    return g;
  };
  return { Gesture: { Pan: chain, Tap: chain, Native: chain, Exclusive: () => ({}), Simultaneous: () => ({}) },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children };
});

const cards: NoteDeckCard[] = ['a', 'b', 'c'].map(id => ({
  note: { id, user_id: 'actor', user_book_id: 'book', content: `Note ${id}`, tag: 'quote', page_number: 42, created_at: '2026-10-23T00:00:00Z', updated_at: null },
  book: { id: 'book', title: `Title ${id}`, authors: ['Author'], cover_url: null },
}));

beforeEach(() => {
  mockOffline = false;
  jest.spyOn(require('react-native-reanimated'), 'useSharedValue').mockImplementation((initial: unknown) => {
    const ref = React.useRef<{ value: unknown } | null>(null);
    if (!ref.current) ref.current = { value: initial };
    return ref.current;
  });
  (manualNotesGateway.deckIndex as jest.Mock).mockResolvedValue(cards.map(c => c.note));
  (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async (_actor, ids: string[]) => cards.filter(c => ids.includes(c.note.id)));
});

it('keeps the nearby cards pinned while offline and releases them when the screen unmounts', async () => {
  jest.useFakeTimers();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const element = <QueryClientProvider client={client}><BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider></QueryClientProvider>;
  const ui = render(element);
  try {
    await waitFor(() => expect(ui.getByRole('button', { name: 'Read full note' })).toBeEnabled());
    mockOffline = true;
    ui.rerender(<QueryClientProvider client={client}><BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider></QueryClientProvider>);
    await act(async () => { jest.advanceTimersByTime(6 * 60_000); });
    for (const c of cards) {
      expect(client.getQueryData(noteKeys.deckCard('actor', c.note.id))).toEqual(c);
      expect(client.getQueryCache().find({ queryKey: noteKeys.deckCard('actor', c.note.id), exact: true })?.gcTime).toBe(Infinity);
    }
    expect(ui.getAllByTestId('note-card-paper', { includeHiddenElements: true })).toHaveLength(3);
    ui.unmount();
    for (const c of cards) expect(client.getQueryCache().find({ queryKey: noteKeys.deckCard('actor', c.note.id), exact: true })?.gcTime).toBe(5 * 60_000);
  } finally { ui.unmount(); client.clear(); jest.useRealTimers(); }
});

it('keeps the displayed card, next two entries and open sheet after six minutes with DEFAULT query GC', async () => {
  jest.useFakeTimers();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['default-gc-proof'], 'unobserved');
  expect(client.getQueryCache().find({ queryKey: ['default-gc-proof'] })?.gcTime).toBe(5 * 60_000);
  const ui = render(<QueryClientProvider client={client}><BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider></QueryClientProvider>);
  try {
    await waitFor(() => expect(ui.getByRole('button', { name: 'Read full note' })).toBeEnabled());
    fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
    expect(ui.getByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(6 * 60_000 + 1); });
    expect(client.getQueryData(['default-gc-proof'])).toBeUndefined();
    for (const c of cards) expect(client.getQueryData(noteKeys.deckCard('actor', c.note.id))).toEqual(c);
    expect(ui.getAllByTestId('note-card-paper', { includeHiddenElements: true })).toHaveLength(3);
    expect(ui.getByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy();
  } finally {
    ui.unmount(); client.clear(); jest.useRealTimers();
  }
});

it('closes an unavailable sheet and releases background inertness', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(<QueryClientProvider client={client}><BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider></QueryClientProvider>);
  try {
    await waitFor(() => expect(ui.getByRole('button', { name: 'Read full note' })).toBeEnabled());
    fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
    expect(ui.getByTestId('note-swipe-content', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
    act(() => { client.setQueryData(noteKeys.deckIndex('actor', { kind: 'all' }), []); });
    await waitFor(() => expect(ui.getByTestId('note-swipe-content', { includeHiddenElements: true }).props['aria-hidden']).toBe(false));
    expect(ui.queryByTestId('note-full-sheet', { includeHiddenElements: true })).toBeNull();
  } finally { ui.unmount(); client.clear(); }
});
