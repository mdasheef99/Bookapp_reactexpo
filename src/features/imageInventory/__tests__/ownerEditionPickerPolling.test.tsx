jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { useOwnerEditionChoices } from '../queries/ownerEditionPickerQueries';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { pickerChoices, pickerIdentity } from '../testing/editionPickerClientFixtures';

jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
const lookup = ownerEditionPickerService.requestEditionOptions as jest.Mock;
const scope = pickerChoices();
let client: QueryClient;
let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false, gcTime: 0 } } });
  wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  resetImageInventoryIdentityForTests(pickerIdentity);
});
afterEach(async () => {
  await act(async () => { await client.cancelQueries(); });
  await cleanupAsync();
  client.getMutationCache().getAll().forEach(m => m.destroy());
  client.clear();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const mount = () => renderHook(
  () => useOwnerEditionChoices(pickerIdentity, scope.sessionId, scope.candidateId), { wrapper },
);

// 02d Unit 2 §3 (D5): 3 s pending polling is choices-only and stops at every terminal status.
it('P1 polls every 3 seconds while pending using choices reads only', async () => {
  read.mockResolvedValue(pickerChoices({ lookupStatus: 'pending', rows: [], optionsExpiresAt: null }));
  const hook = mount();
  await waitFor(() => expect(hook.result.current.data?.lookupStatus).toBe('pending'));
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(3100); });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await act(async () => { jest.advanceTimersByTime(3100); });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
  expect(lookup).not.toHaveBeenCalled();
});
it.each(['ready', 'failed', 'idle'] as const)('P2 stops polling when a poll returns %s', async status => {
  const pending = pickerChoices({ lookupStatus: 'pending', rows: [], optionsExpiresAt: null });
  const terminal = status === 'idle'
    ? pickerChoices({ lookupStatus: status, rows: [], optionsExpiresAt: null, requestGeneration: 2 })
    : pickerChoices({ lookupStatus: status });
  read.mockResolvedValueOnce(pending).mockResolvedValue(terminal);
  const hook = mount();
  await waitFor(() => expect(hook.result.current.data?.lookupStatus).toBe('pending'));
  await act(async () => { jest.advanceTimersByTime(3100); });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(hook.result.current.data?.lookupStatus).toBe(status));
  const calls = read.mock.calls.length;
  await act(async () => { jest.advanceTimersByTime(3100); });
  await act(async () => { jest.advanceTimersByTime(3100); });
  expect(read.mock.calls.length).toBe(calls);
  expect(lookup).not.toHaveBeenCalled();
});
