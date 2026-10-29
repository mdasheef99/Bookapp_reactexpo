// 02b sections 5/10, AC7-13/17: fixture replay respects the SQL claim/scope contract.
import { catalogueWriteWorkerFixture } from './fixtures/phase9/catalogueWrite';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});
function fence(f: ReturnType<typeof catalogueWriteWorkerFixture>) {
  const c = f.fixture.current();
  return { jobId: String(c.jobId), claimWorker: f.fixture.dependencies.workerId,
    claimLeaseToken: String(c.claimToken), claimAttempt: Number(c.attempt),
    candidateId: String(c.candidateId), storeId: String(c.storeId), sessionId: String(c.sessionId),
    requestId: String(c.jobId), requestGeneration: Number(c.requestGeneration), queryIdentity: String(c.queryIdentity) };
}
test.each([
  ['claimWorker', 'another-worker-0001'], ['claimLeaseToken', 'f'.repeat(64)], ['claimAttempt', 2],
  ['candidateId', 'candidate-foreign'], ['storeId', 'store-foreign'], ['sessionId', 'session-foreign'],
  ['requestId', 'request-foreign'], ['requestGeneration', 1], ['queryIdentity', 'foreign-query'],
] as const)('completed fixture recovery refuses a changed %s', async (key, value) => {
  const f = catalogueWriteWorkerFixture();
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  await expect(f.boundary.recover({ ...fence(f), [key]: value })).resolves.toEqual({ status: 'stale_rejected' });
  expect(f.completions).toHaveLength(1); expect(f.urls).toHaveLength(3);
});
test('expired uncompleted lease refuses recovery; an exact completed claim retains its durable receipt', async () => {
  const f = catalogueWriteWorkerFixture();
  f.fixture.current().claimExpiresAt = '2000-01-01T00:00:00Z';
  await expect(f.boundary.recover(fence(f))).resolves.toEqual({ status: 'stale_rejected' });
  expect(f.urls).toEqual([]);
  f.fixture.current().claimExpiresAt = new Date(Date.now() + 60000).toISOString();
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  f.fixture.current().claimExpiresAt = '2000-01-01T00:00:00Z';
  await expect(f.boundary.recover(fence(f))).resolves.toMatchObject({ status: 'replayed', optionsVersion: 1 });
});
test('an expired durable receipt stays replayed and the worker refuses availability without refetching', async () => {
  const f = catalogueWriteWorkerFixture();
  await f.run();
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(String(f.committedReceipt()!.optionsExpiresAt)) + 1);
  try {
    await expect(f.boundary.recover(fence(f))).resolves.toMatchObject({ status: 'replayed', optionsVersion: 1 });
    const claim = { id: fence(f).jobId, attempt_count: fence(f).claimAttempt, lease_token: fence(f).claimLeaseToken };
    const dependencies = { ...f.fixture.dependencies, serviceClient: { rpc: async (name: string, p: Record<string, any>) =>
      name === 'claim_phase9_metadata_jobs' ? { data: [claim], error: null }
        : name === 'phase9_metadata_job_context' ? { data: f.fixture.current(), error: null }
          : { data: null, error: new Error('unexpected RPC ' + name) } }, editionOptionsBoundary: f.boundary };
    expect((await runMetadataWorkerBatch(1, dependencies)).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(f.urls).toHaveLength(3); expect(f.completions).toHaveLength(1);
  } finally { now.mockRestore(); }
});
