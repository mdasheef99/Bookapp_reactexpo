import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { OrganisingSheet } from '../../organising/OrganisingSheet';
import { OrganisingError } from '@/features/books/organising/organisingGateway';
import { useAuthStore } from '@/features/auth/store/authStore';
import * as Native from 'react-native';

const mockNotify = jest.fn();
const mockApi: any = {};
jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => mockApi }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('@/components/library/ui', () => ({
  ...jest.requireActual('@/components/library/ui'), useBookFeedback: () => ({ notify: mockNotify }), BookFeedbackSlot: () => null,
}));
const label = { id: 'borrowed', user_id: 'actor', name: 'Borrowed', created_at: '2026-10-25', updated_at: '2026-10-25' };
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any });
  Object.assign(mockApi, { isOffline: false, entities: { data: [label], isPending: false, isError: false, refetch: jest.fn() }, members: { data: [], isPending: false, isError: false },
    suggestions: { data: [], isPending: false, isError: false }, refresh: jest.fn(), create: jest.fn(async () => label), membership: jest.fn(async () => undefined), rename: jest.fn(async () => label), remove: jest.fn(async () => undefined) });
});
it('exposes Manage in the Home filter and applies a selection immediately', () => {
  const select = jest.fn(), close = jest.fn();
  const view = render(<OrganisingSheet actor="actor" kind="labels" mode="filter" onSelect={select} onClose={close} />);
  expect(view.getByText('Manage')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Filter by Borrowed'));
  expect(select).toHaveBeenCalledWith('borrowed'); expect(close).toHaveBeenCalledTimes(1);
});
it('retains a created label after attachment failure and retries only that attachment', async () => {
  mockApi.membership.mockRejectedValueOnce(new Error('connection failed'));
  const view = render(<OrganisingSheet actor="actor" kind="labels" target="book" mode="membership" onClose={jest.fn()} />);
  fireEvent.press(view.getByText('New label'));
  fireEvent.changeText(view.getByLabelText('Label name'), 'Borrowed');
  fireEvent.press(view.getByText('Add label'), { nativeEvent: {} });
  await waitFor(() => expect(view.getByText(/created.*attachment was not confirmed/i)).toBeTruthy());
  fireEvent.press(view.getByText('Retry attachment'));
  await waitFor(() => expect(mockApi.membership).toHaveBeenCalledTimes(2));
  expect(mockApi.create).toHaveBeenCalledTimes(1);
  expect(mockApi.membership.mock.calls).toEqual([['book', 'borrowed', true], ['book', 'borrowed', true]]);
});
it('keeps a fenced attachment failure silent after the account changes', async () => {
  mockApi.membership.mockImplementationOnce(async () => {
    useAuthStore.setState({ session: { user: { id: 'another-actor' } } as any });
    throw new OrganisingError('identity', 'Your account changed.');
  });
  const view = render(<OrganisingSheet actor="actor" kind="labels" target="book" mode="membership" onClose={jest.fn()} />);
  fireEvent.press(view.getByText('New label'));
  fireEvent.changeText(view.getByLabelText('Label name'), 'Borrowed');
  fireEvent.press(view.getByText('Add label'));
  await waitFor(() => expect(mockApi.membership).toHaveBeenCalledTimes(1));
  expect(mockNotify).not.toHaveBeenCalled();
  expect(view.queryByText(/attachment was not confirmed/)).toBeNull();
});
it('asks before discarding a name and keeps it when the reader stays', () => {
  const view = render(<OrganisingSheet actor="actor" kind="labels" target="book" mode="membership" onClose={jest.fn()} />);
  fireEvent.press(view.getByText('New label'));
  fireEvent.changeText(view.getByLabelText('Label name'), 'Draft');
  fireEvent.press(view.getByLabelText('Back in labels'));
  expect(view.getByText('Discard changes?')).toBeTruthy();
  fireEvent.press(view.getByText('Keep editing'));
  expect(view.getByDisplayValue('Draft')).toBeTruthy();
});
it('treats Back from the discard confirmation as Keep editing', () => {
  const close = jest.fn();
  const view = render(<OrganisingSheet actor="actor" kind="labels" target="book" mode="membership" onClose={close} />);
  fireEvent.press(view.getByText('New label'));
  fireEvent.changeText(view.getByLabelText('Label name'), 'Draft');
  fireEvent.press(view.getByLabelText('Back in labels'));
  fireEvent.press(view.getByLabelText('Back in labels'));
  expect(view.getByDisplayValue('Draft')).toBeTruthy(); expect(close).not.toHaveBeenCalled();
});
it('starts a fresh sheet when its target changes while an earlier write is pending', async () => {
  let finish!: () => void;
  mockApi.membership.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const changed = jest.fn();
  const view = render(<OrganisingSheet actor="actor" kind="labels" target="book" mode="membership" onChanged={changed} onClose={jest.fn()} />);
  fireEvent.press(view.getByRole('checkbox', { name: 'Borrowed' }));
  expect(view.getByText('Saving…')).toBeTruthy();
  view.rerender(<OrganisingSheet actor="actor" kind="labels" target="another-book" mode="membership" onChanged={changed} onClose={jest.fn()} />);
  expect(view.queryByText('Saving…')).toBeNull();
  finish(); await waitFor(() => expect(changed).not.toHaveBeenCalled());
});
it('does not replay creation after an uncertain reply, and offers explicit existing-entity attachment', async () => {
  mockApi.create.mockRejectedValue(new OrganisingError('unknown', 'Creation not confirmed'));
  const view = render(<OrganisingSheet actor="actor" kind="labels" target="book" mode="membership" onClose={jest.fn()} />);
  fireEvent.press(view.getByText('New label'));
  fireEvent.changeText(view.getByLabelText('Label name'), 'Borrowed');
  fireEvent.press(view.getByText('Add label'));
  await waitFor(() => expect(view.getByText('Use existing Borrowed')).toBeTruthy());
  expect(mockApi.membership).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Use existing Borrowed'));
  await waitFor(() => expect(mockApi.membership).toHaveBeenCalledWith('book', 'borrowed', true));
  expect(mockApi.create).toHaveBeenCalledTimes(1);
});
it('keeps a rename draft and uses the refreshed version only after another explicit save', async () => {
  const current = { ...label, name: 'Elsewhere', updated_at: '2026-10-26' };
  mockApi.rename.mockRejectedValueOnce(new OrganisingError('conflict', 'Now called Elsewhere', current));
  const view = render(<OrganisingSheet actor="actor" kind="labels" mode="manage" initialStep="rename" original={label} onClose={jest.fn()} />);
  fireEvent.changeText(view.getByLabelText('Label name'), 'My draft');
  fireEvent.press(view.getByText('Save name'));
  await waitFor(() => expect(view.getByText('Now called Elsewhere')).toBeTruthy());
  expect(view.getByDisplayValue('My draft')).toBeTruthy();
  expect(mockApi.rename).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText('Save name'));
  await waitFor(() => expect(mockApi.rename).toHaveBeenLastCalledWith(current, 'My draft'));
});
it('restores native accessibility focus to the supplied visible opener after dismissal', () => {
  jest.useFakeTimers();
  const handle = jest.spyOn(Native, 'findNodeHandle').mockReturnValue(77);
  const focus = jest.spyOn(Native.AccessibilityInfo, 'setAccessibilityFocus');
  const ref = { current: 77 as unknown as Native.View };
  const view = render(<OrganisingSheet actor="actor" kind="labels" mode="filter" onClose={jest.fn()} returnFocusRef={ref} />);
  view.unmount(); jest.runOnlyPendingTimers();
  expect(focus).toHaveBeenCalledWith(77);
  handle.mockRestore(); focus.mockRestore(); jest.useRealTimers();
});
it('creates an empty standalone collection without a membership write', async () => {
  const close = jest.fn();
  const view = render(<OrganisingSheet actor="actor" kind="collections" mode="manage" initialStep="new" onClose={close} />);
  fireEvent.changeText(view.getByLabelText('Collection name'), 'Reading ideas');
  fireEvent.press(view.getByText('Create collection'));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(mockApi.create).toHaveBeenCalledWith('Reading ideas'); expect(mockApi.membership).not.toHaveBeenCalled();
});
it('allows standalone creation after a membership read failure, but keeps attach controls disabled', async () => {
  mockApi.members = { data: undefined, isPending: false, isError: true };
  const close = jest.fn();
  const view = render(<OrganisingSheet actor="actor" kind="collections" mode="membership" target="note" onClose={close} />);
  expect(view.getByRole('button', { name: 'New collection' })).toBeDisabled();
  expect(view.getByRole('checkbox', { name: 'Borrowed' })).toBeDisabled();
  view.rerender(<OrganisingSheet actor="actor" kind="collections" mode="manage" initialStep="new" onClose={close} />);
  fireEvent.changeText(view.getByLabelText('Collection name'), 'Empty group');
  fireEvent.press(view.getByText('Create collection'));
  await waitFor(() => expect(mockApi.create).toHaveBeenCalledWith('Empty group'));
  expect(mockApi.membership).not.toHaveBeenCalled();
});
it.each(['labels', 'collections'] as const)('clears a stale duplicate %s message on a changed name and checks the next submit', async kind => {
  const noun = kind === 'labels' ? 'label' : 'collection';
  const duplicate = `You already have a ${noun} called “favourites”.`;
  const nextDuplicate = `You already have a ${noun} called “Classics”.`;
  mockApi.create.mockRejectedValueOnce(new OrganisingError('duplicate', duplicate)).mockRejectedValueOnce(new OrganisingError('duplicate', nextDuplicate));
  const view = render(<OrganisingSheet actor="actor" kind={kind} mode="membership" target="target" onClose={jest.fn()} />);
  fireEvent.press(view.getByText(`New ${noun}`));
  const field = view.getByLabelText(kind === 'labels' ? 'Label name' : 'Collection name');
  fireEvent.changeText(field, 'favourites');
  const submit = kind === 'labels' ? 'Add label' : 'Create and add';
  fireEvent.press(view.getByText(submit));
  await waitFor(() => expect(view.getByText(duplicate)).toBeTruthy());
  fireEvent.changeText(field, 'favourites');
  expect(view.getByText(duplicate)).toBeTruthy();
  fireEvent.changeText(field, 'Classics');
  expect(view.queryByText(duplicate)).toBeNull();
  expect(view.getByDisplayValue('Classics')).toBeTruthy();
  expect(mockApi.create).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText(submit));
  await waitFor(() => expect(mockApi.create).toHaveBeenLastCalledWith('Classics'));
  await waitFor(() => expect(view.getByText(nextDuplicate)).toBeTruthy());
});
it.each(['limit', 'denied', 'network'] as const)('retains a non-name %s error when the draft changes', async kind => {
  const message = kind === 'limit' ? 'You have 25 collections. Delete one to create another.' : "Couldn't save this collection. Refresh and try again.";
  mockApi.create.mockRejectedValue(kind === 'network' ? new Error(message) : new OrganisingError(kind, message));
  const view = render(<OrganisingSheet actor="actor" kind="collections" mode="manage" initialStep="new" onClose={jest.fn()} />);
  fireEvent.changeText(view.getByLabelText('Collection name'), 'First');
  fireEvent.press(view.getByText('Create collection'));
  await waitFor(() => expect(view.getByText(message)).toBeTruthy());
  fireEvent.changeText(view.getByLabelText('Collection name'), 'Changed');
  expect(view.getByText(message)).toBeTruthy();
  expect(mockApi.create).toHaveBeenCalledTimes(1);
});
it('keeps membership and Done usable at the collection cap and has no Manage action', async () => {
  mockApi.entities.data = Array.from({ length: 25 }, (_, index) => ({ ...label, id: `c${index}`, name: `Group ${index}` }));
  const view = render(<OrganisingSheet actor="actor" kind="collections" mode="membership" target="note" onClose={jest.fn()} />);
  expect(view.getByRole('button', { name: 'New collection' }).props.accessibilityState.disabled).toBe(true);
  expect(view.getByRole('button', { name: 'Done' }).props.accessibilityState.disabled).toBe(false);
  expect(view.queryByText('Manage')).toBeNull();
  fireEvent.press(view.getByRole('checkbox', { name: 'Group 0' }));
  await waitFor(() => expect(mockApi.membership).toHaveBeenCalledWith('note', 'c0', true));
});
