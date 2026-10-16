jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';
import { Modal, Platform, Text, type View } from 'react-native';
import { CandidateEditionPicker } from '../components/CandidateEditionPicker';
import { CandidateMetadataSheet } from '../components/CandidateMetadataSheet';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { ownerUxService } from '../api/ownerUxService';
import { resetImageInventoryIdentityForTests, imageInventoryKeys } from '../queries/ownerUxQueries';
import { ownerEditionPickerKeys } from '../queries/ownerEditionPickerKeys';
import { pickerChoices, selectedChoices, pickerIdentity, pickerCard, pickerDetail, pickerReview } from '../testing/editionPickerClientFixtures';

jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); const { View } = require('react-native'); return React.createElement(View, props);
} }));
jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
const lookup = ownerEditionPickerService.requestEditionOptions as jest.Mock;
let client: QueryClient;
const slots = { claimSlot: jest.fn(() => 'existing'), releaseSlot: jest.fn(), isCommandActive: jest.fn(() => false) };
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-08T00:00:00Z')); jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  resetImageInventoryIdentityForTests(pickerIdentity); read.mockResolvedValue(selectedChoices());
});
afterEach(async () => {
  await act(async () => { await client.cancelQueries(); }); await cleanupAsync();
  client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear();
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});
function mount() {
  return render(<QueryClientProvider client={client}><CandidateEditionPicker identity={pickerIdentity}
    sessionId={pickerChoices().sessionId} candidateId={pickerChoices().candidateId} commandSlot={slots}
    disabled={false} onSelection={jest.fn()}>{choices => <Text>Current: {choices?.selection?.snapshot.title ?? 'held choice'}</Text>}</CandidateEditionPicker></QueryClientProvider>);
}
it('expiry reveals explicit Search Books without searching or erasing the held selection', async () => {
  read.mockResolvedValue(selectedChoices({ optionsExpiresAt: '2026-10-08T00:00:01Z' }));
  const view = mount();
  await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  act(() => jest.advanceTimersByTime(1001));
  expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeNull();
  expect(view.getByText('Search Books')).toBeTruthy();
  expect(view.getByText('Current: Chosen edition')).toBeTruthy(); expect(lookup).not.toHaveBeenCalled();
});
it.each(['idle', 'failed'] as const)('%s alternatives keep explicit search available without an automatic lookup', async lookupStatus => {
  read.mockResolvedValue(selectedChoices({ lookupStatus, optionsExpiresAt: null, rows: [] }));
  const view = mount(); await waitFor(() => expect(view.queryByText('Search Books')).toBeTruthy());
  expect(view.getByText('Current: Chosen edition')).toBeTruthy(); expect(lookup).not.toHaveBeenCalled();
});
it('pending choices poll internal reads without a provider command', async () => {
  read.mockResolvedValue(selectedChoices({ lookupStatus: 'pending', optionsExpiresAt: null, rows: [] }));
  const view = mount(); await waitFor(() => expect(view.queryByText('Searching books…')).toBeTruthy());
  const before = read.mock.calls.length;
  await act(async () => { jest.advanceTimersByTime(3100); });
  expect(read.mock.calls.length).toBeGreaterThan(before); expect(lookup).not.toHaveBeenCalled();
  expect(view.queryByText('Search Books')).toBeNull();
});
it('failed internal read offers Retry choices, retaining the current choice and manual sheet path', async () => {
  read.mockRejectedValue(new Error('read failure'));
  const view = mount(); await waitFor(() => expect(view.queryByText('Retry choices')).toBeTruthy());
  expect(view.getByText('Current: held choice')).toBeTruthy(); expect(lookup).not.toHaveBeenCalled();
});
it('ordinary sheet and hardware close return focus without adopting or editing a draft', async () => {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue(pickerDetail(selectedChoices(), pickerReview));
  const focus = jest.fn(); const close = jest.fn(); const manual = jest.fn();
  const view = render(<QueryClientProvider client={client}><CandidateMetadataSheet identity={pickerIdentity}
    card={pickerCard()} visible disabled={false} onClose={close} onUseDetected={manual} onEditManually={manual}
    restoreFocusRef={{ current: { focus } as unknown as View }} /></QueryClientProvider>);
  fireEvent.press(view.getByText('Close metadata'));
  await act(async () => jest.runAllTicks());
  expect(close).toHaveBeenCalledTimes(1); expect(focus).toHaveBeenCalledTimes(1); expect(manual).not.toHaveBeenCalled();
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  await act(async () => jest.runAllTicks());
  expect(close).toHaveBeenCalledTimes(2); expect(focus).toHaveBeenCalledTimes(2);
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
});
it('a superseded option cannot be presented as an automatic suggestion to confirm', async () => {
  read.mockResolvedValue(selectedChoices({ selection: { ...selectedChoices().selection!, confirmedByOwner: false } }));
  const view = mount(); await waitFor(() => expect(view.queryByText('Current: Chosen edition')).toBeTruthy());
  expect(view.queryByText('Confirm current suggestion')).toBeNull();
});
it('failed lookup preserves prior fresh rows while announcing its failure', async () => {
  read.mockResolvedValue(selectedChoices({ lookupStatus: 'failed' }));
  const view = mount(); await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  expect(view.queryByText('Edition search failed. Your current choice and any fresh results are kept.')).toBeTruthy();
});
it('a cached older set cannot replace the current saved metadata or expose stale selection rows', async () => {
  const older = selectedChoices();
  const current = selectedChoices({ candidateVersion: 6, metadataRevision: 9,
    selection: { ...older.selection!, snapshot: { ...older.selection!.snapshot, title: 'New saved choice' } } });
  const detail = pickerDetail(current);
  client.setQueryData(ownerEditionPickerKeys.choices(pickerIdentity, current.sessionId, current.candidateId), older);
  client.setQueryData(imageInventoryKeys.candidate(pickerIdentity, current.sessionId, current.candidateId), detail);
  read.mockResolvedValue(older);
  jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue(detail);
  const view = render(<QueryClientProvider client={client}><CandidateMetadataSheet identity={pickerIdentity}
    card={pickerCard(current)} visible disabled={false} commandSlot={slots}
    onSelection={jest.fn()} onClose={jest.fn()} onUseDetected={jest.fn()} onEditManually={jest.fn()} /></QueryClientProvider>);
  await waitFor(() => expect(read).toHaveBeenCalled());
  expect(view.getByText('Title: New saved choice')).toBeTruthy();
  expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeNull();
  expect(view.getByText('Retry choices')).toBeTruthy();
  expect(lookup).not.toHaveBeenCalled();
});

it('announces fresh empty results politely', async () => {
  read.mockResolvedValue(selectedChoices({ rows: [] }));
  const view = mount();
  await waitFor(() => expect(view.getByText('No book results were returned.')).toBeTruthy());
  expect(view.getByText('No book results were returned.').props.accessibilityLiveRegion).toBe('polite');
});
it('hides stale detected identity and rejects its action even if invoked directly', async () => {
  const older = selectedChoices();
  const stale = { ...pickerDetail(older, pickerReview), observed: { ...pickerDetail(older).observed, title: 'Stale detected title' } };
  const current = selectedChoices({ candidateVersion: 6, metadataRevision: 9 });
  client.setQueryData(imageInventoryKeys.candidate(pickerIdentity, current.sessionId, current.candidateId), stale);
  jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue(stale);
  read.mockResolvedValue(current);
  const detected = jest.fn(), manual = jest.fn();
  const view = render(<QueryClientProvider client={client}><CandidateMetadataSheet identity={pickerIdentity}
    card={pickerCard(current)} visible disabled={false} commandSlot={slots}
    onSelection={jest.fn()} onClose={jest.fn()} onUseDetected={detected} onEditManually={manual} /></QueryClientProvider>);
  await waitFor(() => expect(read).toHaveBeenCalled());
  expect(view.queryByText('Detected title: Stale detected title')).toBeNull();
  const action = view.UNSAFE_getAllByType(Button).find(node => node.props.title === 'Use detected details')!;
  expect(action.props.disabled).toBe(true);
  act(() => action.props.onPress());
  expect(detected).not.toHaveBeenCalled(); expect(manual).not.toHaveBeenCalled();
});

// Picker §3.1/§7: known changed authority needs a new action, uncertain transport retains the command.
describe('selection-error recovery', () => {
  const select = ownerEditionPickerService.selectEdition as jest.Mock;
  const registered = (code: import('../api/ownerUxTransport').OwnerUxErrorCode) => require('../api/ownerUxTransport').registeredOwnerUxError(code);
  beforeEach(() => { select.mockReset(); read.mockResolvedValue(pickerChoices()); });
  it.each(['P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT'] as const)('%s offers a read refresh without blindly replaying a stale command', async code => {
    select.mockRejectedValue(registered(code));
    const view = mount();
    await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
    await waitFor(() => expect(view.queryByText('The book or its edition choices changed. Review the latest choices before selecting again.')).toBeTruthy());
    expect(view.queryByText('Retry selection')).toBeNull();
    expect(view.queryByText('Edition saved.')).toBeNull();
    const before = read.mock.calls.length;
    fireEvent.press(view.getByText('Refresh edition choices'));
    await waitFor(() => expect(read.mock.calls.length).toBeGreaterThan(before));
    expect(select).toHaveBeenCalledTimes(1); expect(lookup).not.toHaveBeenCalled();
  });
  it('recognizes superseded client authority as a refresh case', async () => {
    select.mockRejectedValue(require('../queries/ownerCandidateAuthority').authorityChanged());
    const view = mount();
    await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
    await waitFor(() => expect(view.queryByText('Refresh edition choices')).toBeTruthy());
    expect(view.queryByText('Retry selection')).toBeNull(); expect(view.queryByText('Edition saved.')).toBeNull();
  });
  it.each(['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND', 'P9_IDEMPOTENCY_MISMATCH'] as const)('%s displays the registered message with no command retry', async code => {
    const error = registered(code); select.mockRejectedValue(error);
    const view = mount();
    await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
    await waitFor(() => expect(view.queryByText(error.message)).toBeTruthy());
    expect(view.queryByText('Retry selection')).toBeNull(); expect(view.queryByText('Edition saved.')).toBeNull();
  });
  it('an uncertain network response retries the exact command and only then reports confirmed success', async () => {
    select.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce(selectedChoices());
    const view = mount();
    await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
    await waitFor(() => expect(view.queryByText('Retry selection')).toBeTruthy());
    expect(view.queryByText('Edition saved.')).toBeNull();
    read.mockResolvedValue(selectedChoices()); fireEvent.press(view.getByText('Retry selection'));
    await waitFor(() => expect(view.queryByText('Edition saved.')).toBeTruthy());
    expect(select.mock.calls[0][0]).toEqual(select.mock.calls[1][0]); expect(lookup).not.toHaveBeenCalled();
  });
});

// Owner amendment 2026-10-16: offer the existing manual identity path when nothing is selectable.
describe('no selectable edition', () => {
  const blockedRow = { optionId: '00000000-0000-4000-8000-000000000041', ordinal: 0,
    googleBooksUrl: 'https://books.google.com/books?id=blocked', eligibility: 'ineligible' as const,
    metadata: { ...pickerChoices().rows[0].metadata!, title: 'Other book' } };
  function mountWithEdit(onEditIdentity: jest.Mock, disabled = false) {
    return render(<QueryClientProvider client={client}><CandidateEditionPicker identity={pickerIdentity}
      sessionId={pickerChoices().sessionId} candidateId={pickerChoices().candidateId} commandSlot={slots}
      disabled={disabled} onSelection={jest.fn()} onEditIdentity={onEditIdentity}>{() => null}</CandidateEditionPicker></QueryClientProvider>);
  }
  it('offers Edit title/author for a fresh set with no eligible row', async () => {
    read.mockResolvedValue(pickerChoices({ rows: [blockedRow] }));
    const edit = jest.fn(); const view = mountWithEdit(edit);
    await waitFor(() => expect(view.queryByText('Edit title/author')).toBeTruthy());
    fireEvent.press(view.getByText('Edit title/author'));
    expect(edit).toHaveBeenCalledTimes(1); expect(lookup).not.toHaveBeenCalled();
  });
  it('offers it for a fresh empty result set too', async () => {
    read.mockResolvedValue(pickerChoices({ rows: [] }));
    const view = mountWithEdit(jest.fn());
    await waitFor(() => expect(view.queryByText('No book results were returned.')).toBeTruthy());
    expect(view.getByText('Edit title/author')).toBeTruthy();
  });
  it('does not offer it when an eligible row exists or results are not fresh', async () => {
    read.mockResolvedValue(pickerChoices());
    const view = mountWithEdit(jest.fn());
    await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
    expect(view.queryByText('Edit title/author')).toBeNull();
    read.mockResolvedValue(pickerChoices({ rows: [], optionsExpiresAt: null, lookupStatus: 'idle' }));
    const expired = mountWithEdit(jest.fn());
    await waitFor(() => expect(expired.queryAllByText('Search Books').length).toBeGreaterThan(0));
    expect(expired.queryByText('Edit title/author')).toBeNull();
  });
  it('a locked picker keeps the prompt but cannot invoke it', async () => {
    read.mockResolvedValue(pickerChoices({ rows: [blockedRow] }));
    const edit = jest.fn(); const view = mountWithEdit(edit, true);
    await waitFor(() => expect(view.queryByText('Edit title/author')).toBeTruthy());
    fireEvent.press(view.getByText('Edit title/author'));
    expect(edit).not.toHaveBeenCalled();
  });
});

describe('disabled sheet reason', () => {
  const mountSheet = (disabled: boolean) => render(<QueryClientProvider client={client}><CandidateMetadataSheet
    identity={pickerIdentity} card={pickerCard()} visible disabled={disabled} commandSlot={slots}
    disabledReason="Finish editing the title or author on this card before choosing an edition."
    onSelection={jest.fn()} onClose={jest.fn()} onUseDetected={jest.fn()} onEditManually={jest.fn()} /></QueryClientProvider>);
  it('explains a caller-owned lock only while disabled', async () => {
    jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue(pickerDetail());
    const locked = mountSheet(true);
    expect(locked.getByText('Finish editing the title or author on this card before choosing an edition.')).toBeTruthy();
    await waitFor(() => expect(read).toHaveBeenCalled());
    const open = mountSheet(false);
    expect(open.queryByText('Finish editing the title or author on this card before choosing an edition.')).toBeNull();
  });
});
