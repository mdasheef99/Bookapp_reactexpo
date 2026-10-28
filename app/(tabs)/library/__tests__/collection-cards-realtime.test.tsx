import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CollectionScreen from '../collection';
import { NoteDeckCard } from '@/features/books/notes/manualNoteContract';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { useAuthStore } from '@/features/auth/store/authStore';

jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { deckCards: jest.fn(), deckIndex: jest.fn() }, noteSaves: { subscribe: () => () => {}, snapshot: () => 1, forBook: () => [] } }));
const mockApi: any = {};
// Fresh members array per call: the real screen recomputes its id list on every
// render (and every members refetch yields new identities), so the hook must be
// robust to callers that pass a freshly allocated `ids` array each time.
jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => ({ ...mockApi, members: { ...mockApi.members, data: [...(mockApi.members.data ?? [])] } }) }));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ key: 'collection-route' }) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ collectionId: 'group' }), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn() }));
jest.mock('@/components/library/ui', () => ({
  ...jest.requireActual('@/components/library/ui'), useBookFeedback: () => ({ notify: jest.fn() }), BookFeedbackSlot: () => null,
}));

// Records render errors (for example the phone crash C4) instead of letting
// React unmount the whole tree, so the test failure shows the real cause.
class CrashProbe extends React.Component<{ onError: (error: unknown) => void; children: React.ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: unknown) { this.props.onError(error); }
  render() { return this.state.crashed ? null : this.props.children; }
}
const crashes: unknown[] = [];
const crashText = () => crashes.map(error => String(error)).join(' | ') || 'no render error captured';

const group = { id: 'group', user_id: 'actor', name: 'Ideas', created_at: '2026-10-01', updated_at: '2026-10-01' };
const member = (noteId: string) => ({ user_id: 'actor', entity_id: 'group', target_id: noteId, added_at: '2026-10-03' });
const card = (id: string): NoteDeckCard => ({
  note: { id, user_id: 'actor', user_book_id: 'book', content: `passage ${id}`, tag: null, page_number: null, created_at: '2026-10-01', updated_at: null },
  book: { id: 'book', title: 'Book', authors: [], cover_url: null },
});
const writes = (client: QueryClient) => client.getQueryState(['library-note-deck', 'actor', 'collection-cards', 'group'])?.dataUpdateCount ?? 0;
const cachedIds = (client: QueryClient) => (client.getQueryData<{ pages: { note: { id: string } }[] }>(['library-note-deck', 'actor', 'collection-cards', 'group'])?.pages.flat() ?? []).map(row => row.note.id);
const deckCalls = () => (manualNotesGateway.deckCards as jest.Mock).mock.calls.length;

let client: QueryClient;
const tree = () => (<CrashProbe onError={error => { crashes.push(error); }}><QueryClientProvider client={client}><CollectionScreen /></QueryClientProvider></CrashProbe>);
const ui = (ids: string[]) => {
  Object.assign(mockApi, {
    entities: { data: [group], isError: false, isFetching: false, isPaused: false, fetchStatus: 'idle' },
    members: { data: ids.map(member), isError: false, isFetching: false },
    isOffline: false, refresh: jest.fn(), membership: jest.fn(),
  });
  return render(tree());
};
// A missing note surfaces the captured render error (the C4 crash signature)
// instead of a generic "unable to find" timeout.
const findNote = (testID: string) => screen.findByTestId(testID, {}, { timeout: 10000 }).catch(() => { throw crashes.length ? crashes[0] : new Error(`collection note never rendered (${testID}; ${crashText()})`); });
beforeEach(() => {
  jest.clearAllMocks();
  crashes.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ session: { user: { id: 'actor' } } } as any);
  (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async (_actor: string, batch: string[]) => batch.map(id => card(id)));
});
afterEach(() => client.clear());

// Phone finding C4: opening a collection with one note showed "Loading
// collection…", then a red "Render Error: Maximum update depth exceeded" box
// from CollectionScreen, then the "Something went wrong" screen. The screen
// builds `ids` as a new array on every render and the hook effect depended on
// that identity while writing the query cache on every run, so the first
// successful fetch started a render -> effect -> cache-write -> render loop.
// These tests mount the REAL screen with the REAL hook and a real
// QueryClient (only gateways/network edges mocked). On the buggy code React
// throws "Maximum update depth exceeded" out of the findBy below; fixed code
// renders the note with a bounded number of cache writes (each loop iteration
// performs exactly one cache write, so the write count bounds re-renders).
it('opens a collection with one note without an update-depth crash', async () => {
  ui(['n1']);
  await findNote('collection-note-n1-body');
  await waitFor(() => expect(screen.queryByText('Loading collection…')).toBeNull());
  expect(screen.getByRole('button', { name: 'Remove note 1 from collection: Book. passage n1' })).toBeEnabled();
  expect(deckCalls()).toBe(1);
  expect(writes(client)).toBeLessThan(10);
}, 30000);

it('pages a 25-note collection with Load more and bounded cache writes', async () => {
  const ids = Array.from({ length: 25 }, (_, i) => `note-${i}`);
  ui(ids);
  await findNote('collection-note-note-0-body');
  fireEvent.press(screen.getByRole('button', { name: 'Load more notes' }));
  // FlatList virtualizes far rows in Jest, so the last page is asserted on the
  // query cache (the first page above proves rows paint on screen).
  await waitFor(() => expect(cachedIds(client)).toHaveLength(25));
  expect(cachedIds(client)).toContain('note-24');
  expect(screen.queryByText('Loading collection…')).toBeNull();
  expect(deckCalls()).toBeLessThan(5);
  expect(writes(client)).toBeLessThan(10);
}, 30000);

it('keeps the remaining note when one membership is removed', async () => {
  const view = ui(['n1', 'n2']);
  await findNote('collection-note-n1-body');
  await findNote('collection-note-n2-body');
  mockApi.members = { ...mockApi.members, data: ['n2'].map(member) };
  view.rerender(tree());
  await waitFor(() => expect(screen.queryByTestId('collection-note-n1-body')).toBeNull());
  expect(screen.getByTestId('collection-note-n2-body')).toBeTruthy();
  expect(screen.queryByText('Loading collection…')).toBeNull();
  expect(writes(client)).toBeLessThan(10);
}, 30000);
