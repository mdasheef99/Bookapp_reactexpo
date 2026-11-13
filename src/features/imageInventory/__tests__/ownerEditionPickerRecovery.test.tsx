jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, render, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CandidateMetadataSheet } from '../components/CandidateMetadataSheet';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { ownerUxService } from '../api/ownerUxService';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { pickerChoices, pickerIdentity, pickerCard, pickerDetail } from '../testing/editionPickerClientFixtures';

// Load lazy native mocks before timed renders, as in ownerEditionPickerMounted.
void [ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View];

jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); const { View } = require('react-native'); return React.createElement(View, props);
} }));
jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
let client: QueryClient;
const slots = { claimSlot: jest.fn(() => 'existing'), releaseSlot: jest.fn(), isCommandActive: jest.fn(() => false) };

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-08T00:00:00Z')); jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  resetImageInventoryIdentityForTests(pickerIdentity);
  read.mockResolvedValue(pickerChoices({ optionsExpiresAt: null, lookupStatus: 'idle', rows: [] }));
});
afterEach(async () => {
  await act(async () => { await client.cancelQueries(); }); await cleanupAsync();
  client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear();
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

function mount({ metadataState, draftPending = false }: { metadataState: 'ambiguous' | 'pending'; draftPending?: boolean }) {
  const detail = pickerDetail();
  read.mockResolvedValue(pickerChoices({ candidateVersion: detail.candidateVersion,
    metadataRevision: detail.metadata.revision, optionsExpiresAt: null, lookupStatus: 'idle', rows: [] }));
  jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue({ ...detail,
    metadata: { ...detail.metadata, state: metadataState, selectionId: null, snapshot: null } });
  return render(<QueryClientProvider client={client}><CandidateMetadataSheet identity={pickerIdentity}
    card={{ ...pickerCard(), metadataState, metadataSummary: null }} visible disabled={false}
    commandSlot={slots} onSelection={jest.fn()} onClose={jest.fn()}
    cardDraft={{ identityChanged: false, pending: draftPending, request: null }} /></QueryClientProvider>);
}

it('ambiguous card with idle choices keeps Search Books visible and ISBN search enabled', async () => {
  const view = mount({ metadataState: 'ambiguous' });
  await waitFor(() => expect(view.getByRole('button', { name: 'Search Books' })).not.toBeDisabled());
  expect(view.getByRole('button', { name: 'Search by ISBN' })).not.toBeDisabled();
});

it('pending card keeps Search Books hidden and ISBN search disabled', async () => {
  const view = mount({ metadataState: 'pending', draftPending: true });
  await waitFor(() => expect(view.getByRole('button', { name: 'Search by ISBN' })).toBeDisabled());
  expect(view.queryByRole('button', { name: 'Search Books' })).toBeNull();
});
