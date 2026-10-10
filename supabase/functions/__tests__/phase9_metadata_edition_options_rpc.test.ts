import type { EditionOptionsFence, MetadataEditionOptionsBoundary } from '../_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
const fence: EditionOptionsFence = {
  jobId: '00000000-0000-4000-8000-000000000001', requestId: '00000000-0000-4000-8000-000000000001',
  candidateId: '00000000-0000-4000-8000-000000000002', storeId: '00000000-0000-4000-8000-000000000003',
  sessionId: '00000000-0000-4000-8000-000000000004', claimWorker: 'picker-worker-0001',
  claimLeaseToken: 'a'.repeat(64), claimAttempt: 1, requestGeneration: 2, queryIdentity: 'fixture-query',
};
const receipt = { status: 'completed', requestId: fence.requestId, requestGeneration: 2,
  optionsVersion: 1, optionsExpiresAt: '2026-10-08T00:00:00Z' };
function boundary(data: unknown, error: unknown = null): MetadataEditionOptionsBoundary {
  let create: ((client: unknown) => MetadataEditionOptionsBoundary) | undefined;
  try { create = require('../_shared/imageInventory/runtime/metadataEditionOptionsRpc').createMetadataEditionOptionsBoundary; }
  catch { /* Missing production boundary is asserted as the semantic RED. */ }
  expect(create).toEqual(expect.any(Function));
  return create!({ rpc: async () => ({ data, error }) });
}
describe('Task 4 controlled RPC receipts (picker §§5/8-9)', () => {
  it('decodes the completed private operation without a payload', async () => {
    expect(await boundary(receipt).complete({ ...fence, lookupId: fence.candidateId,
      attemptId: fence.sessionId, sourceFetchedAt: '2026-10-07T00:00:00Z',
      optionsExpiresAt: receipt.optionsExpiresAt, storagePermissionVerified: true, rows: [] })).toEqual(receipt);
  });
  it.each(['missing','stale_rejected'])('decodes %s recovery', async status => {
    expect(await boundary({status}).recover(fence)).toEqual({status});
  });
  it.each([
    { ...receipt, rows: [] }, { ...receipt, requestGeneration: 3 },
    { ...receipt, requestId: fence.candidateId }, { ...receipt, optionsVersion: 0 },
    { ...receipt, optionsVersion: 1.5 }, { ...receipt, optionsExpiresAt: 'invalid' },
    { status:'unknown' },
  ])('rejects malformed or cross-request completion %j', async data => {
    await expect(boundary(data).recover(fence)).rejects.toThrow('P9_EDITION_COMPLETION_INVALID');
  });
  it.each(['retry_scheduled','resolved','dead_letter'])('decodes controlled failure %s',async status=>{
    expect(await boundary({status,manual_outcome:null}).fail({...fence,outcome:'provider_unavailable',retryable:true}))
      .toEqual({status});
  });
  it('rejects automatic snapshot payloads on the explicit failure path',async()=>{
    await expect(boundary({status:'resolved',snapshot_id:fence.candidateId}).fail({
      ...fence,outcome:'policy_denied',retryable:false })).rejects.toThrow('P9_EDITION_COMPLETION_INVALID');
  });
  it('keeps RPC failure details private',async()=>{
    await expect(boundary(null,{message:'raw private provider payload'}).recover(fence))
      .rejects.toThrow('P9_METADATA_RPC_FAILED:phase9_recover_candidate_edition_options_v1');
  });
});

// SQL proposal §3.6: preserve only the allowlisted deterministic rejection, never raw SQL/provider data.
it.each([new Error('P9_EDITION_ROWS_INVALID'), { code: 'P0001', message: 'P9_EDITION_ROWS_INVALID' }])(
  'exposes the safe normalized rejection from completion', async error => {
    await expect(boundary(null, error).complete({ ...fence, lookupId: fence.candidateId,
      attemptId: fence.sessionId, sourceFetchedAt: '2026-10-07T00:00:00Z',
      optionsExpiresAt: receipt.optionsExpiresAt, storagePermissionVerified: true, rows: [] }))
      .rejects.toThrow(/^P9_EDITION_ROWS_INVALID$/);
  });
it('keeps unrecognized completion errors opaque', async () => {
  await expect(boundary(null, { message: 'raw private SQL or provider payload' }).complete({
    ...fence, lookupId: fence.candidateId, attemptId: fence.sessionId,
    sourceFetchedAt: '2026-10-07T00:00:00Z', optionsExpiresAt: receipt.optionsExpiresAt,
    storagePermissionVerified: true, rows: [],
  })).rejects.toThrow(/^P9_METADATA_RPC_FAILED:phase9_complete_candidate_edition_options_v1$/);
});