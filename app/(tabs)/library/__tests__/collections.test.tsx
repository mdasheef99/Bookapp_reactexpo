import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CollectionsScreen from '../collections';
import { useAuthStore } from '@/features/auth/store/authStore';

const mockApi: any = {};
jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => mockApi }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
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
});
it('creates an empty collection when only the membership read failed and leaves counts unknown', async () => {
  const view = render(<CollectionsScreen />);
  expect(view.getByText("Couldn't refresh collections.")).toBeTruthy();
  expect(view.getByText('Loading notes…')).toBeTruthy();
  expect(view.queryByText('0 notes')).toBeNull();
  const create = view.getByRole('button', { name: 'New collection' });
  expect(create).toBeEnabled();
  fireEvent.press(create);
  fireEvent.changeText(view.getByLabelText('Collection name'), 'Empty group');
  fireEvent.press(view.getByRole('button', { name: 'Create collection' }));
  await waitFor(() => expect(mockApi.create).toHaveBeenCalledWith('Empty group'));
  expect(mockApi.membership).not.toHaveBeenCalled();
});
it.each(['entity read', 'offline', 'cap'])('keeps standalone creation blocked by %s', reason => {
  if (reason === 'entity read') mockApi.entities = { data: undefined, isError: true };
  if (reason === 'offline') mockApi.isOffline = true;
  if (reason === 'cap') mockApi.entities.data = Array.from({ length: 25 }, (_, i) => ({ ...group, id: `group-${i}` }));
  const view = render(<CollectionsScreen />);
  expect(view.getByRole('button', { name: 'New collection' })).toBeDisabled();
  if (reason === 'cap') expect(view.getByText('You have 25 collections. Delete one to create another.')).toBeTruthy();
});
