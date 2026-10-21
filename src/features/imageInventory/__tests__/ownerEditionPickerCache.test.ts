jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { assertBatchAuthority } from '../queries/ownerCandidateAuthority';
import { QueryClient } from '@tanstack/react-query';
import { acceptEditionChoices, acceptEditionLookupReceipt } from '../queries/ownerEditionPickerCache';
import { ownerEditionPickerKeys } from '../queries/ownerEditionPickerKeys';
import { ownerBatchReviewKeys } from '../queries/ownerBatchReviewKeys';
import { synchronizeCandidateReviewSuccess } from '../queries/ownerUxReviewQueries';
import { synchronizeInventoryCommitSuccess } from '../queries/ownerInventoryCommitQueries';
import { synchronizeRemoveCandidateSuccess } from '../queries/ownerBatchReviewQueries';
import { imageInventoryKeys, resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { pickerChoices, selectedChoices, pickerIdentity, pickerDetail, pickerReview, pickerCard } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

let client: QueryClient;
const request = { sessionId: testUuid(1), candidateId: testUuid(2) };
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: 0 } } }); resetImageInventoryIdentityForTests(pickerIdentity); });
afterEach(() => client.clear());
it.each([
  { candidateVersion: 4 }, { metadataRevision: 7 }, { reviewVersion: null },
  { requestGeneration: 1 }, { optionsVersion: 1 },
])('rejects a read regressing corresponding authority %j', (older) => {
  const latest = selectedChoices({ candidateVersion: 8, metadataRevision: 10,
    reviewVersion: 3, requestGeneration: 2, optionsVersion: 2 });
  acceptEditionChoices(client, pickerIdentity, request, latest, 'read');
  expect(acceptEditionChoices(client, pickerIdentity, request, { ...latest, ...older }, 'read')).toEqual(latest);
});
it('slim selection replay cannot replace current alternatives, then a current read can clear them', () => {
  const before = pickerChoices();
  acceptEditionChoices(client, pickerIdentity, request, before, 'read');
  const slim = selectedChoices({ rows: [], optionsExpiresAt: null });
  expect(acceptEditionChoices(client, pickerIdentity, request, slim, 'selection')).toMatchObject({
    selection: slim.selection, rows: before.rows, optionsExpiresAt: before.optionsExpiresAt,
  });
  expect(acceptEditionChoices(client, pickerIdentity, request, slim, 'read').rows).toEqual([]);
});
it('old selection replay throws instead of invoking draft adoption with newer authority', () => {
  acceptEditionChoices(client, pickerIdentity, request, selectedChoices({ candidateVersion: 8, metadataRevision: 10 }), 'read');
  expect(() => acceptEditionChoices(client, pickerIdentity, request, selectedChoices(), 'selection')).toThrow('AUTHORITY_CHANGED');
});
it('older lookup receipt and pending receipt after ready cannot regress lookup counters or state', () => {
  const ready = { operationId: testUuid(40), status: 'ready' as const,
    requestGeneration: 2, optionsVersion: 3, available: true };
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, ready)).toBe(true);
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, { ...ready, status: 'pending', available: false })).toBe(false);
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, { ...ready, requestGeneration: 1 })).toBe(false);
  expect(client.getQueryData(ownerEditionPickerKeys.lookup(pickerIdentity, request.sessionId, request.candidateId))).toEqual(ready);
});
it('lookup receipts never replace selection, review authority or rows', () => {
  const choices = selectedChoices();
  acceptEditionChoices(client, pickerIdentity, request, choices, 'read');
  acceptEditionLookupReceipt(client, pickerIdentity, request, { operationId: testUuid(40),
    status: 'pending', requestGeneration: 2, optionsVersion: 1, available: false });
  expect(client.getQueryData(ownerEditionPickerKeys.choices(pickerIdentity, request.sessionId, request.candidateId))).toEqual(choices);
});
it('older Save success cannot overwrite a newer confirmed selection or review cache', async () => {
  const latest = selectedChoices({ candidateVersion: 8, metadataRevision: 10, reviewVersion: 3 });
  acceptEditionChoices(client, pickerIdentity, request, latest, 'read');
  client.setQueryData(imageInventoryKeys.candidate(pickerIdentity, request.sessionId, request.candidateId), pickerDetail(latest, pickerReview));
  await synchronizeCandidateReviewSuccess(client, pickerIdentity, request.sessionId, request.candidateId,
    pickerDetail(selectedChoices({ reviewVersion: 1 }), pickerReview));
  expect(client.getQueryData(imageInventoryKeys.candidate(pickerIdentity, request.sessionId, request.candidateId)))
    .toMatchObject({ candidateVersion: 8, metadata: { revision: 10 }, review: { reviewVersion: 3 } });
});
it('expiry drops alternatives without losing independent selection or issuing a lookup', () => {
  const expired = selectedChoices({ optionsExpiresAt: '2000-01-01T00:00:00.000Z' });
  expect(acceptEditionChoices(client, pickerIdentity, request, expired, 'read')).toMatchObject({
    rows: [], optionsExpiresAt: null, selection: expired.selection, reviewVersion: null,
  });
});
it.each(['committed', 'removed'] as const)('confirmed %s prevents late choices from reappearing and clears only that card', async (reason) => {
  const other = pickerChoices({ candidateId: testUuid(3) });
  acceptEditionChoices(client, pickerIdentity, request, selectedChoices(), 'read');
  acceptEditionChoices(client, pickerIdentity, { ...request, candidateId: other.candidateId }, other, 'read');
  if (reason === 'committed') {
    await synchronizeInventoryCommitSuccess(client, pickerIdentity, request.sessionId, [{
      ...request, candidateVersion: 6, inventoryId: testUuid(90), inventoryVersion: 1, outcome: 'committed_private',
    }]);
  } else {
    await synchronizeRemoveCandidateSuccess(client, pickerIdentity, request.sessionId, {
      ...request, candidateVersion: 6, sessionVersion: 2, presentationRevision: 2,
      reviewDisposition: 'owner_removed_from_scan', removedAt: '2026-10-08T00:00:00.000Z',
    });
  }
  expect(client.getQueryData(ownerEditionPickerKeys.choices(pickerIdentity, request.sessionId, request.candidateId))).toBeUndefined();
  expect(() => acceptEditionChoices(client, pickerIdentity, request, selectedChoices(), 'read')).toThrow('AUTHORITY_CHANGED');
  expect(client.getQueryData(ownerEditionPickerKeys.choices(pickerIdentity, request.sessionId, other.candidateId))).toEqual(other);
});
it('a read with unchanged metadata revision cannot erase the accepted selection', () => {
  const latest = selectedChoices();
  acceptEditionChoices(client, pickerIdentity, request, latest, 'read');
  expect(acceptEditionChoices(client, pickerIdentity, request, { ...latest, selection: null }, 'read')).toEqual(latest);
});
it('a newer batch review card prevents an older Save success from regressing detail or selection', async () => {
  client.setQueryData(ownerBatchReviewKeys.batchReview(pickerIdentity, request.sessionId), {
    items: [pickerCard(selectedChoices({ candidateVersion: 12, reviewVersion: 1 }), pickerReview)],
  });
  await synchronizeCandidateReviewSuccess(client, pickerIdentity, request.sessionId, request.candidateId,
    pickerDetail(selectedChoices({ reviewVersion: 1 }), pickerReview));
  expect(client.getQueryData(imageInventoryKeys.candidate(pickerIdentity, request.sessionId, request.candidateId))).toBeUndefined();
});
it('older batch cards cannot restore pre-selection summary authority', () => {
  acceptEditionChoices(client, pickerIdentity, request, selectedChoices({ candidateVersion: 12 }), 'read');
  const page = { items: [{ ...request, candidateVersion: 4 }] } as never;
  expect(() => assertBatchAuthority(client, pickerIdentity, page)).toThrow('AUTHORITY_CHANGED');
});

it('a pending read cannot regress a terminal lookup for the same generation and options version', () => {
  const ready = selectedChoices({ lookupStatus: 'ready' });
  acceptEditionChoices(client, pickerIdentity, request, ready, 'read');
  expect(acceptEditionChoices(client, pickerIdentity, request, { ...ready, lookupStatus: 'pending' }, 'read')).toEqual(ready);
});
it('an old pending receipt cannot regress choices already read as ready for the same counters', () => {
  acceptEditionChoices(client, pickerIdentity, request, selectedChoices({ lookupStatus: 'ready' }), 'read');
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, {
    operationId: testUuid(40), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: false,
  })).toBe(false);
});
