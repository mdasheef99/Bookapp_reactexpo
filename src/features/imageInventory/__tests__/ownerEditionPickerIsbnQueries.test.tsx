jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import * as Crypto from 'expo-crypto';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { ownerUxService, OwnerUxClientError } from '../api/ownerUxService';
import { useOwnerEditionPicker } from '../queries/ownerEditionPickerQueries';
import { resetImageInventoryIdentityForTests, imageInventoryKeys } from '../queries/ownerUxQueries';
import { ownerBatchReviewKeys } from '../queries/ownerBatchReviewKeys';
import { CandidateCommandRegistry } from '../commit/inventoryCommitTypes';
import { deferred, pickerChoices, selectedChoices, pickerDetail, pickerIdentity, pickerReview } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('../api/ownerEditionPickerService', () => ({ ownerEditionPickerService: {
  readEditionChoices: jest.fn(), requestEditionOptions: jest.fn(), selectEdition: jest.fn(), setCandidateIsbn: jest.fn(),
} }));
const read = ownerEditionPickerService.readEditionChoices as jest.Mock;
const set = ownerEditionPickerService.setCandidateIsbn as jest.Mock;
const lookup = ownerEditionPickerService.requestEditionOptions as jest.Mock;
const initial = pickerChoices();
const canonical = () => pickerChoices({ ownerIsbn13: '9780140449136', candidateVersion: 6,
  metadataRevision: 9, reviewVersion: 1, requestGeneration: 3, rows: [], optionsExpiresAt: null, lookupStatus: 'idle' });
const receipt = { operationId: testUuid(40), status: 'pending', requestGeneration: 3, optionsVersion: 1, available: false };
const reviewSave = { review: pickerReview, expectedCandidateVersion: 4, expectedMetadataRevision: 7 };
let client: QueryClient;
let registry: CandidateCommandRegistry;
let save: jest.SpyInstance;
let invalidate: jest.SpyInstance;
let sequence: string[];
const onAuthority = jest.fn(), onIdentitySaved = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); sequence = [];
  read.mockReset(); set.mockReset(); lookup.mockReset();
  let captureSequence = 100;
  jest.spyOn(Crypto, 'randomUUID').mockImplementation(() => testUuid(++captureSequence) as ReturnType<typeof Crypto.randomUUID>);
  resetImageInventoryIdentityForTests(pickerIdentity);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  registry = new CandidateCommandRegistry();
  invalidate = jest.spyOn(client, 'invalidateQueries');
  read.mockImplementation(async () => { sequence.push('read'); return initial; });
  save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockImplementation(async () => {
    sequence.push('save'); return pickerDetail(selectedChoices({ candidateVersion: 5, reviewVersion: 1 }), pickerReview);
  });
  set.mockImplementation(async request => { sequence.push('set'); read.mockImplementation(async () => { sequence.push('read'); return canonical(); });
    return { sessionId: initial.sessionId, candidateId: initial.candidateId, candidateVersion: 6,
      metadataRevision: 9, requestGeneration: 99, ownerIsbn13: request.isbn13 }; });
  lookup.mockImplementation(async () => { sequence.push('lookup'); return receipt; });
});
afterEach(async () => { await cleanupAsync(); client.getMutationCache().getAll().forEach(m => m.destroy()); client.clear(); jest.restoreAllMocks(); });
function mount() {
  let slotSequence = 0;
  const slots = { claimSlot: (id: string, prefix: string) => { const token = prefix + ++slotSequence; return registry.claim(id, token) ? token : null; },
    releaseSlot: (id: string, token: string) => registry.release(id, token), isCommandActive: (id: string) => registry.isClaimed(id) };
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useOwnerEditionPicker(pickerIdentity, initial.sessionId, initial.candidateId, slots,
    { onAuthority, onIdentitySaved }), { wrapper });
}
async function ready(hook: ReturnType<typeof mount>) { await waitFor(() => expect(hook.result.current.choices.data).toBeDefined()); sequence = []; }
// Slice 5 SDD §8 / F16: save alone, set using its version, reread, exactly one request.
it.each(['9780140449136', null])('saves edits then sets %j and requests once from the reread generation', async isbn13 => {
  const hook = mount(); await ready(hook);
  await act(async () => hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13, reviewSave }));
  expect(sequence.slice(0, 4)).toEqual(['save', 'set', 'read', 'lookup']);
  expect(save).toHaveBeenCalledTimes(1); expect(set).toHaveBeenCalledTimes(1); expect(lookup).toHaveBeenCalledTimes(1);
  expect(set.mock.calls[0][0]).toMatchObject({ isbn13, expectedCandidateVersion: 5 });
  expect(lookup.mock.calls[0][0]).toMatchObject({ expectedRequestGeneration: 3 });
  expect(onIdentitySaved).toHaveBeenCalledTimes(1); expect(onAuthority).toHaveBeenCalledWith(canonical());
  for (const key of [imageInventoryKeys.candidate(pickerIdentity, initial.sessionId, initial.candidateId),
    ownerBatchReviewKeys.batchReview(pickerIdentity, initial.sessionId), ownerBatchReviewKeys.sessionV3(pickerIdentity, initial.sessionId),
    ownerBatchReviewKeys.readinessV3(pickerIdentity, initial.sessionId)]) expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
});
it('uses choices version and invalidates discovery and readiness when no review needs saving', async () => {
  const hook = mount(); await ready(hook);
  await act(async () => hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136' }));
  expect(save).not.toHaveBeenCalled(); expect(set.mock.calls[0][0].expectedCandidateVersion).toBe(4);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: imageInventoryKeys.discovery(pickerIdentity) });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: imageInventoryKeys.readiness(pickerIdentity, initial.sessionId) });
});
it('drops a lookup generation conflict, rereads and invalidates without automatically resending', async () => {
  lookup.mockImplementation(async () => {
    sequence.push('lookup'); throw new OwnerUxClientError('P9_VERSION_CONFLICT', true, 'generation changed');
  });
  const hook = mount(); await ready(hook);
  await act(async () => expect(hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136' })).rejects.toThrow('generation changed'));
  await act(async () => expect(hook.result.current.retryIsbnSearch()).rejects.toThrow('AUTHORITY_CHANGED'));
  expect(sequence).toEqual(['set', 'read', 'lookup', 'read']);
  expect(onAuthority).toHaveBeenCalledWith(canonical());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: imageInventoryKeys.candidate(pickerIdentity, initial.sessionId, initial.candidateId) });
  expect(set).toHaveBeenCalledTimes(1); expect(lookup).toHaveBeenCalledTimes(1);
});
it('resumes uncertain set using the same keys and saved response version without repeating save', async () => {
  const implementation = set.getMockImplementation()!;
  set.mockRejectedValueOnce(new Error('network')).mockImplementationOnce(implementation);
  const hook = mount(); await ready(hook);
  await act(async () => expect(hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136', reviewSave })).rejects.toThrow('network'));
  await act(async () => hook.result.current.retryIsbnSearch());
  expect(save).toHaveBeenCalledTimes(1); expect(set.mock.calls[1][0]).toEqual(set.mock.calls[0][0]);
  expect(set.mock.calls[1][0].expectedCandidateVersion).toBe(5); expect(lookup).toHaveBeenCalledTimes(1);
});
it('resumes uncertain save with its same command identity before set', async () => {
  const implementation = save.getMockImplementation()!;
  save.mockRejectedValueOnce(new Error('save network')).mockImplementationOnce(implementation);
  const hook = mount(); await ready(hook);
  await act(async () => expect(hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136', reviewSave })).rejects.toThrow('save network'));
  expect(set).not.toHaveBeenCalled();
  await act(async () => hook.result.current.retryIsbnSearch());
  expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]); expect(set).toHaveBeenCalledTimes(1);
});
it('resends the same lookup command after its failure without resending a finished save or set', async () => {
  lookup.mockRejectedValueOnce(new Error('lookup network')).mockResolvedValueOnce(receipt);
  const hook = mount(); await ready(hook);
  await act(async () => expect(hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136', reviewSave })).rejects.toThrow('lookup network'));
  await act(async () => hook.result.current.retryIsbnSearch());
  expect(save).toHaveBeenCalledTimes(1); expect(set).toHaveBeenCalledTimes(1);
  expect(lookup.mock.calls[1][0]).toEqual(lookup.mock.calls[0][0]);
});
it.each(['authority', 'identity'])('returns a rejected promise when %s changes before Retry', async changed => {
  set.mockRejectedValueOnce(new Error('network'));
  const hook = mount(); await ready(hook);
  await act(async () => expect(hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136' })).rejects.toThrow('network'));
  if (changed === 'authority') client.setQueryData(imageInventoryKeys.candidate(pickerIdentity, initial.sessionId, initial.candidateId),
    { ...pickerDetail(), candidateState: 'committed' });
  else resetImageInventoryIdentityForTests({ userId: 'owner-b', storeId: 'store-b' });
  let retry!: Promise<unknown>;
  expect(() => { retry = hook.result.current.retryIsbnSearch(); }).not.toThrow();
  await expect(retry).rejects.toThrow(changed === 'authority' ? 'OWNER_CANDIDATE_AUTHORITY_CHANGED' : 'OWNER_IDENTITY_CHANGED');
  expect(set).toHaveBeenCalledTimes(1); expect(lookup).not.toHaveBeenCalled();
});
it.each(['P9_REQUEST_INVALID', 'P9_STATE_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH'] as const)
('drops a refused %s record, rereads authority, invalidates and never retries it', async code => {
  set.mockRejectedValue(new OwnerUxClientError(code, false, 'refused'));
  const hook = mount(); await ready(hook);
  await act(async () => expect(hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136' })).rejects.toThrow('refused'));
  await act(async () => expect(hook.result.current.retryIsbnSearch()).rejects.toThrow('AUTHORITY_CHANGED'));
  expect(set).toHaveBeenCalledTimes(1); expect(lookup).not.toHaveBeenCalled(); expect(onAuthority).toHaveBeenCalled();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: imageInventoryKeys.candidate(pickerIdentity, initial.sessionId, initial.candidateId) });
});
it('claims the card command slot and exposes ISBN pending until the workflow ends', async () => {
  const pending = deferred<unknown>(); set.mockReturnValue(pending.promise);
  const hook = mount(); await ready(hook); let work!: Promise<unknown>;
  act(() => { work = hook.result.current.setIsbnAndSearch.mutateAsync({ isbn13: '9780140449136' }); });
  await waitFor(() => expect(hook.result.current.isbnPending).toBe(true));
  expect(registry.isClaimed(initial.candidateId)).toBe(true);
  await act(async () => { pending.resolve({}); await work; });
  expect(registry.isClaimed(initial.candidateId)).toBe(false);
});
