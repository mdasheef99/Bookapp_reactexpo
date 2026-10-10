jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { useOwnerEditionPicker } from '../queries/ownerEditionPickerQueries';
import { ownerEditionPickerKeys } from '../queries/ownerEditionPickerKeys';
import { coordinateImageInventoryIdentity, resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { CandidateCommandRegistry } from '../commit/inventoryCommitTypes';
import { pickerChoices, selectedChoices, pickerIdentity, deferred } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';
import { OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';
import { OwnerUxClientError } from '../api/ownerUxService';

jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(),
} }));
const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
const select = ownerEditionPickerService.selectEdition as jest.Mock;
const lookup = ownerEditionPickerService.requestEditionOptions as jest.Mock;
const request = { action: 'select_candidate_edition' as const, contractVersion: OWNER_UX_CONTRACT_VERSION,
  sessionId: testUuid(1), candidateId: testUuid(2), expectedCandidateVersion: 4,
  expectedMetadataRevision: 7, expectedReviewVersion: null, source: 'edition_option' as const,
  optionId: testUuid(20), optionsVersion: 1, commandId: testUuid(9), idempotencyKey: 'select:stable-command-0001' };
let client: QueryClient;
let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;
let registry: CandidateCommandRegistry;
let slots: { claimSlot: (id: string, prefix: string) => string | null;
  releaseSlot: (id: string, token: string) => void; isCommandActive: (id: string) => boolean };
beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue(pickerChoices());
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  registry = new CandidateCommandRegistry();
  let seq = 0;
  slots = { claimSlot: (id, prefix) => { const token = prefix + ++seq; return registry.claim(id, token) ? token : null; },
    releaseSlot: (id, token) => registry.release(id, token), isCommandActive: id => registry.isClaimed(id) };
  resetImageInventoryIdentityForTests(pickerIdentity);
});
afterEach(async () => { await cleanupAsync(); client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear(); });
function mount(callbacks = {}) {
  return renderHook(() => useOwnerEditionPicker(pickerIdentity, request.sessionId, request.candidateId, slots, callbacks), { wrapper });
}
it('mount reads choices but never automatically acquires options, including fresh empty', async () => {
  read.mockResolvedValue(pickerChoices({ rows: [] }));
  const hook = mount();
  await waitFor(() => expect(hook.result.current.choices.data?.rows).toEqual([]));
  expect(lookup).not.toHaveBeenCalled();
});
it('claims the existing card slot before selection and exposes pending state; callback receives authority', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  select.mockReturnValue(pending.promise);
  const callback = jest.fn();
  const hook = mount({ onSelection: callback });
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  let result!: Promise<unknown>;
  act(() => { result = hook.result.current.selectEdition.mutateAsync(request); });
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
  expect(registry.isClaimed(request.candidateId)).toBe(true);
  expect(registry.claim(request.candidateId, 'add')).toBe(false);
  await waitFor(() => expect(hook.result.current.selectionPending).toBe(true));
  read.mockResolvedValue(selectedChoices());
  await act(async () => { pending.resolve(selectedChoices()); await result; });
  expect(callback).toHaveBeenCalledWith(selectedChoices(), 7);
  expect(registry.isClaimed(request.candidateId)).toBe(false);
});
it('selection cannot interleave with a Save/Add claim on the same coordinator', async () => {
  registry.claim(request.candidateId, 'save-add');
  const hook = mount();
  await act(async () => expect(hook.result.current.selectEdition.mutateAsync(request)).rejects.toThrow('BUSY'));
  expect(select).not.toHaveBeenCalled();
});
it.each([
  ['logout', null], ['account', { userId: 'owner-b', storeId: 'store-a' }],
  ['store', { userId: 'owner-a', storeId: 'store-b' }],
] as const)('rejects transport ignoring abort after %s change', async (_name, identity) => {
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  select.mockReturnValue(pending.promise);
  const callback = jest.fn();
  const hook = mount({ onSelection: callback });
  let result!: Promise<unknown>;
  act(() => { result = hook.result.current.selectEdition.mutateAsync(request); });
  const rejection = expect(result).rejects.toThrow('IDENTITY_CHANGED');
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
  await act(async () => coordinateImageInventoryIdentity(identity, client));
  expect(select.mock.calls[0][1].aborted).toBe(true);
  await act(async () => pending.resolve(selectedChoices()));
  await rejection;
  expect(callback).not.toHaveBeenCalled();
  expect(registry.isClaimed(request.candidateId)).toBe(false);
  expect(client.getQueriesData({ queryKey: ['phase9', 'ownerInventory'] }).every(([, value]) => value === undefined)).toBe(true);
});
it.each([
  [testUuid(3), testUuid(2)], [testUuid(1), testUuid(3)],
])('rejects a late selection on session/card change and releases its lifecycle slot', async (sessionId, candidateId) => {
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  select.mockReturnValue(pending.promise);
  const callback = jest.fn();
  const hook = renderHook<ReturnType<typeof useOwnerEditionPicker>, { session: string; candidate: string }>(({ session, candidate }) => useOwnerEditionPicker(
    pickerIdentity, session, candidate, slots, { onSelection: callback }),
    { initialProps: { session: request.sessionId, candidate: request.candidateId }, wrapper });
  let result!: Promise<unknown>;
  act(() => { result = hook.result.current.selectEdition.mutateAsync(request); });
  const rejection = expect(result).rejects.toThrow('AUTHORITY_CHANGED');
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
  hook.rerender({ session: sessionId, candidate: candidateId });
  expect(registry.isClaimed(request.candidateId)).toBe(false);
  await act(async () => pending.resolve(selectedChoices()));
  await rejection;
  expect(callback).not.toHaveBeenCalled();
});
it('uncertain selection retry keeps the frozen request, rereads authority, and retains latest selling callback edits', async () => {
  let latestPrice = 100;
  let adoptedPrice = -1;
  select.mockRejectedValueOnce(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'safe'))
    .mockResolvedValueOnce(selectedChoices());
  const hook = mount({ onSelection: () => { adoptedPrice = latestPrice; } });
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  await act(async () => expect(hook.result.current.selectEdition.mutateAsync(request)).rejects.toThrow('safe'));
  latestPrice = 0;
  read.mockResolvedValue(selectedChoices());
  await act(async () => hook.result.current.retrySelection());
  expect(select.mock.calls[0][0]).toEqual(select.mock.calls[1][0]);
  expect(adoptedPrice).toBe(0);
});
it('conflict rereads current authority without calling selection adoption', async () => {
  select.mockRejectedValue(new OwnerUxClientError('P9_VERSION_CONFLICT', true, 'refresh'));
  const onSelection = jest.fn();
  const hook = mount({ onSelection });
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  read.mockResolvedValue(selectedChoices({ candidateVersion: 8, metadataRevision: 10 }));
  await act(async () => expect(hook.result.current.selectEdition.mutateAsync(request)).rejects.toThrow('refresh'));
  expect(read.mock.calls.length).toBeGreaterThan(1);
  expect(onSelection).not.toHaveBeenCalled();
  expect(client.getQueryData(ownerEditionPickerKeys.choices(pickerIdentity, request.sessionId, request.candidateId)))
    .toMatchObject({ metadataRevision: 10 });
});
it('an older selection/replay does not regress cache or reapply a draft', async () => {
  const latest = selectedChoices({ candidateVersion: 8, metadataRevision: 10 });
  read.mockResolvedValue(latest);
  select.mockResolvedValue(selectedChoices({ rows: [], optionsExpiresAt: null }));
  const onSelection = jest.fn();
  const hook = mount({ onSelection });
  await waitFor(() => expect(hook.result.current.choices.data).toEqual(latest));
  await act(async () => expect(hook.result.current.selectEdition.mutateAsync(request)).rejects.toThrow('AUTHORITY_CHANGED'));
  expect(onSelection).not.toHaveBeenCalled();
  expect(hook.result.current.choices.data).toEqual(latest);
});
it('unmount releases the selection slot before an abort-ignoring transport settles', async () => {
  const pending = deferred<ReturnType<typeof selectedChoices>>();
  select.mockReturnValue(pending.promise);
  const hook = mount();
  let result!: Promise<unknown>;
  act(() => { result = hook.result.current.selectEdition.mutateAsync(request); });
  const rejection = expect(result).rejects.toThrow('AUTHORITY_CHANGED');
  await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
  hook.unmount();
  expect(registry.isClaimed(request.candidateId)).toBe(false);
  await act(async () => pending.resolve(selectedChoices()));
  await rejection;
});
it('a delayed read cannot overwrite a selection accepted while that read was pending', async () => {
  const old = deferred<ReturnType<typeof pickerChoices>>();
  read.mockReturnValueOnce(old.promise).mockResolvedValue(selectedChoices());
  select.mockResolvedValue(selectedChoices());
  const hook = mount();
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  await act(async () => hook.result.current.selectEdition.mutateAsync(request));
  await act(async () => { old.resolve(pickerChoices()); await Promise.resolve(); });
  expect(hook.result.current.choices.data).toMatchObject({ metadataRevision: 8, selection: selectedChoices().selection });
});
it('a replayed lookup returns the newer accepted receipt rather than regressing mutation state', async () => {
  const latest = { operationId: testUuid(42), status: 'ready' as const,
    requestGeneration: 3, optionsVersion: 3, available: true };
  read.mockResolvedValue(selectedChoices({ requestGeneration: 3, optionsVersion: 3 }));
  lookup.mockResolvedValue({ ...latest, operationId: testUuid(40), requestGeneration: 1, optionsVersion: 1, status: 'pending' });
  client.setQueryData(ownerEditionPickerKeys.lookup(pickerIdentity, request.sessionId, request.candidateId), latest);
  const hook = mount();
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  await act(async () => expect(hook.result.current.requestOptions.mutateAsync({
    action: 'request_candidate_edition_options', contractVersion: OWNER_UX_CONTRACT_VERSION,
    sessionId: request.sessionId, candidateId: request.candidateId, expectedRequestGeneration: 1,
    commandId: testUuid(10), idempotencyKey: 'lookup:stable-command-0001',
  })).resolves.toEqual(latest));
});
it('explicit current-suggestion confirmation adopts the server-held choice without manufacturing a review', async () => {
  const current = selectedChoices({ selection: { ...selectedChoices().selection!,
    source: 'current_suggestion', optionId: null } as never, reviewVersion: null });
  select.mockResolvedValue(current);
  read.mockResolvedValue(current);
  const onSelection = jest.fn();
  const hook = mount({ onSelection });
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  await act(async () => hook.result.current.selectEdition.mutateAsync({
    action: 'select_candidate_edition', contractVersion: OWNER_UX_CONTRACT_VERSION,
    sessionId: request.sessionId, candidateId: request.candidateId, expectedCandidateVersion: 4,
    expectedMetadataRevision: 7, expectedReviewVersion: null, source: 'current_suggestion',
    selectionId: testUuid(31), commandId: testUuid(10), idempotencyKey: 'confirm:stable-command-0001',
  }));
  expect(onSelection).toHaveBeenCalledWith(current, 7);
  expect(hook.result.current.choices.data?.reviewVersion).toBeNull();
});
it('expired choices remain readable but never enqueue alternatives on expiry or reopen', async () => {
  read.mockResolvedValue(selectedChoices({ optionsExpiresAt: '2000-01-01T00:00:00.000Z' }));
  const first = mount();
  await waitFor(() => expect(first.result.current.choices.data?.rows).toEqual([]));
  first.unmount();
  const resumed = mount();
  await waitFor(() => expect(resumed.result.current.choices.data?.selection).toBeDefined());
  expect(lookup).not.toHaveBeenCalled();
});
it('repeated taps during one lookup share the original command and exact retry identity', async () => {
  const pending = deferred<{ operationId: string; status: 'ready'; requestGeneration: number; optionsVersion: number; available: boolean }>();
  lookup.mockReturnValue(pending.promise);
  const hook = mount();
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  const command = { action: 'request_candidate_edition_options' as const, contractVersion: OWNER_UX_CONTRACT_VERSION,
    sessionId: request.sessionId, candidateId: request.candidateId, expectedRequestGeneration: 1,
    commandId: testUuid(10), idempotencyKey: 'lookup:original-command-0001' };
  let first!: Promise<unknown>; let second!: Promise<unknown>;
  act(() => {
    first = hook.result.current.requestOptions.mutateAsync(command);
    second = hook.result.current.requestOptions.mutateAsync({ ...command, commandId: testUuid(11), idempotencyKey: 'lookup:second-command-0001' });
  });
  await waitFor(() => expect(lookup).toHaveBeenCalled());
  await act(async () => {
    pending.resolve({ operationId: testUuid(40), status: 'ready', requestGeneration: 1, optionsVersion: 1, available: true });
    await Promise.all([first, second]);
  });
  expect(lookup).toHaveBeenCalledTimes(1);
  await act(async () => hook.result.current.retryLookup());
  expect(lookup.mock.calls[1][0]).toEqual(command);
});

it('a new authenticated identity cannot retry the previous identity command even on the same card', async () => {
  read.mockResolvedValue(selectedChoices());
  select.mockResolvedValue(selectedChoices());
  const hook = renderHook(({ identity }: { identity: typeof pickerIdentity }) => useOwnerEditionPicker(identity, request.sessionId, request.candidateId, slots),
    { wrapper, initialProps: { identity: pickerIdentity } });
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  await act(async () => hook.result.current.selectEdition.mutateAsync(request));
  const next = { ...pickerIdentity, userId: 'owner-b' };
  await act(async () => coordinateImageInventoryIdentity(next, client));
  hook.rerender({ identity: next });
  await act(async () => expect(hook.result.current.retrySelection()).rejects.toThrow('AUTHORITY_CHANGED'));
  expect(select).toHaveBeenCalledTimes(1);
});
it('does not adopt a replay when current server confirmation is false, even if reread fails', async () => {
  const historical = selectedChoices({ selection: { ...selectedChoices().selection!, confirmedByOwner: false } });
  select.mockResolvedValue(historical);
  const onSelection = jest.fn(), hook = mount({ onSelection });
  await waitFor(() => expect(hook.result.current.choices.data).toBeDefined());
  read.mockRejectedValue(new OwnerUxClientError('P9_INTERNAL_ERROR', false, 'Unavailable'));
  await act(async () => expect(hook.result.current.selectEdition.mutateAsync(request)).rejects.toThrow('AUTHORITY_CHANGED'));
  expect(onSelection).not.toHaveBeenCalled();
  expect(registry.isClaimed(request.candidateId)).toBe(false);
});
