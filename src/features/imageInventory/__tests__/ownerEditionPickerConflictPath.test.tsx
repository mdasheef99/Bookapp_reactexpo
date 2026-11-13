jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanupAsync, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { OwnerUxClientError, registeredOwnerUxError } from '../api/ownerUxTransport';
import { CandidateEditionPicker } from '../components/CandidateEditionPicker';
import { OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { editionLookupRecovery } from '../review/editionSelectionRecovery';
import { pickerChoices, pickerIdentity } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';
import { executeOwnerEditionPicker } from '../../../../supabase/functions/_shared/imageInventory/runtime/ownerEditionPickerGateway';
import { ownerUxFailureResponse } from '../../../../supabase/functions/_shared/imageInventory/contracts/ownerUxHttp';

// 02d Unit 2 §3 (E1): SQL error -> gateway -> HTTP envelope -> client parser -> sheet refresh copy.
const expected = 'These choices may have changed. Review the latest choices and try again.';
const idle = pickerChoices({ lookupStatus: 'idle', rows: [], optionsExpiresAt: null });
const lookupRequest = { action: 'request_candidate_edition_options' as const,
  contractVersion: OWNER_UX_CONTRACT_VERSION, sessionId: idle.sessionId, candidateId: idle.candidateId,
  expectedRequestGeneration: 0, commandId: testUuid(10), idempotencyKey: 'lookup:conflict-path-0001' };
const slots = { claimSlot: () => 'slot', releaseSlot: jest.fn(), isCommandActive: () => false };
let client: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  let captureSequence = 100;
  jest.spyOn(Crypto, 'randomUUID').mockImplementation(() => testUuid(++captureSequence) as ReturnType<typeof Crypto.randomUUID>);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false, gcTime: 0 } } });
  resetImageInventoryIdentityForTests(pickerIdentity);
});
afterEach(async () => {
  await cleanupAsync();
  client.getMutationCache().getAll().forEach(m => m.destroy());
  client.clear();
  jest.restoreAllMocks();
});

it('E1 carries a SQL P9_STATE_CONFLICT through the gateway, envelope, parser and sheet refresh copy', async () => {
  const rpc = jest.fn().mockResolvedValue({
    data: null, error: { message: 'P9_STATE_CONFLICT: private SQL detail' },
  });
  const gatewayError = await executeOwnerEditionPicker({ rpc }, lookupRequest)
    .then(() => { throw new Error('expected gateway rejection'); }, error => error as Error);
  expect(gatewayError).toEqual(new Error('P9_STATE_CONFLICT'));
  expect(rpc).toHaveBeenCalledTimes(1);

  const response = ownerUxFailureResponse(gatewayError);
  expect(response.status).toBe(409);
  const envelope = await response.json() as { error: string; retryable: boolean; message: string };
  expect(envelope).toMatchObject({ error: 'P9_STATE_CONFLICT', retryable: true });
  expect(envelope.message).toBe('The item state changed. Refresh and try again.');

  expect(registeredOwnerUxError('P9_STATE_CONFLICT').message).toBe(expected);

  (supabase.functions.invoke as jest.Mock).mockImplementation(
    async (_name: string, options: { body: { action: string } }) => (
      options.body.action === 'read_candidate_edition_choices'
        ? { data: { contractVersion: OWNER_UX_CONTRACT_VERSION, data: idle }, error: null }
        : { data: null, error: { context: { json: async () => envelope } } }
    ),
  );

  const clientError = await ownerEditionPickerService.requestEditionOptions(
    lookupRequest, new AbortController().signal,
  ).then(() => { throw new Error('expected client rejection'); }, error => error as OwnerUxClientError);
  expect(clientError.code).toBe('P9_STATE_CONFLICT');
  expect(clientError.message).toBe(expected);
  expect(editionLookupRecovery(clientError)).toEqual({ kind: 'refresh', message: expected });

  const view = render(<QueryClientProvider client={client}><CandidateEditionPicker
    identity={pickerIdentity} sessionId={idle.sessionId} candidateId={idle.candidateId}
    commandSlot={slots} disabled={false} onSelection={jest.fn()}>{() => null}</CandidateEditionPicker></QueryClientProvider>);
  await waitFor(() => expect(view.getByRole('button', { name: 'Search Books' })).not.toBeDisabled());
  fireEvent.press(view.getByText('Search Books'));
  await waitFor(() => expect(view.getByText(expected)).toBeTruthy());
  expect(view.queryByText('Retry search')).toBeNull();
});
