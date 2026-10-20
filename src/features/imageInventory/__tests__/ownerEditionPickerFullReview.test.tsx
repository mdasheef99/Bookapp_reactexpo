jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal } from 'react-native';
import { act, cleanupAsync, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CandidateReview } from '../screens/CandidateReviewScreens';
import { ownerUxService } from '../api/ownerUxService';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { pickerChoices, selectedChoices, pickerIdentity, pickerDetail, pickerReview, pickerDefaults, deferred } from '../testing/editionPickerClientFixtures';
import { sessionSummaryFixture } from '../testing/ownerUxTestFixtures';

const mockNavigation = { addListener: jest.fn(() => jest.fn()), dispatch: jest.fn() };
jest.mock('expo-router', () => ({ useNavigation: () => mockNavigation,
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); const { View } = require('react-native'); return React.createElement(View, props);
} }));
jest.mock('../components/CandidateCorrectionActions', () => ({ CandidateCorrectionActions: () => null }));
jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
jest.mock('../queries/ownerBatchReviewQueries', () => ({
  ...jest.requireActual('../queries/ownerBatchReviewQueries'),
  useOwnerSessionV3: () => ({ data: mockSession,
    isFetchedAfterMount: true, refetch: jest.fn(async () => ({ data: mockSession, error: null, isError: false })) }),
}));
const mockSession = { ...sessionSummaryFixture(), defaults: pickerDefaults };
jest.setTimeout(30_000);
let client: QueryClient;
const initial = pickerChoices({ selection: { ...selectedChoices().selection!, confirmedByOwner: false }, reviewVersion: 1 });
let detail = pickerDetail(initial, pickerReview);
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks(); detail = pickerDetail(initial, pickerReview);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  resetImageInventoryIdentityForTests(pickerIdentity);
  jest.spyOn(ownerUxService, 'readCandidate').mockImplementation(async () => detail);
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockResolvedValue(initial);
});
afterEach(async () => { await act(async () => { await client.cancelQueries(); }); await cleanupAsync(); client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear(); jest.clearAllTimers(); jest.useRealTimers(); });
it('older unfinished full-review cards open the same sheet and adopt server selection with unsaved selling values', async () => {
  const view = render(<QueryClientProvider client={client}><CandidateReview identity={pickerIdentity}
    sessionId={initial.sessionId} candidateId={initial.candidateId} /></QueryClientProvider>);
  await waitFor(() => expect(view.getByTestId('review-original-title')).toBeTruthy());
  expect(view.queryByText('Find or change edition')).toBeTruthy();
  fireEvent.changeText(view.getByTestId('review-price-minor'), '47');
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  expect(ownerEditionPickerService.requestEditionOptions).not.toHaveBeenCalled();
  const accepted = selectedChoices({ reviewVersion: 2, selection: { ...selectedChoices().selection!,
    snapshot: { ...selectedChoices().selection!.snapshot, title: 'Accepted full edition' } } });
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  (ownerEditionPickerService.selectEdition as jest.Mock).mockReturnValue(pending.promise);
  expect(view.getByLabelText('Select result 1: Chosen edition').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(ownerEditionPickerService.selectEdition).toHaveBeenCalledTimes(1));
  detail = pickerDetail(accepted, pickerReview);
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockResolvedValue(accepted);
  await act(async () => pending.resolve(accepted));
  await waitFor(() => expect(view.getByText('Edition saved.')).toBeTruthy());
  fireEvent.press(view.getByText('Close metadata'));
  expect(view.getByTestId('review-price-minor').props.value).toBe('47');
  expect(view.getByTestId('review-original-title').props.value).toBe('Accepted full edition');
});
it('resumed full review uses the server-confirmed held suggestion before any selling review exists', async () => {
  const saved = selectedChoices({ rows: [], optionsExpiresAt: null, reviewVersion: null,
    selection: { ...selectedChoices().selection!, source: 'current_suggestion', optionId: null, confirmedByOwner: true } });
  detail = pickerDetail(saved);
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockResolvedValue(saved);
  const view = render(<QueryClientProvider client={client}><CandidateReview identity={pickerIdentity}
    sessionId={saved.sessionId} candidateId={saved.candidateId} /></QueryClientProvider>);
  await waitFor(() => expect(view.queryByTestId('review-original-title')).toBeTruthy());
  expect(view.getByTestId('review-original-title').props.value).toBe('Chosen edition');
  expect(view.getByTestId('review-price-minor').props.value).toBe('');
  expect(view.getByTestId('confirm-title').props.accessibilityState.checked).toBe(true);
});
// Picker §§6-7 / EP-AC19: mounted controls preserve controlled mode and manual confirmation.
it('matched-details control preserves the held edition in the actual Save payload', async () => {
  const saved = selectedChoices({ reviewVersion: 2 });
  detail = pickerDetail(saved, pickerReview);
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockResolvedValue(saved);
  const update = jest.spyOn(ownerUxService, 'updateCandidateReview').mockRejectedValue(new Error('test stop'));
  const view = render(<QueryClientProvider client={client}><CandidateReview identity={pickerIdentity}
    sessionId={saved.sessionId} candidateId={saved.candidateId} /></QueryClientProvider>);
  await waitFor(() => expect(view.queryByTestId('review-original-title')).toBeTruthy());
  fireEvent.press(view.getByText(/Use matched details$/));
  fireEvent.press(view.getByText('Save review'));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(update.mock.calls[0][0].review).toMatchObject({
    metadataChoice: { mode: 'edition_option', selectionId: saved.selection!.selectionId },
    priceMinor: 0, quantity: 3, shelfLocation: 'A1',
  });
});
it.each([{ authors: ['Chosen author'] }, { authors: ['Chosen author', 'Second chosen author'] }])(
  'full-correction edits require confirmation after the detected-details control is removed (%j)', async ({ authors }) => {
    const saved = selectedChoices({ reviewVersion: 2, selection: { ...selectedChoices().selection!,
      snapshot: { ...selectedChoices().selection!.snapshot, authors } } });
    const review = { ...pickerReview, authors, originalFieldConfirmation: { title: true, authors: authors.map(() => true) } };
    detail = pickerDetail(saved, review);
    detail = { ...detail, observed: { ...detail.observed, title: 'Different detected title', authors: ['Detected author'], language: 'en', script: 'Latn' } };
    (ownerEditionPickerService.readEditionChoices as jest.Mock).mockResolvedValue(saved);
    const view = render(<QueryClientProvider client={client}><CandidateReview identity={pickerIdentity}
      sessionId={saved.sessionId} candidateId={saved.candidateId} /></QueryClientProvider>);
    await waitFor(() => expect(view.queryByTestId('review-original-title')).toBeTruthy());
    fireEvent.press(view.getByText('Find or change edition'));
    await waitFor(() => expect(view.queryByText('Close metadata')).toBeTruthy());
    expect(view.queryByText('Use detected details')).toBeNull();
    expect(view.queryByText('Edit manually')).toBeNull();
    fireEvent.press(view.getByText('Close metadata'));
    fireEvent.press(view.getByText(/Use manual details$/));
    fireEvent.changeText(view.getByTestId('review-original-title'), 'Different detected title');
    fireEvent.changeText(view.getByTestId('review-author-0'), 'Detected author');
    if (authors.length > 1) fireEvent.press(view.getByText('Remove author 2'));
    expect(view.getByTestId('confirm-title').props.accessibilityState.checked).toBe(false);
    expect(view.getByTestId('confirm-author-0').props.accessibilityState.checked).toBe(false);
    fireEvent.press(view.getByTestId('confirm-title'));
    fireEvent.press(view.getByTestId('confirm-author-0'));
    const update = jest.spyOn(ownerUxService, 'updateCandidateReview').mockRejectedValue(new Error('test stop'));
    fireEvent.press(view.getByText('Save review'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0].review).toMatchObject({ originalTitle: 'Different detected title',
      authors: ['Detected author'], metadataChoice: { mode: 'manual', selectionId: null },
      originalFieldConfirmation: { title: true, authors: [true] }, priceMinor: 0, quantity: 3 });
  });
it('Edit title/author preserves confirmations when it replaces no identity fields', async () => {
  const saved = selectedChoices({ reviewVersion: 2, rows: [],
    selection: { ...selectedChoices().selection!, confirmedByOwner: false } });
  detail = pickerDetail(saved, pickerReview);
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockResolvedValue(saved);
  const view = render(<QueryClientProvider client={client}><CandidateReview identity={pickerIdentity}
    sessionId={saved.sessionId} candidateId={saved.candidateId} /></QueryClientProvider>);
  await waitFor(() => expect(view.queryByTestId('review-original-title')).toBeTruthy());
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.queryByText('Edit title/author')).toBeTruthy());
  expect(view.queryByText('Edit manually')).toBeNull();
  fireEvent.press(view.getByText('Edit title/author'));
  expect(view.getByTestId('confirm-title').props.accessibilityState.checked).toBe(true);
  expect(view.getByTestId('confirm-author-0').props.accessibilityState.checked).toBe(true);
});

it('keeps Close and hardware back locked through selection reconciliation', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  const reconciliation = deferred<ReturnType<typeof selectedChoices>>();
  (ownerEditionPickerService.selectEdition as jest.Mock).mockReturnValue(pending.promise);
  const view = render(<QueryClientProvider client={client}><CandidateReview identity={pickerIdentity}
    sessionId={initial.sessionId} candidateId={initial.candidateId} /></QueryClientProvider>);
  await waitFor(() => expect(view.getByTestId('review-original-title')).toBeTruthy());
  fireEvent.press(view.getByText('Find or change edition'));
  await waitFor(() => expect(view.getByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  fireEvent.press(view.getByLabelText('Select result 1: Chosen edition'));
  await waitFor(() => expect(ownerEditionPickerService.selectEdition).toHaveBeenCalledTimes(1));
  const signal = (ownerEditionPickerService.selectEdition as jest.Mock).mock.calls[0][1];
  const attemptDismiss = () => {
    fireEvent.press(view.getByText('Close metadata'));
    expect(view.queryByText('Close metadata')).toBeTruthy();
    const visibleModals = view.UNSAFE_getAllByType(Modal).filter(modal => modal.props.visible);
    expect(visibleModals).toHaveLength(1);
    fireEvent(visibleModals[0], 'requestClose');
    expect(view.queryByText('Close metadata')).toBeTruthy();
    expect(signal.aborted).toBe(false);

  };
  attemptDismiss();
  const accepted = selectedChoices({ reviewVersion: 2 });
  (ownerEditionPickerService.readEditionChoices as jest.Mock).mockReturnValue(reconciliation.promise);
  detail = pickerDetail(accepted, pickerReview);
  await act(async () => pending.resolve(accepted));
  attemptDismiss();
  await act(async () => reconciliation.resolve(accepted));
  await waitFor(() => expect(view.getByText('Edition saved.')).toBeTruthy());
  fireEvent.press(view.getByText('Close metadata'));
  expect(view.queryByText('Close metadata')).toBeNull();
});
