jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { CandidateEditionPicker, type CompactEditionSearchDraft } from '../components/CandidateEditionPicker';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { ownerUxService, OwnerUxClientError } from '../api/ownerUxService';
import { imageInventoryKeys, resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { ownerEditionPickerKeys } from '../queries/ownerEditionPickerKeys';
import { pickerChoices, pickerIdentity, pickerDetail, selectedChoices, pickerReview, deferred } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); return React.createElement(require('react-native').View, props);
} }));
jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(), setCandidateIsbn: jest.fn(),
} }));
const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
const set = ownerEditionPickerService.setCandidateIsbn as jest.Mock;
const lookup = ownerEditionPickerService.requestEditionOptions as jest.Mock;
const slots = { claimSlot: jest.fn((): string | null => 'existing'), releaseSlot: jest.fn(), isCommandActive: jest.fn(() => false) };
const isbn = '9780140449136';
const receipt = { operationId: testUuid(40), status: 'pending', requestGeneration: 2, optionsVersion: 1, available: false };
let client: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  read.mockReset(); set.mockReset(); lookup.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  resetImageInventoryIdentityForTests(pickerIdentity);
  read.mockResolvedValue(pickerChoices());
  set.mockImplementation(async request => {
    read.mockResolvedValue(pickerChoices({ ownerIsbn13: request.isbn13, candidateVersion: 6, metadataRevision: 9, reviewVersion: 1, requestGeneration: 2 }));
    return { sessionId: testUuid(1), candidateId: testUuid(2), candidateVersion: 6,
      metadataRevision: 9, requestGeneration: 2, ownerIsbn13: request.isbn13 };
  });
  lookup.mockResolvedValue(receipt);
});
afterEach(async () => { await cleanupAsync(); client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear(); jest.restoreAllMocks(); });
function mount(cardDraft?: CompactEditionSearchDraft, onPendingChange = jest.fn()) {
  return render(<QueryClientProvider client={client}><CandidateEditionPicker identity={pickerIdentity}
    sessionId={testUuid(1)} candidateId={testUuid(2)} commandSlot={slots} disabled={false}
    cardDraft={cardDraft} onPendingChange={onPendingChange} onSelection={jest.fn()}>{() => null}</CandidateEditionPicker></QueryClientProvider>);
}
async function search(view: ReturnType<typeof mount>, value = isbn) {
  await waitFor(() => expect(view.queryByLabelText('ISBN')).toBeTruthy());
  await waitFor(() => expect(view.getByRole('button', { name: 'Search by ISBN' })).not.toBeDisabled());
  fireEvent.changeText(view.getByLabelText('ISBN'), value);
  fireEvent.press(view.getByRole('button', { name: 'Search by ISBN' }));
}
// Slice 5 SDD §§1,8–9 / AC5a-2,3,4,6,12,16b: real sheet, hook and commands.
it.each(['9780140449137', '1000000000009'])('labels the ISBN box and announces invalid %s before any command', async invalid => {
  const view = mount(); await search(view, invalid);
  const error = view.getByText("Check the ISBN; the last digit doesn't match");
  expect(error.props.accessibilityLiveRegion).toBe('assertive');
  expect(view.getByText('On the back cover, above or below the barcode')).toBeTruthy();
  expect(view.getByLabelText('ISBN').props.maxLength).toBe(17);
  expect(view.getByLabelText('ISBN').props.autoCapitalize).toBe('characters');
  expect(view.getByLabelText('ISBN').props.autoCorrect).toBe(false);
  expect(set).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
});
it('uses the iOS numbers-and-punctuation keyboard so ISBN-10 X remains available', async () => {
  const select = Platform.select;
  jest.spyOn(Platform, 'select').mockImplementation(options => options.ios === 'numbers-and-punctuation' ? options.ios : select(options));
  const view = mount();
  await waitFor(() => expect(view.getByLabelText('ISBN')).toBeTruthy());
  expect(view.getByLabelText('ISBN').props.keyboardType).toBe('numbers-and-punctuation');
});
// Whole-feature review, 2026-10-23: a cache refetch that never settles (offline) must not hold the sheet.
it.each(['success', 'refused set', 'unsaved edits'] as const)
('settles %s and releases the pending state while every invalidation stays pending', async outcome => {
  jest.spyOn(client, 'invalidateQueries').mockImplementation(() => new Promise(() => {}));
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockResolvedValue(
    pickerDetail(selectedChoices({ candidateVersion: 5, reviewVersion: 1 }), pickerReview));
  if (outcome === 'refused set') set.mockRejectedValue(new OwnerUxClientError('P9_STATE_CONFLICT', false, 'state'));
  const onPendingChange = jest.fn();
  const view = mount(outcome === 'unsaved edits' ? { identityChanged: true, request: { review: pickerReview,
    expectedCandidateVersion: 4, expectedMetadataRevision: 7 } } : undefined, onPendingChange);
  await search(view);
  if (outcome === 'refused set') {
    await waitFor(() => expect(view.getByText("This book can't be changed now.")).toBeTruthy());
    expect(lookup).not.toHaveBeenCalled();
  } else {
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
    expect(read.mock.calls.length).toBeGreaterThan(1);
  }
  await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(false));
  expect(set).toHaveBeenCalledTimes(1);
  if (outcome === 'unsaved edits') expect(save).toHaveBeenCalledTimes(1);
});
// Whole-feature review, 2026-10-23: the re-read must still describe this press before the one search.
function setThenReread(reread: Parameters<typeof pickerChoices>[0]) {
  set.mockImplementation(async request => {
    read.mockResolvedValue(pickerChoices(reread));
    return { sessionId: testUuid(1), candidateId: testUuid(2), candidateVersion: 6,
      metadataRevision: 9, requestGeneration: 2, ownerIsbn13: request.isbn13 };
  });
}
it.each([
  ['another ISBN', { ownerIsbn13: '9780804429573' }],
  ['no ISBN', { ownerIsbn13: null }],
] as const)('stops without a search when another device changed the ISBN before the re-read (%s)', async (_label, other) => {
  setThenReread({ ...other, candidateVersion: 7, metadataRevision: 10, reviewVersion: 1, requestGeneration: 3 });
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByText('This book changed; we reloaded it.')).toBeTruthy());
  expect(lookup).not.toHaveBeenCalled();
  expect(set).toHaveBeenCalledTimes(1);
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
});
it('still searches from the re-read generation when a benign change raised it but the ISBN is unchanged', async () => {
  setThenReread({ ownerIsbn13: isbn, candidateVersion: 7, metadataRevision: 10, reviewVersion: 1, requestGeneration: 4 });
  const view = mount(); await search(view);
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(lookup.mock.calls[0][0].expectedRequestGeneration).toBe(4);
});
it('converts ISBN-10 X to ISBN-13 before saving and requests once after the set', async () => {
  const view = mount(); await search(view, '0-8044-2957-X');
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(set.mock.calls[0][0].isbn13).toBe('9780804429573');
  expect(set.mock.invocationCallOrder[0]).toBeLessThan(lookup.mock.invocationCallOrder[0]);
});
it('accepts a checksum-valid 979 ISBN from the box and requests once after set', async () => {
  const view = mount(); await search(view, '9791234567896');
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(set.mock.calls[0][0].isbn13).toBe('9791234567896');
});
it('saves unsaved edits alone before ISBN set, never running an intervening title lookup', async () => {
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockResolvedValue(
    pickerDetail(selectedChoices({ candidateVersion: 5, reviewVersion: 1 }), pickerReview));
  const view = mount({ identityChanged: true, request: { review: pickerReview,
    expectedCandidateVersion: 4, expectedMetadataRevision: 7 } });
  await search(view); await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
  expect(set.mock.invocationCallOrder[0]).toBeLessThan(lookup.mock.invocationCallOrder[0]);
});
it('disables ISBN search for an incomplete identity draft and retains the existing details message', async () => {
  const view = mount({ identityChanged: true, request: null });
  await waitFor(() => expect(view.getByText("Complete the card's details to search with the new title")).toBeTruthy());
  expect(view.getByRole('button', { name: 'Search by ISBN' })).toBeDisabled();
  expect(set).not.toHaveBeenCalled();
});
it('blocks the box and search while the ISBN command is pending and notifies the card', async () => {
  const pending = deferred<unknown>(); set.mockReturnValue(pending.promise);
  const onPendingChange = jest.fn(); const view = mount(undefined, onPendingChange);
  await search(view); await waitFor(() => expect(onPendingChange).toHaveBeenCalledWith(true));
  expect(view.getByRole('button', { name: 'Search by ISBN' })).toBeDisabled();
  expect(view.getByLabelText('ISBN').props.editable).toBe(false);
  await act(async () => pending.resolve({}));
});
it.each([[[]], [pickerChoices().rows.map(row => ({ ...row, eligibility: 'ineligible' as const }))]])
('uses ISBN no-result text without either title-mode no-match text', async rows => {
  read.mockResolvedValue(pickerChoices({ ownerIsbn13: isbn, rows }));
  const view = mount();
  await waitFor(() => expect(view.getByText(`No book was found for ISBN ${isbn}`)).toBeTruthy());
  expect(view.getByText(`Searching by ISBN ${isbn}`)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Search by title instead' })).toBeTruthy();
  expect(view.queryByText('No book results were returned.')).toBeNull();
  expect(view.queryByText(/No result matches this book's title and author/u)).toBeNull();
});
it('clears ISBN after saving unsaved details and starts exactly one title request', async () => {
  read.mockResolvedValue(pickerChoices({ ownerIsbn13: isbn }));
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockResolvedValue(
    pickerDetail(selectedChoices({ candidateVersion: 5, reviewVersion: 1 }), pickerReview));
  const view = mount({ identityChanged: true, request: { review: pickerReview,
    expectedCandidateVersion: 4, expectedMetadataRevision: 7 } });
  await waitFor(() => expect(view.getByRole('button', { name: 'Search by title instead' })).toBeTruthy());
  fireEvent.press(view.getByRole('button', { name: 'Search by title instead' }));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
  expect(set.mock.calls[0][0]).toMatchObject({ isbn13: null, expectedCandidateVersion: 5 });
});
it('offers Retry search after a lookup network failure and reuses its command without repeating set', async () => {
  lookup.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(receipt);
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByRole('button', { name: 'Retry search' })).toBeTruthy());
  fireEvent.press(view.getByRole('button', { name: 'Retry search' }));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  expect(lookup.mock.calls[1][0]).toEqual(lookup.mock.calls[0][0]); expect(set).toHaveBeenCalledTimes(1);
});
it.each([false, true])('discards the stale title retry when ISBN search starts (unsaved details: %s)', async unsaved => {
  read.mockResolvedValue(pickerChoices({ optionsExpiresAt: null, lookupStatus: 'idle', rows: [] }));
  const saved = selectedChoices({ candidateVersion: 5, reviewVersion: 1, optionsExpiresAt: null, lookupStatus: 'idle', rows: [] });
  jest.spyOn(ownerUxService, 'updateCandidateReview').mockImplementation(async () => {
    read.mockResolvedValue(saved); return pickerDetail(saved, pickerReview);
  });
  lookup.mockRejectedValueOnce(new Error('title network')).mockRejectedValueOnce(new Error('ISBN network'))
    .mockResolvedValueOnce(receipt);
  const view = mount(unsaved ? { identityChanged: true, request: { review: pickerReview,
    expectedCandidateVersion: 4, expectedMetadataRevision: 7 } } : undefined);
  await waitFor(() => expect(view.getByRole('button', { name: 'Search Books' })).not.toBeDisabled());
  fireEvent.press(view.getByRole('button', { name: 'Search Books' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Retry search' })).not.toBeDisabled());
  await search(view);
  await waitFor(() => expect(view.getByText('The ISBN search could not finish.')).toBeTruthy());
  expect(view.getAllByRole('button', { name: 'Retry search' })).toHaveLength(1);
  fireEvent.press(view.getByRole('button', { name: 'Retry search' }));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(3));
  expect(lookup.mock.calls[2][0]).toEqual(lookup.mock.calls[1][0]);
  expect(lookup.mock.calls[2][0]).not.toEqual(lookup.mock.calls[0][0]);
});
it('discards a failed title mutation when Search by title instead clears ISBN', async () => {
  read.mockResolvedValue(pickerChoices({ optionsExpiresAt: null, lookupStatus: 'idle', rows: [] }));
  lookup.mockRejectedValueOnce(new Error('old lookup network')).mockRejectedValueOnce(new Error('clear lookup network'));
  const view = mount();
  await waitFor(() => expect(view.getByRole('button', { name: 'Search Books' })).not.toBeDisabled());
  fireEvent.press(view.getByRole('button', { name: 'Search Books' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Retry search' })).not.toBeDisabled());
  // A later choices read can enter ISBN mode while the old title mutation still holds its error.
  const updated = pickerChoices({ ownerIsbn13: isbn, optionsExpiresAt: null, lookupStatus: 'idle', rows: [] });
  read.mockResolvedValue(updated);
  act(() => { client.setQueryData(ownerEditionPickerKeys.choices(pickerIdentity, testUuid(1), testUuid(2)), updated); });
  await waitFor(() => expect(view.getByRole('button', { name: 'Search by title instead' })).not.toBeDisabled());
  fireEvent.press(view.getByRole('button', { name: 'Search by title instead' }));
  await waitFor(() => expect(view.getByText('The ISBN search could not finish.')).toBeTruthy());
  expect(set.mock.calls[0][0].isbn13).toBeNull();
  expect(view.getAllByRole('button', { name: 'Retry search' })).toHaveLength(1);
});
it('refreshes a lookup generation conflict without resending it or discarding the typed ISBN', async () => {
  lookup.mockRejectedValue(new OwnerUxClientError('P9_VERSION_CONFLICT', true, 'The session changed. Refresh and try again.'));
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByText('This book changed; we reloaded it.')).toBeTruthy());
  expect(view.getByText('Press Search by ISBN again')).toBeTruthy();
  expect(view.getByLabelText('ISBN').props.value).toBe(isbn);
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
  expect(read.mock.calls.length).toBeGreaterThan(2);
  expect(set).toHaveBeenCalledTimes(1); expect(lookup).toHaveBeenCalledTimes(1);
});
it('shows another refused code registry message with Close the sheet and no retry', async () => {
  set.mockRejectedValue(new OwnerUxClientError('P9_NOT_FOUND', false, 'The requested item was not found.'));
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByText('The requested item was not found.')).toBeTruthy());
  expect(view.getByText('Close the sheet')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
  expect(set).toHaveBeenCalledTimes(1); expect(lookup).not.toHaveBeenCalled();
});
it.each(['authority', 'identity'])('refreshes a %s change before any pending record and offers no dead-end Retry', async changed => {
  const view = mount();
  await waitFor(() => expect(view.getByLabelText('ISBN')).toBeTruthy());
  if (changed === 'authority') client.setQueryData(imageInventoryKeys.candidate(pickerIdentity, testUuid(1), testUuid(2)),
    { ...pickerDetail(), candidateState: 'committed' });
  else resetImageInventoryIdentityForTests({ userId: 'owner-b', storeId: 'store-b' });
  await search(view);
  await waitFor(() => expect(view.getByText('This book changed; we reloaded it.')).toBeTruthy());
  expect(view.getByText('Press Search by ISBN again')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
  expect(set).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
});
it('offers a new explicit search rather than retry when the card slot fails before retaining a record', async () => {
  slots.claimSlot.mockReturnValueOnce(null);
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByText('The ISBN search could not finish.')).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
  expect(view.getByText('Press Search by ISBN again')).toBeTruthy();
  expect(set).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
});
it('catches a synchronous card check failure on Retry and updates the recovery message', async () => {
  set.mockRejectedValueOnce(new Error('network'));
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByRole('button', { name: 'Retry search' })).not.toBeDisabled());
  client.setQueryData(imageInventoryKeys.candidate(pickerIdentity, testUuid(1), testUuid(2)),
    { ...pickerDetail(), candidateState: 'committed' });
  expect(() => fireEvent.press(view.getByRole('button', { name: 'Retry search' }))).not.toThrow();
  await waitFor(() => expect(view.getByText('This book changed; we reloaded it.')).toBeTruthy());
  expect(view.getByText('Press Search by ISBN again')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
  expect(set).toHaveBeenCalledTimes(1); expect(lookup).not.toHaveBeenCalled();
});
it.each([
  ['missing', 'idle', null],
  ['expired', 'ready', '2000-01-01T00:00:00.000Z'],
  ['failed with no results', 'failed', null],
  ['failed with fresh results', 'failed', '2099-01-01T00:00:00.000Z'],
] as const)('retries saved ISBN through unchanged set, reread and one lookup when %s', async (_label, lookupStatus, optionsExpiresAt) => {
  const saved = pickerChoices({ ownerIsbn13: isbn, lookupStatus, optionsExpiresAt });
  read.mockResolvedValue(saved);
  set.mockResolvedValue({ sessionId: saved.sessionId, candidateId: saved.candidateId, ownerIsbn13: isbn,
    candidateVersion: saved.candidateVersion, metadataRevision: saved.metadataRevision, requestGeneration: saved.requestGeneration });
  const view = mount();
  await waitFor(() => expect(view.getByLabelText('ISBN')).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Search Books' })).toBeNull();
  expect(view.getAllByRole('button', { name: 'Retry search' })).toHaveLength(1);
  expect(view.getByLabelText('ISBN').props.value).toBe('');
  fireEvent.press(view.getByRole('button', { name: 'Retry search' }));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(set).toHaveBeenCalledTimes(1);
  expect(set.mock.calls[0][0]).toMatchObject({ isbn13: isbn, expectedCandidateVersion: saved.candidateVersion });
  expect(lookup.mock.calls[0][0].expectedRequestGeneration).toBe(saved.requestGeneration);
  expect(set.mock.invocationCallOrder[0]).toBeLessThan(read.mock.invocationCallOrder[1]);
  expect(read.mock.invocationCallOrder[1]).toBeLessThan(lookup.mock.invocationCallOrder[0]);
});
it('keeps Search Books for missing title-mode results and does not set an ISBN', async () => {
  read.mockResolvedValue(pickerChoices({ optionsExpiresAt: null, lookupStatus: 'idle', rows: [] }));
  const view = mount();
  await waitFor(() => expect(view.getByRole('button', { name: 'Search Books' })).not.toBeDisabled());
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'Search Books' }));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(set).not.toHaveBeenCalled();
});
it('reloads a version conflict, preserves typed ISBN, and requires another explicit press', async () => {
  set.mockRejectedValue(new OwnerUxClientError('P9_CANDIDATE_VERSION_CONFLICT', false, 'conflict'));
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByText('This book changed; we reloaded it.')).toBeTruthy());
  expect(view.getByText('Press Search by ISBN again')).toBeTruthy();
  expect(view.getByLabelText('ISBN').props.value).toBe(isbn);
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
  expect(read.mock.calls.length).toBeGreaterThan(1); expect(set).toHaveBeenCalledTimes(1);
});
it('shows a state refusal and Close the sheet without offering retry', async () => {
  set.mockRejectedValue(new OwnerUxClientError('P9_STATE_CONFLICT', false, 'state'));
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByText("This book can't be changed now.")).toBeTruthy());
  expect(view.getByText('Close the sheet')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
});
it.each(['P9_REQUEST_INVALID', 'P9_IDEMPOTENCY_MISMATCH'] as const)('stops on %s without automatic retries', async code => {
  set.mockRejectedValue(new OwnerUxClientError(code, false, 'safe'));
  const view = mount(); await search(view);
  await waitFor(() => expect(view.getByText('Close the sheet')).toBeTruthy());
  expect(set).toHaveBeenCalledTimes(1); expect(lookup).not.toHaveBeenCalled();
  expect(view.queryByRole('button', { name: 'Retry search' })).toBeNull();
});
