jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { CandidateEditionPicker } from '../components/CandidateEditionPicker';
import type { EditionIdentityFixSource } from '../components/EditionIdentityFix';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { OwnerUxClientError, ownerUxService } from '../api/ownerUxService';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { identityFixReview } from '../review/compactReviewDraft';
import { pickerCard, pickerChoices, pickerDefaults, pickerDetail, pickerIdentity, pickerReview,
  selectedChoices } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); const { View } = require('react-native'); return React.createElement(View, props);
} }));
jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
const lookup = ownerEditionPickerService.requestEditionOptions as jest.Mock;
const slots = { claimSlot: jest.fn(() => 'slot'), releaseSlot: jest.fn(), isCommandActive: jest.fn(() => false) };
const savedVersions = { candidateVersion: 6, metadataRevision: 9 };
const afterSave = pickerChoices({ ...savedVersions, requestGeneration: 2, rows: [], optionsExpiresAt: null,
  lookupStatus: 'idle', selection: null });
let client: QueryClient;
let save: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-17T00:00:00Z')); jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  resetImageInventoryIdentityForTests(pickerIdentity);
  read.mockResolvedValue(selectedChoices());
  lookup.mockResolvedValue({ operationId: testUuid(40), status: 'pending', requestGeneration: 2, optionsVersion: 1, available: true });
  save = jest.spyOn(ownerUxService, 'updateCandidateReview')
    .mockImplementation(async () => { read.mockResolvedValue(afterSave); return pickerDetail(selectedChoices(savedVersions), pickerReview); });
});
afterEach(async () => {
  await act(async () => { await client.cancelQueries(); }); await cleanupAsync();
  client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear();
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

const source = (overrides: Partial<EditionIdentityFixSource> = {}): EditionIdentityFixSource => ({
  title: 'Antifragile', authors: ['Nasrim Nicholas Taleb'],
  build: (title, authors) => ({ review: { ...pickerReview, originalTitle: title, authors,
    originalFieldConfirmation: { title: true, authors: authors.map(() => true) },
    metadataChoice: { mode: 'manual', selectionId: null } },
  expectedCandidateVersion: 5, expectedMetadataRevision: 8 }),
  ...overrides,
});
function mount(fix = source(), onIdentitySaved = jest.fn()) {
  return render(<QueryClientProvider client={client}><CandidateEditionPicker identity={pickerIdentity}
    sessionId={pickerChoices().sessionId} candidateId={pickerChoices().candidateId} commandSlot={slots}
    disabled={false} onSelection={jest.fn()} identityFix={fix} onIdentitySaved={onIdentitySaved}>
    {() => <Text>summary</Text>}</CandidateEditionPicker></QueryClientProvider>);
}
const button = (view: ReturnType<typeof mount>, title: string) =>
  view.UNSAFE_getAllByType(Button).find(node => node.props.title === title)!;
async function openAndCorrect(view: ReturnType<typeof mount>) {
  await waitFor(() => expect(view.getByText('Wrong title or author? Fix it')).toBeTruthy());
  fireEvent.press(view.getByText('Wrong title or author? Fix it'));
  fireEvent.changeText(view.getByLabelText('Corrected author 1'), 'Nassim Nicholas Taleb');
}

it('is offered even when selectable results exist, and warns that saving clears the chosen edition', async () => {
  const view = mount();
  await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  fireEvent.press(view.getByText('Wrong title or author? Fix it'));
  expect(view.getByText('Saving clears the chosen edition. You can choose again from the new results.')).toBeTruthy();
  expect(button(view, 'Save and search again').props.disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
});

it('omits the clear warning when nothing is chosen', async () => {
  read.mockResolvedValue(pickerChoices());
  const view = mount();
  await waitFor(() => expect(view.queryByLabelText('Select result 1: Chosen edition')).toBeTruthy());
  fireEvent.press(view.getByText('Wrong title or author? Fix it'));
  expect(view.queryByText('Saving clears the chosen edition. You can choose again from the new results.')).toBeNull();
});

it('saves the corrected identity first, then searches with the saved identity', async () => {
  const saved = jest.fn();
  const view = mount(source(), saved);
  await openAndCorrect(view);
  await act(async () => { fireEvent.press(view.getByText('Save and search again')); });
  await waitFor(() => expect(view.getByText('Title and author saved. Searching books…')).toBeTruthy());
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({ sessionId: pickerChoices().sessionId, candidateId: pickerChoices().candidateId,
    expectedCandidateVersion: 5, expectedMetadataRevision: 8,
    review: { originalTitle: 'Antifragile', authors: ['Nassim Nicholas Taleb'], metadataChoice: { mode: 'manual', selectionId: null } } });
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(lookup.mock.calls[0][0]).toMatchObject({ action: 'request_candidate_edition_options', expectedRequestGeneration: 2 });
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(lookup.mock.invocationCallOrder[0]);
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ candidateVersion: 6, metadata: expect.objectContaining({ revision: 9 }) }));
  expect(view.queryByTestId('edition-identity-fix')).toBeNull();
});

it('keeps the save when the search cannot start and points to Search Books', async () => {
  lookup.mockRejectedValue(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'internal'));
  const view = mount();
  await openAndCorrect(view);
  await act(async () => { fireEvent.press(view.getByText('Save and search again')); });
  await waitFor(() => expect(view.getByText('Title and author saved. Use Search Books to search again.')).toBeTruthy());
  expect(save).toHaveBeenCalledTimes(1);
});

it('a changed book stops before any search', async () => {
  save.mockRejectedValue(new OwnerUxClientError('P9_VERSION_CONFLICT', false, 'conflict'));
  const view = mount();
  await openAndCorrect(view);
  await act(async () => { fireEvent.press(view.getByText('Save and search again')); });
  await waitFor(() => expect(view.getByText('This book changed. Close and reopen this sheet, then try again.')).toBeTruthy());
  expect(lookup).not.toHaveBeenCalled();
  expect(view.getByTestId('edition-identity-fix')).toBeTruthy();
});

it('an incomplete card explains itself without saving', async () => {
  const view = mount(source({ build: () => ({ message: 'Complete this card first: Enter a price.' }) }));
  await openAndCorrect(view);
  await act(async () => { fireEvent.press(view.getByText('Save and search again')); });
  expect(view.getByText('Complete this card first: Enter a price.')).toBeTruthy();
  expect(save).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
});

describe('identityFixReview', () => {
  it('carries the corrected identity, confirms it, returns to manual and keeps card edits', () => {
    const card = pickerCard(selectedChoices(), pickerReview);
    const result = identityFixReview(card, pickerDefaults, { quantity: 4 }, 'Antifragile', ['Nassim Nicholas Taleb']);
    expect(result.issues).toEqual([]);
    expect(result.review).toMatchObject({ originalTitle: 'Antifragile', authors: ['Nassim Nicholas Taleb'],
      metadataChoice: { mode: 'manual', selectionId: null }, quantity: 4,
      originalFieldConfirmation: { title: true, authors: [true] } });
  });
});
