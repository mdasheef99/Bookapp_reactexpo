import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import type { EditionOptionsProviderResult } from '../_shared/imageInventory/metadata/contracts';

// Picker §§4.3/5/9 and Master MAS-02/17: crash/replay and deterministic rejection.
describe('Task 4 completion recovery and validation', () => {
  it('does not repeat a known finalized 429 under the same claim', async () => {
    const fixture = editionWorkerFixture();
    Object.assign(fixture.current(), {
      currentLookupId: 'lookup-job-1', currentAttemptId: 'attempt-job-1',
      currentAttemptDisposition: 'unresolved', currentPhysicalStatus: 'finalized',
      currentPhysicalClaimAttempt: 1, currentPhysicalOutcome: 'rate_limited', currentPhysicalRetryable: true,
    });
    expect((await fixture.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(fixture.stats().providerRequests).toBe(0);
    expect(fixture.physicalCalls).toHaveLength(0);
  });
  it('exposes recoverable missing persistence after a known successful physical response', async () => {
    const fixture = editionWorkerFixture();
    Object.assign(fixture.current(), {
      currentLookupId: 'lookup-job-1', currentAttemptId: 'attempt-job-1',
      currentAttemptDisposition: 'unresolved', currentPhysicalStatus: 'finalized',
      currentPhysicalClaimAttempt: 1, currentPhysicalOutcome: 'coherent_match', currentPhysicalRetryable: false,
    });
    expect((await fixture.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(fixture.saved.size).toBe(0);
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('classifies a removed/committed context during egress as stale without legacy fallback', async () => {
    const fixture = editionWorkerFixture();
    let reads = 0;
    fixture.controls.beforeContextRead = () => {
      if (++reads === 2) fixture.current().candidateState = 'committed';
    };
    expect((await fixture.run()).results).toEqual([{ outcome: 'stale_claim' }]);
    expect(fixture.stats().providerRequests).toBe(0);
    expect(fixture.calls.some(call => call.name === 'phase9_fail_metadata_job')).toBe(false);
  });
  it('keeps two same-book cards private with independent source and option identities', async () => {
    const fixture = editionWorkerFixture(2);
    expect((await fixture.run()).results.map(result => result.outcome)).toEqual([
      'edition_options_available', 'edition_options_available',
    ]);
    const first = fixture.saved.get('candidate-1')!;
    const second = fixture.saved.get('candidate-2')!;
    expect(first.rows[0].optionId).not.toBe(second.rows[0].optionId);
    expect(first.lookupId).not.toBe(second.lookupId);
    expect(fixture.stats().providerRequests).toBe(2);
  });
  it('rejects a completion receipt for another request without exposing payloads', async () => {
    const fixture = editionWorkerFixture();
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies,
      editionOptionsBoundary: {
        ...fixture.boundary,
        complete: async input => ({
          status: 'completed', requestId: 'another-request', requestGeneration: input.requestGeneration,
          optionsVersion: 1, optionsExpiresAt: input.optionsExpiresAt,
        }),
      },
    });
    expect(result.results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(fixture.saved.size).toBe(0);
    expect(JSON.stringify(result)).not.toContain('Fixture Book');
  });
  const mutations: Array<[string, (result: EditionOptionsProviderResult) => EditionOptionsProviderResult]> = [
    ['unknown normalized field', result => ({ ...result, rows: [
      { ...result.rows[0], metadata: { ...result.rows[0].metadata!, sellingPrice: 500 } }, ...result.rows.slice(1),
    ] })],
    ['unsafe own cover', result => ({ ...result, rows: [
      { ...result.rows[0], metadata: { ...result.rows[0].metadata!, coverReference: 'https://evil.example/cover' } },
      ...result.rows.slice(1),
    ] })],
    ['selectable null row', result => ({ ...result, rows: [
      { ...result.rows[0], metadata: null }, ...result.rows.slice(1),
    ] })],
    ['wrong original position', result => ({ ...result, rows: [
      { ...result.rows[0], ordinal: 4 }, ...result.rows.slice(1),
    ] })],
    ['duplicate option UUID', result => ({ ...result, rows: result.rows.map((row, index) =>
      index === 2 ? { ...row, optionId: result.rows[0].optionId } : row) })],
    ['wrong attempt lineage', result => ({ ...result, rows: [
      { ...result.rows[0], metadata: { ...result.rows[0].metadata!, attemptId: 'another-attempt' } },
      ...result.rows.slice(1),
    ] })],
    ['eleven results', result => ({ ...result, rows: [...result.rows, result.rows[0]] })],
  ];
  it.each(mutations)('rejects %s as nonretryable schema failure after physical accounting', async (_name, mutate) => {
    const fixture = editionWorkerFixture();
    const lookup = fixture.adapter.lookupEditionOptions.bind(fixture.adapter);
    fixture.adapter.lookupEditionOptions = async input => mutate(await lookup(input));
    expect((await fixture.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fixture.saved.size).toBe(0);
    expect(fixture.stats().providerRequests).toBe(1);
    expect(fixture.physicalCalls[0].finalized).toBe(true);
  });
});

// Picker §§4.1/5/9, SQL proposal §3.6: deterministic SQL rejection is not a provider outage.
it('does not retry a normalized contract rejection from completion', async () => {
  const fixture = editionWorkerFixture();
  fixture.controls.beforeComplete = () => { throw new Error('P9_EDITION_ROWS_INVALID'); };
  const failed = jest.spyOn(fixture.boundary, 'fail');
  expect((await fixture.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(failed).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'schema_invalid', retryable: false }));
  expect(fixture.saved.size).toBe(0);
  expect(fixture.stats().providerRequests).toBe(1);
  expect(fixture.physicalCalls[0].finalized).toBe(true);
});
it('recovers a committed receipt before classifying a completion error', async () => {
  const fixture = editionWorkerFixture();
  const complete = fixture.boundary.complete;
  jest.spyOn(fixture.boundary, 'complete').mockImplementation(async input => {
    await complete(input);
    throw new Error('P9_EDITION_ROWS_INVALID');
  });
  const failed = jest.spyOn(fixture.boundary, 'fail');
  expect((await fixture.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(failed).not.toHaveBeenCalled();
  expect(fixture.saved.size).toBe(1);
  expect(fixture.stats().providerRequests).toBe(1);
});