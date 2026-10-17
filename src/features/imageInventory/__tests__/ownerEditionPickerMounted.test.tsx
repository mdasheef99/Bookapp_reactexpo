jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal, Platform, StyleSheet } from 'react-native';
import { act, cleanupAsync, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BatchReviewCard } from '../components/BatchReviewCard';
import { AddCandidateToInventoryAction } from '../components/AddCandidateToInventoryAction';
import { CandidateReviewEditionSheet } from '../components/CandidateReviewEditionSheet';
import { ownerUxService } from '../api/ownerUxService';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { CandidateCommandRegistry } from '../commit/inventoryCommitTypes';
import { resetImageInventoryIdentityForTests, coordinateImageInventoryIdentity } from '../queries/ownerUxQueries';
import { pickerChoices, selectedChoices, pickerIdentity, pickerCard, pickerDetail, pickerDefaults, pickerReview, deferred } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); const { View } = require('react-native');
  return React.createElement(View, props);
} }));
jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
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
  read.mockResolvedValue(initial);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  registry = new CandidateCommandRegistry(); let sequence = 0;
  slots = { claimSlot: (id, prefix) => { const token = prefix + ++sequence; return registry.claim(id, token) ? token : null; },
    releaseSlot: (id, token) => registry.release(id, token), isCommandActive: id => registry.isClaimed(id) };
  jest.spyOn(ownerUxService, 'readCandidate').mockImplementation(async () => mockDetail);
  resetImageInventoryIdentityForTests(pickerIdentity);
});
afterEach(async () => { await act(async () => { await client.cancelQueries(); }); await cleanupAsync(); client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear(); jest.clearAllTimers(); jest.useRealTimers(); });
function mount(override?: import('../contracts/ownerBatchReviewContracts').OwnerBatchReviewCard) {
  const card = { ...pickerCard(initial, pickerReview), allowedActions: ['save_review', 'view_metadata', 'add_to_inventory'] as import('../contracts/ownerBatchReviewContracts').OwnerBatchReviewCard['allowedActions'] };
  return render(<QueryClientProvider client={client}><BatchReviewCard identity={pickerIdentity} card={override ?? card}
    defaults={pickerDefaults} canMutate isOffline={false} removePending={false} addPending={false}
    commandSlot={slots} onEditionSelection={refresh} onDraftChange={drafts} onAdd={add}
    onOpenFullCorrection={jest.fn()} onRemove={jest.fn()} /></QueryClientProvider>);
}
it('opens/reopens without provider search, preserves current choice and explicitly searches only missing alternatives', async () => {
  read.mockResolvedValue({ ...initial, rows: [], optionsExpiresAt: null, lookupStatus: 'idle' });
  lookup.mockResolvedValue({ operationId: testUuid(50), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: false });
  const view = mount();
  expect(lookup).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByText('Search Books')).toBeTruthy());
  expect(lookup).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Close metadata'));
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByText('Search Books')).toBeTruthy());
  expect(lookup).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Search Books'));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
});
it('reuses fresh empty results with no lookup loop', async () => {
  read.mockResolvedValue({ ...initial, rows: [] });
  const view = mount(); fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByText('No book results were returned.')).toBeTruthy());
  expect(view.queryByText('Search Books')).toBeNull();
  expect(lookup).not.toHaveBeenCalled();
});
it('only adopts accepted selection, retaining latest price/quantity/shelf edits and sharing the Add lock', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>(); select.mockReturnValue(pending.promise);
  const view = mount();
  fireEvent.press(view.getByLabelText('Edit Price'));
  fireEvent.changeText(view.getByLabelText('Custom whole rupees'), '42');
  fireEvent.press(view.getByLabelText('Use custom price'));
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
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
  const view = mount(); fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(view.getByText('Retry selection')).toBeTruthy());
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Retry selection'));
  await waitFor(() => expect(select).toHaveBeenCalledTimes(2));
  expect(select.mock.calls[0][0]).toEqual(select.mock.calls[1][0]);
});
it('late selection after account change does not adopt card metadata', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>(); select.mockReturnValue(pending.promise);
  const view = mount(); fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
  await act(async () => coordinateImageInventoryIdentity(null, client));
  await act(async () => pending.resolve(selectedChoices()));
  expect(refresh).not.toHaveBeenCalled(); expect(drafts).not.toHaveBeenCalled();
});
it('resumed compact held selection survives expired options without inventing a selling review', async () => {
  const saved = selectedChoices({ rows: [], optionsExpiresAt: null, reviewVersion: null,
    selection: { ...selectedChoices().selection!, source: 'current_suggestion', optionId: null, confirmedByOwner: true } });
  read.mockResolvedValue(saved); mockDetail = pickerDetail(saved);
  const view = mount(pickerCard(saved));
  await waitFor(() => expect(read).toHaveBeenCalled());
  await act(async () => jest.advanceTimersByTime(1));
  fireEvent.press(view.getByText('Add to inventory'));
  await waitFor(() => expect(add).toHaveBeenCalled());
  expect(add.mock.calls[0][2]).toMatchObject({ metadataChoice: { mode: 'edition_option', selectionId: saved.selection!.selectionId },
    priceMinor: 0, quantity: 1, shelfLocation: 'A1' });
});
it('closing the sheet returns focus to the actual compact-card trigger that opened it', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const view = mount();
  const focusOf = (label: string) => {
    let node: typeof view.root | null = view.getByLabelText(label);
    while (node && typeof node.instance?.focus !== 'function') node = node.parent;
    expect(node).not.toBeNull();
    return node!.instance as { focus: jest.Mock; props: { accessibilityLabel: string } };
  };
  const changeTarget = focusOf('Find or change edition'); const metadataTarget = focusOf('View metadata');
  expect(changeTarget.props.accessibilityLabel).toBe('Find or change edition');
  expect(metadataTarget.props.accessibilityLabel).toBe('View metadata');
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByText('Close metadata')).toBeTruthy());
  fireEvent.press(view.getByText('Close metadata'));
  await act(async () => jest.runAllTicks());
  expect(changeTarget.focus.mock.contexts.at(-1)?.props.accessibilityLabel).toBe('Find or change edition');
  fireEvent.press(view.getByText('View metadata'));
  fireEvent.press(view.getByText('Close metadata'));
  await act(async () => jest.runAllTicks());
  expect(metadataTarget.focus.mock.contexts.at(-1)?.props.accessibilityLabel).toBe('View metadata');
  jest.restoreAllMocks();
});

it('keeps Close and hardware back locked through selection reconciliation', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  const reconciliation = deferred<ReturnType<typeof selectedChoices>>();
  (ownerEditionPickerService.selectEdition as jest.Mock).mockReturnValue(pending.promise);
  const view = mount();

  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(ownerEditionPickerService.selectEdition).toHaveBeenCalledTimes(1));
  const signal = (ownerEditionPickerService.selectEdition as jest.Mock).mock.calls[0][1];
  const attemptDismiss = () => {
    fireEvent.press(view.getByText('Close metadata'));
    expect(view.queryByText('Close metadata')).toBeTruthy();
    fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
    expect(view.queryByText('Close metadata')).toBeTruthy();
    expect(signal.aborted).toBe(false);
    expect(registry.isClaimed(initial.candidateId)).toBe(true);
  };
  attemptDismiss();
  const accepted = selectedChoices({ reviewVersion: 2 });
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockReturnValue(reconciliation.promise);
  mockDetail = pickerDetail(accepted, pickerReview);
  await act(async () => pending.resolve(accepted));
  attemptDismiss();
  await act(async () => reconciliation.resolve(accepted));
  await waitFor(() => expect(view.getByText('Edition saved.')).toBeTruthy());
  fireEvent.press(view.getByText('Close metadata'));
  expect(view.queryByText('Close metadata')).toBeNull();
});

it('keeps the full-review edition trigger at its natural touch-target height and opens the picker', async () => {
  const view = render(<QueryClientProvider client={client}><CandidateReviewEditionSheet
    identity={pickerIdentity} detail={mockDetail} disabled={false} commandSlot={slots}
    onSelection={refresh} onManual={jest.fn()} onPendingChange={jest.fn()} /></QueryClientProvider>);
  const style = StyleSheet.flatten(view.getByRole('button', { name: 'Find or change edition' }).props.style);
  expect(style.minHeight).toBeGreaterThanOrEqual(48);
  expect(style.flexBasis).toBeUndefined();
  expect(style.flexGrow).toBeUndefined();
  fireEvent.press(view.getByRole('button', { name: 'Find or change edition' }));
  await waitFor(() => expect(view.getByLabelText('Select result 1: Chosen edition')).toBeTruthy());
});

it('preserves the compact-row sizing and touch targets for both metadata triggers', () => {
  const view = mount();
  for (const name of ['Find or change edition', 'View metadata']) {
    const style = StyleSheet.flatten(view.getByRole('button', { name }).props.style);
    expect(style).toMatchObject({ minHeight: 48, flexGrow: 1, flexBasis: 150 });
  }
});
// Picker EP-D07 (2026-10-17): the sheet fix saves the whole card review, then searches; the draft becomes server authority.
it('saves a title fix with the card edits, clears the draft and searches the saved identity', async () => {
  const savedChoices = pickerChoices({ candidateVersion: initial.candidateVersion + 1, metadataRevision: initial.metadataRevision + 1,
    reviewVersion: 2, requestGeneration: 2, rows: [], optionsExpiresAt: null, lookupStatus: 'idle', selection: null });
  const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockImplementation(async () => {
    read.mockResolvedValue(savedChoices);
    mockDetail = pickerDetail({ ...savedChoices, selection: initial.selection }, pickerReview);
    return mockDetail;
  });
  lookup.mockResolvedValue({ operationId: testUuid(51), status: 'pending', requestGeneration: 2, optionsVersion: 1, available: true });
  const view = mount();
  fireEvent.press(view.getByLabelText('Edit Price'));
  fireEvent.changeText(view.getByLabelText('Custom whole rupees'), '42');
  fireEvent.press(view.getByLabelText('Use custom price'));
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByText('Wrong title or author? Fix it')).toBeTruthy());
  fireEvent.press(view.getByText('Wrong title or author? Fix it'));
  fireEvent.changeText(view.getByLabelText('Corrected title'), 'Corrected title');
  await act(async () => { fireEvent.press(view.getByText('Save and search again')); });
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
