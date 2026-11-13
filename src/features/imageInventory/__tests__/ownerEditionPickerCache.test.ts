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
it('lookup receipts clear rows for a pending receipt but never replace selection or review authority', () => {
  const choices = selectedChoices();
  acceptEditionChoices(client, pickerIdentity, request, choices, 'read');
  acceptEditionLookupReceipt(client, pickerIdentity, request, { operationId: testUuid(40),
    status: 'pending', requestGeneration: 2, optionsVersion: 1, available: false });
  expect(client.getQueryData(ownerEditionPickerKeys.choices(pickerIdentity, request.sessionId, request.candidateId)))
    .toEqual({ ...choices, lookupStatus: 'pending', requestGeneration: 2, rows: [], optionsExpiresAt: null });
});
it('reflects a pending receipt immediately and keeps it through a later idle read for the same request', () => {
  const choices = pickerChoices({ lookupStatus: 'idle', optionsExpiresAt: null, rows: [] });
  const key = ownerEditionPickerKeys.choices(pickerIdentity, request.sessionId, request.candidateId);
  acceptEditionChoices(client, pickerIdentity, request, choices, 'read');
  const pending = { operationId: testUuid(40), status: 'pending' as const,
    requestGeneration: 2, optionsVersion: 1, available: false };
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, pending)).toBe(true);
  expect(client.getQueryData(key)).toMatchObject({ ...request, lookupStatus: 'pending', requestGeneration: 2 });
  expect(client.getQueryData(ownerEditionPickerKeys.lookup(pickerIdentity, request.sessionId, request.candidateId)))
    .toEqual(pending);
  expect(acceptEditionChoices(client, pickerIdentity, request,
    { ...choices, requestGeneration: 2 }, 'read')).toMatchObject({ lookupStatus: 'pending', requestGeneration: 2 });
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

// SDD-1 section 5/AC3-1: a confirmed commit allows only a current committed read.
it.each(['ready', 'committed', 'older committed'])('fences a receipt-backed batch read: %s', async state => {
  await synchronizeInventoryCommitSuccess(client, pickerIdentity, request.sessionId, [{
    ...request, candidateVersion: 6, inventoryId: testUuid(90), inventoryVersion: 1, outcome: 'committed_private',
  }]);
  const card = pickerCard(selectedChoices({ candidateVersion: state === 'older committed' ? 5 : 6 }));
  const page = { items: [{ ...card, candidateState: state === 'ready' ? 'ready' : 'committed' }] } as never;
  if (state === 'committed') expect(assertBatchAuthority(client, pickerIdentity, page)).toBe(page);
  else expect(() => assertBatchAuthority(client, pickerIdentity, page)).toThrow('AUTHORITY_CHANGED');
});

// 02d Unit 2 §3: pending acceptance, idle acceptance/finality, selection bounds, terminal usability.
const choicesKey = () => ownerEditionPickerKeys.choices(pickerIdentity, request.sessionId, request.candidateId);
const lookupKey = () => ownerEditionPickerKeys.lookup(pickerIdentity, request.sessionId, request.candidateId);
const pendingReceipt = (overrides: Partial<{ operationId: string; requestGeneration: number; optionsVersion: number; available: boolean }> = {}) => ({
  operationId: testUuid(40), status: 'pending' as const, requestGeneration: 1, optionsVersion: 2, available: false, ...overrides,
});
it('C1 accepts a pending receipt by clearing rows and expiry while keeping the selection', () => {
  const before = selectedChoices();
  acceptEditionChoices(client, pickerIdentity, request, before, 'read');
  const receipt = pendingReceipt();
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, receipt)).toBe(true);
  expect(client.getQueryData(choicesKey())).toEqual({
    ...before, lookupStatus: 'pending', requestGeneration: 1, optionsVersion: 2, rows: [], optionsExpiresAt: null,
  });
  expect(client.getQueryData(lookupKey())).toEqual(receipt);
});
it.each(['empty', 'older'] as const)('C2 ACP-3 pending acceptance with an %s receipt cache', mode => {
  const before = pickerChoices();
  acceptEditionChoices(client, pickerIdentity, request, before, 'read');
  if (mode === 'older') client.setQueryData(lookupKey(), pendingReceipt({ optionsVersion: 1 }));
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, pendingReceipt())).toBe(true);
  expect(client.getQueryData<{ rows: unknown[]; optionsExpiresAt: string | null }>(choicesKey())).toMatchObject({
    rows: [], optionsExpiresAt: null, lookupStatus: 'pending', optionsVersion: 2,
  });
});
it('C2 ACP-3 rejects a pending receipt newer than the cached receipt and keeps rows', () => {
  const before = pickerChoices();
  acceptEditionChoices(client, pickerIdentity, request, before, 'read');
  client.setQueryData(lookupKey(), {
    operationId: testUuid(41), status: 'ready', requestGeneration: 1, optionsVersion: 3, available: true,
  });
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, pendingReceipt())).toBe(false);
  expect(client.getQueryData<{ rows: unknown[]; optionsExpiresAt: string | null }>(choicesKey())).toMatchObject({
    rows: before.rows, optionsExpiresAt: before.optionsExpiresAt,
  });
});
it('C3 accepts an idle read over a saved ready list at the same counters', () => {
  const before = pickerChoices();
  acceptEditionChoices(client, pickerIdentity, request, before, 'read');
  const idle = { ...before, lookupStatus: 'idle' as const, rows: [], optionsExpiresAt: null };
  expect(acceptEditionChoices(client, pickerIdentity, request, idle, 'read')).toMatchObject({
    lookupStatus: 'idle', rows: [], optionsExpiresAt: null, selection: before.selection,
  });
});
it('C4 accepts an idle read even when a same-counter READY receipt is cached', () => {
  const before = pickerChoices();
  acceptEditionChoices(client, pickerIdentity, request, before, 'read');
  expect(acceptEditionLookupReceipt(client, pickerIdentity, request, {
    operationId: testUuid(40), status: 'ready', requestGeneration: 1, optionsVersion: 1, available: true,
  })).toBe(true);
  const idle = { ...before, lookupStatus: 'idle' as const, rows: [], optionsExpiresAt: null };
  expect(acceptEditionChoices(client, pickerIdentity, request, idle, 'read')).toMatchObject({
    lookupStatus: 'idle', rows: [], optionsExpiresAt: null,
  });
});
it('C5 rejects an idle read over pending choices at the same counters', () => {
  const pending = pickerChoices({ lookupStatus: 'pending', rows: [], optionsExpiresAt: null });
  acceptEditionChoices(client, pickerIdentity, request, pending, 'read');
  client.setQueryData(lookupKey(), pendingReceipt({ optionsVersion: 1 }));
  expect(acceptEditionChoices(client, pickerIdentity, request,
    { ...pending, lookupStatus: 'idle', rows: [], optionsExpiresAt: null }, 'read')).toMatchObject({
    lookupStatus: 'pending', requestGeneration: 1, optionsVersion: 1,
  });
});
it('C6 keeps the existing pending and terminal transitions', () => {
  const ready = selectedChoices({ lookupStatus: 'ready' });
  acceptEditionChoices(client, pickerIdentity, request, ready, 'read');
  expect(acceptEditionChoices(client, pickerIdentity, request, { ...ready, lookupStatus: 'pending' }, 'read')).toEqual(ready);

  const pending = selectedChoices({ lookupStatus: 'pending', rows: [], optionsExpiresAt: null, requestGeneration: 2 });
  acceptEditionChoices(client, pickerIdentity, request, pending, 'read');
  expect(acceptEditionChoices(client, pickerIdentity, request, { ...pending, lookupStatus: 'failed' }, 'read')).toMatchObject({
    lookupStatus: 'failed', rows: [], selection: pending.selection,
  });

  const pendingReady = selectedChoices({ lookupStatus: 'pending', rows: [], optionsExpiresAt: null, requestGeneration: 3 });
  acceptEditionChoices(client, pickerIdentity, request, pendingReady, 'read');
  const readyAgain = selectedChoices({ lookupStatus: 'ready', requestGeneration: 3, optionsVersion: 2 });
  expect(acceptEditionChoices(client, pickerIdentity, request, readyAgain, 'read')).toMatchObject({
    lookupStatus: 'ready', rows: readyAgain.rows, optionsExpiresAt: readyAgain.optionsExpiresAt,
  });

  const failedAgain = selectedChoices({ lookupStatus: 'failed', rows: [], optionsExpiresAt: null,
    requestGeneration: 4, optionsVersion: 3 });
  acceptEditionChoices(client, pickerIdentity, request, failedAgain, 'read');
  expect(acceptEditionChoices(client, pickerIdentity, request,
    { ...failedAgain, lookupStatus: 'pending' }, 'read')).toMatchObject({
    lookupStatus: 'failed', selection: failedAgain.selection,
  });
});
it('C9 rejects ready and failed reads at the same counters after an idle read was accepted', () => {
  const ready = pickerChoices();
  const idle = { ...ready, lookupStatus: 'idle' as const, rows: [], optionsExpiresAt: null };
  acceptEditionChoices(client, pickerIdentity, request, idle, 'read');
  expect(acceptEditionChoices(client, pickerIdentity, request, ready, 'read')).toMatchObject({
    lookupStatus: 'idle', rows: [], optionsExpiresAt: null,
  });
  expect(acceptEditionChoices(client, pickerIdentity, request, { ...ready, lookupStatus: 'failed' }, 'read')).toMatchObject({
    lookupStatus: 'idle', rows: [], optionsExpiresAt: null,
  });
});
it('C10 keeps fresh rows for a same-counter selection and drops them for a newer one', () => {
  const ready = pickerChoices();
  acceptEditionChoices(client, pickerIdentity, request, ready, 'read');
  const same = selectedChoices({ rows: [], optionsExpiresAt: null });
  expect(acceptEditionChoices(client, pickerIdentity, request, same, 'selection')).toMatchObject({
    rows: ready.rows, optionsExpiresAt: ready.optionsExpiresAt, lookupStatus: 'ready',
  });
  const newer = selectedChoices({ rows: [], optionsExpiresAt: null, optionsVersion: 2, lookupStatus: 'pending' });
  expect(acceptEditionChoices(client, pickerIdentity, request, newer, 'selection')).toMatchObject({
    rows: [], optionsExpiresAt: null, lookupStatus: 'pending', requestGeneration: 1, optionsVersion: 2,
  });
});
it('C10b drops rows when only the selection receipt generation advances', () => {
  const ready = pickerChoices();
  acceptEditionChoices(client, pickerIdentity, request, ready, 'read');
  const newer = selectedChoices({ rows: [], optionsExpiresAt: null, requestGeneration: 2, lookupStatus: 'pending' });
  expect(acceptEditionChoices(client, pickerIdentity, request, newer, 'selection')).toMatchObject({
    rows: [], optionsExpiresAt: null, lookupStatus: 'pending', requestGeneration: 2, optionsVersion: 1,
  });
});
it.each([
  ['ready', 1, 1], ['failed', 1, 1], ['ready', 2, 1], ['failed', 2, 1], ['ready', 1, 2], ['failed', 1, 2],
] as const)('C11 drops rows and expiry for an accepted terminal %s receipt at G%s/V%s that is unusable',
  (status, requestGeneration, optionsVersion) => {
    const before = pickerChoices();
    acceptEditionChoices(client, pickerIdentity, request, before, 'read');
    expect(acceptEditionLookupReceipt(client, pickerIdentity, request, {
      operationId: testUuid(40), status, requestGeneration, optionsVersion, available: false,
    })).toBe(true);
    expect(client.getQueryData(choicesKey())).toMatchObject({
      rows: [], optionsExpiresAt: null, lookupStatus: status, requestGeneration, optionsVersion,
      selection: before.selection,
    });
  });
