jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { act, cleanupAsync, fireEventAsync, renderAsync, waitFor } from '@testing-library/react-native';
import { BatchReviewCard } from '../components/BatchReviewCard';
import type { IdentitySearchRequest } from '../queries/ownerEditionPickerQueries';
import { registeredOwnerUxError } from '../api/ownerUxTransport';
import { AddCandidateToInventoryAction } from '../components/AddCandidateToInventoryAction';
import { ownerUxService } from '../api/ownerUxService';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { CandidateCommandRegistry } from '../commit/inventoryCommitTypes';
import { resetImageInventoryIdentityForTests, coordinateImageInventoryIdentity } from '../queries/ownerUxQueries';
import { pickerChoices, selectedChoices, pickerIdentity, pickerCard, pickerDetail, pickerDefaults as zeroPriceDefaults, pickerReview as zeroPriceReview, deferred } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

// SDD-1 §§4/6: exercise the real picker; load lazy native mocks before timed renders.
void [ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View];
jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); const { View } = require('react-native');
  return React.createElement(View, props);
} }));
jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
const pickerDefaults = { ...zeroPriceDefaults, priceMinor: 100 };
const pickerReview = { ...zeroPriceReview, priceMinor: 100 };
const initial = pickerChoices({ selection: { ...selectedChoices().selection!, confirmedByOwner: false }, reviewVersion: 1 });
let mockDetail = pickerDetail(initial, pickerReview);

const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
const select = ownerEditionPickerService.selectEdition as jest.Mock;
const lookup = ownerEditionPickerService.requestEditionOptions as jest.Mock;
let client: QueryClient;
let registry: CandidateCommandRegistry;
let slots: { claimSlot: (id: string, prefix: string) => string | null; releaseSlot: (id: string, token: string) => void; isCommandActive: (id: string) => boolean };
const drafts = jest.fn(); const refresh = jest.fn(); const add = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks(); mockDetail = pickerDetail(initial, pickerReview);
  let captureSequence = 100;
  jest.spyOn(Crypto, 'randomUUID').mockImplementation(() => testUuid(++captureSequence) as ReturnType<typeof Crypto.randomUUID>);
  read.mockResolvedValue(initial);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  registry = new CandidateCommandRegistry(); let sequence = 0;
  slots = { claimSlot: (id, prefix) => { const token = prefix + ++sequence; return registry.claim(id, token) ? token : null; },
    releaseSlot: (id, token) => registry.release(id, token), isCommandActive: id => registry.isClaimed(id) };
  jest.spyOn(ownerUxService, 'readCandidate').mockImplementation(async () => mockDetail);
  resetImageInventoryIdentityForTests(pickerIdentity);
});
afterEach(async () => { await act(async () => { await client.cancelQueries(); }); await cleanupAsync(); client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
function cardScreen(override?: import('../contracts/ownerBatchReviewContracts').OwnerBatchReviewCard) {
  const card = { ...pickerCard(initial, pickerReview), allowedActions: ['save_review', 'view_metadata', 'add_to_inventory'] as import('../contracts/ownerBatchReviewContracts').OwnerBatchReviewCard['allowedActions'] };
  return <QueryClientProvider client={client}><BatchReviewCard identity={pickerIdentity} card={override ?? card}
    defaults={pickerDefaults} canMutate isOffline={false} removePending={false} addPending={false}
    commandSlot={slots} onEditionSelection={refresh} onDraftChange={drafts} onAdd={add}
    onRemove={jest.fn()} /></QueryClientProvider>;
}
function mount(override?: import('../contracts/ownerBatchReviewContracts').OwnerBatchReviewCard) {
  return renderAsync(cardScreen(override));
}
it('opens/reopens without provider search, preserves current choice and explicitly searches only missing alternatives', async () => {
  read.mockResolvedValue({ ...initial, rows: [], optionsExpiresAt: null, lookupStatus: 'idle' });
  lookup.mockResolvedValue({ operationId: testUuid(50), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: false });
  const view = await mount();
  expect(lookup).not.toHaveBeenCalled();
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Search Books')).toBeTruthy();
  expect(lookup).not.toHaveBeenCalled();
  await fireEventAsync.press(view.getByText('Close metadata'));
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Search Books')).toBeTruthy();
  expect(lookup).not.toHaveBeenCalled();
  await fireEventAsync.press(view.getByText('Search Books'));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
});
it('reuses fresh empty results with no lookup loop', async () => {
  read.mockResolvedValue({ ...initial, rows: [] });
  const view = await mount(); await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('No book results were returned.')).toBeTruthy();
  expect(view.queryByText('Search Books')).toBeNull();
  expect(lookup).not.toHaveBeenCalled();
});
it('only adopts accepted selection, retaining latest price/quantity/shelf edits and sharing the Add lock', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>(); select.mockReturnValue(pending.promise);
  const view = await mount();
  await fireEventAsync.press(view.getByLabelText('Edit Price'));
  await fireEventAsync.changeText(view.getByLabelText('Custom whole rupees'), '42');
  await fireEventAsync.press(view.getByLabelText('Use custom price'));
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByLabelText('Select result 1: Chosen edition')).toBeTruthy();
  await fireEventAsync.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
  expect(registry.claim(initial.candidateId, 'add')).toBe(false);
  expect(refresh).not.toHaveBeenCalled();
  const accepted = selectedChoices({ reviewVersion: 2 }); read.mockResolvedValue(accepted);
  await act(async () => pending.resolve(accepted));
  await waitFor(() => expect(refresh).toHaveBeenCalledWith(accepted));
  expect(drafts.mock.calls.at(-1)[1]).toMatchObject({ priceMinor: 4200, metadataChoice: { mode: 'edition_option', selectionId: accepted.selection!.selectionId } });
  expect(registry.isClaimed(initial.candidateId)).toBe(false);
});
it('failed selection retains the draft and has a same-command retry', async () => {
  select.mockRejectedValue(new Error('network'));
  const view = await mount(); await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByLabelText('Select result 1: Chosen edition')).toBeTruthy();
  await fireEventAsync.press(view.getByLabelText('Select result 1: Chosen edition'));
  expect(await view.findByText('Retry selection')).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
  await fireEventAsync.press(view.getByText('Retry selection'));
  await waitFor(() => expect(select).toHaveBeenCalledTimes(2));
  expect(select.mock.calls[0][0]).toEqual(select.mock.calls[1][0]);
});
it('late selection after account change does not adopt card metadata', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>(); select.mockReturnValue(pending.promise);
  const view = await mount(); await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByLabelText('Select result 1: Chosen edition')).toBeTruthy();
  await fireEventAsync.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
  await act(async () => coordinateImageInventoryIdentity(null, client));
  await act(async () => pending.resolve(selectedChoices()));
  expect(refresh).not.toHaveBeenCalled(); expect(drafts).not.toHaveBeenCalled();
});
it('resumed compact held selection survives expired options without inventing a selling review', async () => {
  const saved = selectedChoices({ rows: [], optionsExpiresAt: null, reviewVersion: null,
    selection: { ...selectedChoices().selection!, source: 'current_suggestion', optionId: null, confirmedByOwner: true } });
  read.mockResolvedValue(saved); mockDetail = pickerDetail(saved);
  const view = await mount(pickerCard(saved));
  await waitFor(() => expect(read).toHaveBeenCalled());
  await act(async () => jest.advanceTimersByTime(1));
  await fireEventAsync.press(view.getByText('Add to inventory'));
  await waitFor(() => expect(add).toHaveBeenCalled());
  expect(add.mock.calls[0][2]).toMatchObject({ metadataChoice: { mode: 'edition_option', selectionId: saved.selection!.selectionId },
    priceMinor: 100, quantity: 1, shelfLocation: 'A1' });
});
it('closing the sheet returns focus to the actual compact-card trigger that opened it', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const view = await mount();
  const focusOf = (label: string) => {
    let node: typeof view.root | null = view.getByLabelText(label);
    while (node && typeof node.instance?.focus !== 'function') node = node.parent;
    expect(node).not.toBeNull();
    return node!.instance as { focus: jest.Mock; props: { accessibilityLabel: string } };
  };
  const changeTarget = focusOf('Find or change edition');
  expect(changeTarget.props.accessibilityLabel).toBe('Find or change edition');
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Close metadata')).toBeTruthy();
  await fireEventAsync.press(view.getByText('Close metadata'));
  await act(async () => jest.runAllTicks());
  expect(changeTarget.focus.mock.contexts.at(-1)?.props.accessibilityLabel).toBe('Find or change edition');
  jest.restoreAllMocks();
});

it('keeps Close and hardware back locked through selection reconciliation', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  const reconciliation = deferred<ReturnType<typeof selectedChoices>>();
  (ownerEditionPickerService.selectEdition as jest.Mock).mockReturnValue(pending.promise);
  const view = await mount();

  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByLabelText('Select result 1: Chosen edition')).toBeTruthy();
  await fireEventAsync.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(ownerEditionPickerService.selectEdition).toHaveBeenCalledTimes(1));
  const signal = (ownerEditionPickerService.selectEdition as jest.Mock).mock.calls[0][1];
  const attemptDismiss = async () => {
    await fireEventAsync.press(view.getByText('Close metadata'));
    expect(view.queryByText('Close metadata')).toBeTruthy();
    await fireEventAsync(view.UNSAFE_getByType(Modal), 'requestClose');
    expect(view.queryByText('Close metadata')).toBeTruthy();
    expect(signal.aborted).toBe(false);
    expect(registry.isClaimed(initial.candidateId)).toBe(true);
  };
  await attemptDismiss();
  const accepted = selectedChoices({ reviewVersion: 2 });
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockReturnValue(reconciliation.promise);
  mockDetail = pickerDetail(accepted, pickerReview);
  await act(async () => pending.resolve(accepted));
  await attemptDismiss();
  await act(async () => reconciliation.resolve(accepted));
  expect(await view.findByText('Edition saved.')).toBeTruthy();
  await fireEventAsync.press(view.getByText('Close metadata'));
  expect(view.queryByText('Close metadata')).toBeNull();
});

it('preserves the compact-row sizing and touch target for the edition trigger', async () => {
  const view = await mount();
  for (const name of ['Find or change edition']) {
    const style = StyleSheet.flatten(view.getByRole('button', { name }).props.style);
    expect(style).toMatchObject({ minHeight: 48, flexGrow: 1, flexBasis: 150 });
  }
});
// Picker EP-D07 (2026-10-17): the sheet fix saves the whole card review, then searches; the draft becomes server authority.
it("Search Books saves the card's new title, then searches", async () => {
  const savedChoices = pickerChoices({ candidateVersion: initial.candidateVersion + 1, metadataRevision: initial.metadataRevision + 1,
    reviewVersion: 2, requestGeneration: 2, rows: [], optionsExpiresAt: null, lookupStatus: 'idle', selection: null });
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockImplementation(async () => {
    read.mockResolvedValue(savedChoices);
    mockDetail = pickerDetail({ ...savedChoices, selection: initial.selection }, pickerReview);
    return mockDetail;
  });
  lookup.mockResolvedValue({ operationId: testUuid(51), status: 'pending', requestGeneration: 2, optionsVersion: 1, available: true });
  const view = await mount();
  await fireEventAsync.press(view.getByLabelText('Edit Price'));
  await fireEventAsync.changeText(view.getByLabelText('Custom whole rupees'), '42');
  await fireEventAsync.press(view.getByLabelText('Use custom price'));
  await fireEventAsync.press(view.getByLabelText('Edit title for Book 1: Chosen edition'));
  await fireEventAsync.changeText(view.getByTestId('card-title-input'), 'Corrected title');
  await fireEventAsync(view.getByTestId('card-title-input'), 'blur');
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Search Books')).toBeTruthy();
  await fireEventAsync.press(view.getByText('Search Books'));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({ expectedCandidateVersion: initial.candidateVersion,
    expectedMetadataRevision: initial.metadataRevision,
    review: { originalTitle: 'Corrected title', priceMinor: 4200, metadataChoice: { mode: 'manual', selectionId: null } } });
  expect(lookup.mock.calls[0][0]).toMatchObject({ expectedRequestGeneration: 2 });
  await waitFor(() => expect(drafts).toHaveBeenLastCalledWith(initial.candidateId, {}, `${savedChoices.candidateVersion}:${savedChoices.metadataRevision}:2`));
  // The parent card read has not caught up: Add stays locked instead of re-adopting the older card authority.
  await act(async () => { await Promise.resolve(); });
  expect(view.UNSAFE_getByType(AddCandidateToInventoryAction).props.disabled).toBe(true);
});

it('incomplete card searches only with the saved title', async () => {
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview');
  lookup.mockResolvedValue({ operationId: testUuid(55), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: true });
  const view = await mount();
  await fireEventAsync.press(view.getByLabelText('Edit title for Book 1: Chosen edition'));
  await fireEventAsync.changeText(view.getByTestId('card-title-input'), 'New title');
  await fireEventAsync(view.getByTestId('card-title-input'), 'blur');
  await fireEventAsync.press(view.getByLabelText('Edit Price'));
  await fireEventAsync.changeText(view.getByLabelText('Custom whole rupees'), '0');
  await fireEventAsync.press(view.getByLabelText('Use custom price'));
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText("Complete the card's details to search with the new title")).toBeTruthy();
  expect(view.queryByText('Search Books')).toBeNull();
  await fireEventAsync.press(view.getByLabelText('Search with saved title'));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  expect(save).not.toHaveBeenCalled();
  expect(drafts.mock.calls.at(-1)[1]).toMatchObject({ originalTitle: 'New title', priceMinor: 0 });
  save.mockRestore();
});
it('replays the frozen save-then-search request after an uncertain save', async () => {
  const pending = deferred<ReturnType<typeof pickerDetail>>();
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockRejectedValueOnce(new Error('lost response')).mockReturnValueOnce(pending.promise);
  const view = await mount();
  await fireEventAsync.press(view.getByLabelText('Edit title for Book 1: Chosen edition'));
  await fireEventAsync.changeText(view.getByTestId('card-title-input'), 'New title');
  await fireEventAsync(view.getByTestId('card-title-input'), 'blur');
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Search Books')).toBeTruthy();
  await fireEventAsync.press(view.getByText('Search Books'));
  expect(await view.findByText('Retry search')).toBeTruthy();
  await fireEventAsync.press(view.getByText('Retry search'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
  expect(registry.claim(initial.candidateId, 'add')).toBe(false);
  const response = pickerDetail(selectedChoices({ reviewVersion: 2 }), { ...pickerReview, originalTitle: 'New title', metadataChoice: { mode: 'manual', selectionId: null } });
  lookup.mockResolvedValue({ operationId: testUuid(56), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: true });
  await act(async () => pending.resolve(response));
  await waitFor(() => expect(registry.isClaimed(initial.candidateId)).toBe(false));
  save.mockRestore();
});

it('Add sends manual details after editing a chosen edition identity', async () => {
  add.mockResolvedValue({ status: 'succeeded' });
  const view = await mount(); await waitFor(() => expect(read).toHaveBeenCalled());
  await fireEventAsync.press(view.getByLabelText('Edit title for Book 1: Chosen edition'));
  await fireEventAsync.changeText(view.getByTestId('card-title-input'), 'New title');
  await fireEventAsync(view.getByTestId('card-title-input'), 'blur');
  await fireEventAsync.press(view.getByText('Add to inventory'));
  await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  expect(add.mock.calls[0][2]).toMatchObject({ originalTitle: 'New title', metadataChoice: { mode: 'manual', selectionId: null } });
});

const identityRequest = (): IdentitySearchRequest => ({
  review: { ...pickerReview, originalTitle: 'New title', metadataChoice: { mode: 'manual', selectionId: null } },
  expectedCandidateVersion: initial.candidateVersion, expectedMetadataRevision: initial.metadataRevision,
});

it.each(['P9_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH'] as const)('a definite save refusal %s refreshes the card and offers a new Search Books command', async code => {
  const error = registeredOwnerUxError(code);
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockRejectedValue(error);
  const request = identityRequest();
  const view = await renderAsync(cardScreen());
  await fireEventAsync.press(view.getByLabelText('Edit title for Book 1: Chosen edition'));
  await fireEventAsync.changeText(view.getByTestId('card-title-input'), 'New title');
  await fireEventAsync(view.getByTestId('card-title-input'), 'blur');
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Search Books')).toBeTruthy();
  read.mockClear();
  await fireEventAsync.press(view.getByText('Search Books'));
  expect(await view.findByText(code === 'P9_VERSION_CONFLICT'
    ? "This book changed. Check the card's details, then search again." : error.message)).toBeTruthy();
  expect(read).toHaveBeenCalled();
  expect(view.queryByText('Retry search')).toBeNull();
  expect(ownerUxService.readCandidate).toHaveBeenCalled();
  const refreshed = selectedChoices({ candidateVersion: 9, metadataRevision: 11, reviewVersion: 2 });
  read.mockResolvedValue(refreshed); mockDetail = pickerDetail(refreshed, request.review);
  const pending = deferred<ReturnType<typeof pickerDetail>>(); save.mockReturnValue(pending.promise);
  await view.rerenderAsync(cardScreen(pickerCard(refreshed, pickerReview)));
  await fireEventAsync.press(view.getByText('Close metadata'));
  await fireEventAsync.press(view.getByText('Reapply compact edits'));
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Search Books')).toBeTruthy();
  await fireEventAsync.press(view.getByText('Search Books'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toMatchObject({ expectedCandidateVersion: 9, expectedMetadataRevision: 11 });
  expect(save.mock.calls[1][0].idempotencyKey).not.toBe(save.mock.calls[0][0].idempotencyKey);
  expect(save.mock.calls[1][0].commandId).not.toBe(save.mock.calls[0][0].commandId);
  lookup.mockResolvedValue({ operationId: testUuid(60), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: true });
  await act(async () => pending.resolve(mockDetail));
  await waitFor(() => expect(registry.isClaimed(initial.candidateId)).toBe(false));
  save.mockRestore();
});

it('a refused lookup after saving offers Search Books with a fresh lookup and no repeated save', async () => {
  const request = identityRequest();
  const authority = selectedChoices({ candidateVersion: 6, metadataRevision: 9, reviewVersion: 2 });
  const saved = pickerDetail(authority, request.review);
  saved.metadata = { ...saved.metadata, state: 'manual', selectionId: null, snapshot: null };
  const choices = { ...authority, selection: null, lookupStatus: 'idle' as const, optionsExpiresAt: null, rows: [] };
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockImplementation(async () => {
    mockDetail = saved; read.mockResolvedValue(choices); return saved;
  });
  lookup.mockImplementationOnce(async () => {
    read.mockResolvedValue({ ...choices, requestGeneration: 3 });
    throw registeredOwnerUxError('P9_STATE_CONFLICT');
  });
  const view = await mount();
  await fireEventAsync.press(view.getByLabelText('Edit title for Book 1: Chosen edition'));
  await fireEventAsync.changeText(view.getByTestId('card-title-input'), 'New title');
  await fireEventAsync(view.getByTestId('card-title-input'), 'blur');
  await fireEventAsync.press(view.getByText('Find or change edition'));
  expect(await view.findByText('Search Books')).toBeTruthy();
  await fireEventAsync.press(view.getByText('Search Books'));
  expect(await view.findByText("This book changed. Check the card's details, then search again.")).toBeTruthy();
  expect(view.queryByText('Retry search')).toBeNull();
  await view.rerenderAsync(cardScreen({ ...pickerCard(authority, request.review), metadataState: 'manual', metadataSummary: null }));
  expect(await view.findByRole('button', { name: 'Search Books', disabled: false })).not.toBeDisabled();
  lookup.mockResolvedValue({ operationId: testUuid(61), status: 'pending', requestGeneration: 3, optionsVersion: 1, available: true });
  await fireEventAsync.press(view.getByText('Search Books'));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenCalledTimes(1);
  expect(lookup.mock.calls[1][0]).toMatchObject({ expectedRequestGeneration: 3 });
  expect(lookup.mock.calls[1][0].idempotencyKey).not.toBe(lookup.mock.calls[0][0].idempotencyKey);
  expect(lookup.mock.calls[1][0].commandId).not.toBe(lookup.mock.calls[0][0].commandId);
  save.mockRestore();
});
