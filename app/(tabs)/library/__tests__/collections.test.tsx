import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CollectionsScreen from '../collections';
import CollectionScreen from '../collection';
import { HomeCollectionsLink } from '@/components/library/collections/HomeCollectionsLink';
import { CollectionNoteRow } from '@/components/library/collections/CollectionNoteRow';
import { LibraryLabelFilter } from '@/components/library/labels/LibraryLabelFilter';
import { RefreshControl } from 'react-native';
import { useAuthStore } from '@/features/auth/store/authStore';

const mockApi: any = {};
const mockCards: any = {};
const mockNotes: any = {};
jest.mock('@/features/books/collections/useCollectionCards', () => ({ useCollectionCards: () => mockCards }));
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeckIndex: () => mockNotes }));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ key: 'collection-route' }) }));
jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => mockApi }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ collectionId: 'group' }), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn() }));
jest.mock('@/components/library/ui', () => ({
  ...jest.requireActual('@/components/library/ui'), useBookFeedback: () => ({ notify: jest.fn() }), BookFeedbackSlot: () => null,
}));
const group = { id: 'group', user_id: 'actor', name: 'Ideas', created_at: '2026-10-25', updated_at: '2026-10-25' };
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any });
  Object.assign(mockApi, { entities: { data: [group], isError: false }, members: { data: undefined, isError: true }, isOffline: false,
    refresh: jest.fn(), create: jest.fn(async () => group), membership: jest.fn() });
  Object.assign(mockCards, { data: undefined, refetch: jest.fn(), isRefetching: false });
  Object.assign(mockNotes, { data: undefined, isError: true, refetch: jest.fn() });
});
it('creates an empty collection when only the membership read failed and leaves counts unknown', async () => {
  const view = render(<CollectionsScreen />);
  expect(view.getByText("Couldn't refresh collections.")).toBeTruthy();
  expect(view.getByText('Notes unavailable')).toBeTruthy();
  expect(view.queryByText('Loading notes…')).toBeNull();
  expect(view.queryByText('0 notes')).toBeNull();
  const create = view.getByRole('button', { name: 'New collection' });
  expect(create).toBeEnabled();
  fireEvent.press(create);
  fireEvent.changeText(view.getByLabelText('Collection name'), 'Empty group');
  fireEvent.press(view.getByRole('button', { name: 'Create collection' }));
  await waitFor(() => expect(mockApi.create).toHaveBeenCalledWith('Empty group'));
  expect(mockApi.membership).not.toHaveBeenCalled();
});
it.each(['refreshing', 'failed'])('keeps a missing collection recoverable while %s', state => {
  mockApi.entities = { data: [], isFetching: state === 'refreshing', isError: state === 'failed' };
  const view = render(<CollectionScreen />);
  expect(view.queryByText('This collection no longer exists.')).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'Refresh' }));
  expect(mockApi.refresh).toHaveBeenCalledTimes(1);
});
it('keeps the pull refresh indicator active until card refresh finishes', () => {
  mockCards.isRefetching = true;
  const view = render(<CollectionScreen />);
  expect(view.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);
});
it('explains and disables the Home collections retry offline', () => {
  mockApi.entities = { data: [], isError: true }; mockApi.isOffline = true;
  const view = render(<HomeCollectionsLink actor="actor" onPress={jest.fn()} />);
  expect(view.getByText("You're offline.")).toBeTruthy();
  const retry = view.getByRole('button', { name: 'Try collections again' });
  expect(retry).toBeDisabled(); fireEvent.press(retry);
  expect(mockApi.refresh).not.toHaveBeenCalled(); expect(mockNotes.refetch).not.toHaveBeenCalled();
});
it('offers retry with existing labels when assignments failed', () => {
  const retry = jest.fn();
  const view = render(<LibraryLabelFilter visible disabled error onOpen={jest.fn()} onClear={jest.fn()} onRetry={retry} />);
  fireEvent.press(view.getByRole('button', { name: 'Try labels again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
it('names each Remove control by its passage as well as its book', () => {
  const card: any = { note: { id: 'one', content: 'First passage' }, book: { title: 'Walden' } };
  const view = render(<><CollectionNoteRow card={card} pending={false} offline={false} onOpen={jest.fn()} onRemove={jest.fn()} />
    <CollectionNoteRow card={{ ...card, note: { id: 'two', content: 'Second passage' } }} pending={false} offline={false} onOpen={jest.fn()} onRemove={jest.fn()} /></>);
  expect(view.getByRole('button', { name: 'Remove from collection: Walden. First passage' })).toBeEnabled();
  expect(view.getByRole('button', { name: 'Remove from collection: Walden. Second passage' })).toBeEnabled();
});
it.each(['entity read', 'offline', 'cap'])('keeps standalone creation blocked by %s', reason => {
  if (reason === 'entity read') mockApi.entities = { data: undefined, isError: true };
  if (reason === 'offline') mockApi.isOffline = true;
  if (reason === 'cap') mockApi.entities.data = Array.from({ length: 25 }, (_, i) => ({ ...group, id: `group-${i}` }));
  const view = render(<CollectionsScreen />);
  expect(view.getByRole('button', { name: 'New collection' })).toBeDisabled();
  if (reason === 'cap') expect(view.getByText('You have 25 collections. Delete one to create another.')).toBeTruthy();
});
