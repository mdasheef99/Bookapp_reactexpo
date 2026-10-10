jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { OwnerUxClientError } from '../api/ownerUxService';
import { InventoryCommitCoordinator } from '../commit/inventoryCommitCoordinator';
import { candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';
import { buildCompactReview } from '../review/compactReviewDraft';
import { selectedChoices, pickerCard, pickerDetail, pickerReview, pickerDefaults } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

function harness() {
  let serial = 0;
  let value = pickerReview;
  const choices = selectedChoices({ reviewVersion: 1 });
  const saveReview = jest.fn(async (request) => { value = request.review; return pickerDetail(choices, value); });
  const readCandidate = jest.fn(async () => pickerDetail(choices, value));
  const result = { sessionId: choices.sessionId, candidateId: choices.candidateId,
    candidateVersion: 6, inventoryId: testUuid(90), inventoryVersion: 1, outcome: 'committed_private' as const };
  const commitCandidate = jest.fn(async (_request) => result);
  const synchronizeSuccess = jest.fn(async () => undefined);
  const synchronizeIneligible = jest.fn(async () => undefined);
  const coordinator = new InventoryCommitCoordinator({ saveReview, readCandidate, commitCandidate,
    synchronizeSuccess, synchronizeIneligible, createCommandId: () => testUuid(100 + ++serial),
    createIdempotencyKey: prefix => prefix + ':fixed-command-' + ++serial });
  const card = pickerCard(choices, pickerReview);
  const draft = { card, edits: { priceMinor: 100 }, acceptedAuthorityKey: candidateCommitAuthorityKey(card) };
  return { coordinator, draft, result, saveReview, readCandidate, commitCandidate, synchronizeIneligible };
}
it('compact review preserves unsaved notes and explicit null script before Save', () => {
  const card = pickerCard(selectedChoices({ reviewVersion: 1 }), pickerReview);
  expect(buildCompactReview(card, pickerDefaults, {
    script: null, notes: { publicNote: '', internalNote: 'latest unsaved' },
  })).toMatchObject({ script: null, notes: { publicNote: null, internalNote: 'latest unsaved' } });
});
it.each(['single', 'bulk'] as const)('%s saves latest coherent controlled choice and selling fields before Add', async kind => {
  const h = harness();
  const draft = { ...h.draft, edits: { priceMinor: 0, quantity: 6, notes: { publicNote: null, internalNote: 'saved' } } };
  if (kind === 'single') await expect(h.coordinator.addCandidate(draft)).resolves.toMatchObject({ status: 'succeeded' });
  else expect((await h.coordinator.runAddAll(h.coordinator.freezeAddAll([draft]))).succeeded).toBe(1);
  expect(h.saveReview).toHaveBeenCalledWith(expect.objectContaining({ review: expect.objectContaining({
    metadataChoice: pickerReview.metadataChoice, quantity: 6, priceMinor: 0,
    notes: { publicNote: null, internalNote: 'saved' },
  }) }));
  expect(h.saveReview.mock.invocationCallOrder[0]).toBeLessThan(h.commitCandidate.mock.invocationCallOrder[0]);
  expect(h.commitCandidate.mock.calls[0][0]).toMatchObject({
    expectedMetadataRevision: 8, expectedReviewVersion: 1,
  });
  expect(h.commitCandidate.mock.calls[0][0]).not.toHaveProperty('providerId');
});
it('a changed Owner draft cannot supersede an uncertain Add until the original Add is reconciled', async () => {
  const h = harness();
  h.commitCandidate.mockRejectedValueOnce(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'uncertain'))
    .mockResolvedValueOnce(h.result);
  await expect(h.coordinator.addCandidate(h.draft)).resolves.toMatchObject({ status: 'still_pending' });
  const original = h.commitCandidate.mock.calls[0][0];
  await expect(h.coordinator.retryCandidate(h.draft.card.candidateId, {
    ...h.draft, edits: { priceMinor: 0, quantity: 9 },
  })).resolves.toMatchObject({ status: 'succeeded' });
  expect(h.saveReview).toHaveBeenCalledTimes(1);
  expect(h.commitCandidate.mock.calls[1][0]).toEqual(original);
});
it('a fresh Add call also reconciles the uncertain prior command before saving another draft', async () => {
  const h = harness();
  h.commitCandidate.mockRejectedValueOnce(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'uncertain'))
    .mockResolvedValueOnce(h.result);
  await h.coordinator.addCandidate(h.draft);
  await h.coordinator.addCandidate({ ...h.draft, edits: { priceMinor: 0, quantity: 9 } });
  expect(h.saveReview).toHaveBeenCalledTimes(1);
  expect(h.commitCandidate.mock.calls[1][0]).toEqual(h.commitCandidate.mock.calls[0][0]);
});
it('bulk retry preserves uncertain Add identity before considering a changed selling draft', async () => {
  const h = harness();
  h.commitCandidate.mockRejectedValueOnce(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'uncertain'))
    .mockResolvedValueOnce(h.result);
  const command = h.coordinator.freezeAddAll([h.draft]);
  await h.coordinator.runAddAll(command);
  const result = await h.coordinator.retryAddAll(command, [{ ...h.draft, edits: { priceMinor: 0, quantity: 9 } }]);
  expect(result.succeeded).toBe(1);
  expect(h.saveReview).toHaveBeenCalledTimes(1);
  expect(h.commitCandidate.mock.calls[1][0]).toEqual(h.commitCandidate.mock.calls[0][0]);
});
it('generic transport loss during Add is uncertain and cannot permit a new selection claim', async () => {
  const h = harness();
  h.commitCandidate.mockRejectedValueOnce(new Error('transport lost'));
  await expect(h.coordinator.addCandidate(h.draft)).resolves.toMatchObject({ status: 'still_pending' });
  expect(h.coordinator.tryClaim(h.draft.card.candidateId, 'edition-selection')).toBeNull();
});
it('current authority for another controlled choice stops Add instead of silently committing it', async () => {
  const h = harness();
  const changed = { ...pickerReview, metadataChoice: { mode: 'edition_option' as const, selectionId: testUuid(31) } };
  h.readCandidate.mockResolvedValueOnce(pickerDetail(selectedChoices({ reviewVersion: 2,
    selection: { ...selectedChoices().selection!, selectionId: testUuid(31) } }), changed));
  await expect(h.coordinator.addCandidate(h.draft)).resolves.toMatchObject({ status: 'no_longer_eligible' });
  expect(h.commitCandidate).not.toHaveBeenCalled();
  expect(h.synchronizeIneligible).toHaveBeenCalledTimes(1);
});
// Independent Task 6 review: picker §7 / Unit 6G §§12-14, resolved uncertainty.
it.each(['single', 'bulk'] as const)('%s authoritative replay rejection releases the unresolved Add guard', async kind => {
  const h = harness();
  const id = h.draft.card.candidateId;
  h.commitCandidate.mockRejectedValueOnce(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'uncertain'))
    .mockRejectedValueOnce(new OwnerUxClientError('P9_CANDIDATE_VERSION_CONFLICT', true, 'changed'));
  const command = h.coordinator.freezeAddAll(kind === 'bulk' ? [h.draft] : []);
  if (kind === 'single') await h.coordinator.addCandidate(h.draft);
  else await h.coordinator.runAddAll(command);
  expect(h.coordinator.tryClaim(id, 'edition-selection')).toBeNull();
  if (kind === 'single') await expect(h.coordinator.retryCandidate(id)).resolves.toMatchObject({ status: 'no_longer_eligible' });
  else expect((await h.coordinator.retryAddAll(command)).noLongerEligible).toBe(1);
  expect(h.commitCandidate.mock.calls[1][0]).toEqual(h.commitCandidate.mock.calls[0][0]);
  expect(h.synchronizeIneligible).toHaveBeenCalledTimes(1);
  const token = h.coordinator.tryClaim(id, 'edition-selection');
  expect(token).not.toBeNull();
  if (token) h.coordinator.releaseSlot(id, token);
});
