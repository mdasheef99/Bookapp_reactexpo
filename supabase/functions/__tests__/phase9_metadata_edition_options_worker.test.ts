import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { editionWorkerFixture, explicitContext, automaticContext } from './fixtures/phase9/editionOptionsWorker';

// RED targets: incorrect purpose dispatch/early winner exit, false ready, stale acceptance,
// repeated egress on replay, incorrect per-request billing, and missing concurrency refill.
const until = async (condition: () => boolean) => {
  for (let index = 0; index < 100 && !condition(); index += 1) {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  expect(condition()).toBe(true);
};
const invokeDirect = (fixture: ReturnType<typeof editionWorkerFixture>, signal: AbortSignal) => {
  let execute: typeof import('../_shared/imageInventory/runtime/metadataEditionOptions').executeEditionOptionsLookup | undefined;
  try { execute = require('../_shared/imageInventory/runtime/metadataEditionOptions').executeEditionOptionsLookup; }
  catch { /* Assert the missing entry point, rather than failing module discovery. */ }
  expect(execute).toEqual(expect.any(Function));
  const { context, gateway } = fixture.direct();
  return execute!(context, gateway, fixture.adapter, signal);
};

describe('Task 4 explicit metadata worker (picker §§4.1-4.3/5/9)', () => {
  it.each(['ready', 'needs_review', 'possible_duplicate'])('decodes %s explicit cards without resetting them', state => {
    const context = decodeMetadataJobContext({ ...explicitContext, candidateState: state });
    expect(context).toMatchObject({ purpose: 'edition_options', candidateState: state, requestGeneration: 0 });
  });
  it('defaults legacy v2 context purpose to automatic', () => {
    expect(decodeMetadataJobContext(automaticContext)).toMatchObject({ purpose: 'automatic', candidateState: 'processing' });
  });
  it.each([
    { purpose: 'other' }, { requestGeneration: -1 }, { requestGeneration: 0.5 },
    { requestGeneration: undefined }, { candidateState: 'committed' },
    { optionsVersion: -1 }, { optionsAvailable: 'yes' }, { contractVersion: 'p9-metadata-job-context-v1' },
  ])('rejects invalid operation context %j', change => {
    expect(() => decodeMetadataJobContext({ ...explicitContext, ...change })).toThrow();
  });
  it('obtains ten original positions in one request despite local/winner-only cache clues', async () => {
    const fixture = editionWorkerFixture();
    Object.assign(fixture.current(), { localCanonicalEditionId: 'local-winner',
      reusableLookupId: 'cached-winner', reusableOutcome: 'accepted_metadata_match' });
    expect(await fixture.run()).toEqual({ claimed: 1, results: [{ outcome: 'edition_options_available' }] });
    const saved = fixture.saved.get('candidate-1')!;
    expect(saved.rows).toHaveLength(10);
    expect(saved.rows.map(row => row.ordinal)).toEqual([0,1,2,3,4,5,6,7,8,9]);
    expect(saved.rows[1]).toMatchObject({ ordinal: 1, eligibility: 'unavailable', metadata: null });
    expect(saved.rows[3].eligibility).toBe('ineligible');
    expect(saved.rows[0].metadata).toMatchObject({ matchRationale: 'exact_validated_isbn' });
    expect(saved.rows[2].metadata?.providerRecordId).toBe(saved.rows[0].metadata?.providerRecordId);
    expect(fixture.stats().providerRequests).toBe(1);
    expect(fixture.calls.filter(call => /cache|coalesc|local_metadata|select_structural/u.test(call.name))).toEqual([]);
  });
  it('keeps automatic local winner execution and options storage independent', async () => {
    const fixture = editionWorkerFixture();
    Object.keys(fixture.current()).forEach(key => { delete fixture.current()[key]; });
    Object.assign(fixture.current(), automaticContext, { localCanonicalEditionId: 'local-winner' });
    expect((await fixture.run()).results).toEqual([{ outcome: 'local_canonical_match' }]);
    expect(fixture.saved.size).toBe(0);
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('does not invoke or send explicit cards to legacy completion when the SQL boundary is absent', async () => {
    const fixture = editionWorkerFixture();
    const { editionOptionsBoundary: _boundary, ...dependencies } = fixture.dependencies;
    expect((await runMetadataWorkerBatch(1, dependencies)).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fixture.stats().providerRequests).toBe(0);
    expect(fixture.calls.some(call => call.name === 'phase9_fail_metadata_job')).toBe(false);
  });
  it('does not misroute malformed explicit v1 context rejection through automatic snapshot failure', async () => {
    const fixture = editionWorkerFixture();
    fixture.current().contractVersion = 'p9-metadata-job-context-v1';
    await fixture.run();
    expect(fixture.calls.some(call => call.name === 'phase9_fail_metadata_job')).toBe(false);
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('preserves a saved choice and all selling details on explicit completion', async () => {
    const fixture = editionWorkerFixture();
    const before = JSON.stringify([...fixture.selections]);
    await fixture.run();
    expect(JSON.stringify([...fixture.selections])).toBe(before);
    expect(fixture.saved.size).toBe(1);
    const physical = fixture.calls.find(call => call.name === 'phase9_finalize_metadata_provider_call')!;
    expect(physical.parameters.p_normalized_candidate).toBeNull();
    expect(physical.parameters.p_match_evidence).toEqual([]);
  });
  it('waits for bounded private persistence before reporting available', async () => {
    const fixture = editionWorkerFixture();
    let release!: () => void;
    let entered = false;
    fixture.controls.beforeComplete = () => new Promise<void>(resolve => { entered = true; release = resolve; });
    let completed = false;
    const run = fixture.run().then(result => { completed = true; return result; });
    try {
      await until(() => entered);
      expect(completed).toBe(false);
      expect(fixture.saved.size).toBe(0);
    } finally { release?.(); }
    expect((await run).results[0].outcome).toBe('edition_options_available');
  });
  it('exposes a retry when persistence fails after separately finalizing physical billing', async () => {
    const fixture = editionWorkerFixture();
    fixture.controls.failPersistence = true;
    expect((await fixture.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(fixture.saved.size).toBe(0);
    expect(fixture.physicalCalls).toEqual([{ jobId: 'job-1', attempt: 1, finalized: true }]);
  });
  it('recovers saved completion after response loss without another provider request', async () => {
    const fixture = editionWorkerFixture();
    fixture.controls.loseCompletionResponse = true;
    await fixture.run();
    expect(fixture.saved.size).toBe(1);
    fixture.requeue();
    expect((await fixture.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
    expect(fixture.stats().providerRequests).toBe(1);
    expect(fixture.physicalCalls).toHaveLength(1);
  });
  it('reuses a fresh empty set without interpreting zero rows as no result', async () => {
    const fixture = editionWorkerFixture();
    fixture.controls.payload = { kind: 'books#volumes', totalItems: 0 };
    expect((await fixture.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
    expect(fixture.saved.get('candidate-1')!.rows).toEqual([]);
    fixture.requeue();
    expect((await fixture.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
    expect(fixture.stats().providerRequests).toBe(1);
  });
  it('counts a 429 and its subsequent retry as two actual requests, one logical attempt', async () => {
    const fixture = editionWorkerFixture();
    fixture.controls.status = 429;
    expect((await fixture.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(fixture.saved.size).toBe(0);
    fixture.controls.status = 200;
    fixture.requeue({ currentLookupId: 'lookup-job-1', currentAttemptId: 'attempt-job-1',
      currentAttemptDisposition: 'unresolved', currentAttemptCandidate: null,
      currentPhysicalStatus: 'finalized', currentPhysicalClaimAttempt: 1,
      currentPhysicalOutcome: 'rate_limited', currentPhysicalRetryable: true });
    expect((await fixture.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
    expect(fixture.stats().providerRequests).toBe(2);
    expect(fixture.physicalCalls.map(call => call.attempt)).toEqual([1, 2]);
    expect(fixture.calls.filter(call => call.name === 'phase9_register_structural_metadata_attempt')).toHaveLength(1);
  });
  it.each([
    ['generation', { requestGeneration: 1 }], ['identity', { queryIdentity: 'changed' }],
    ['candidate', { candidateId: 'another' }], ['store', { storeId: 'another' }],
    ['session', { sessionId: 'another' }], ['lease', { claimToken: 'expired' }],
    ['attempt', { attempt: 2 }], ['commit', { candidateState: 'committed' }],
  ])('rejects late %s replies at completion', async (_name, changes) => {
    const fixture = editionWorkerFixture();
    fixture.controls.beforeComplete = async () => { Object.assign(fixture.current(), changes); };
    expect((await fixture.run()).results).toEqual([{ outcome: 'stale_claim' }]);
    expect(fixture.saved.size).toBe(0);
    expect(fixture.stats().providerRequests).toBe(1);
  });
  it.each(['ownerActive', 'uncommitted'] as const)('rejects capability/removal fence %s after provider completion', async field => {
    const fixture = editionWorkerFixture();
    fixture.controls.beforeComplete = async () => { fixture.controls[field] = false; };
    expect((await fixture.run()).results).toEqual([{ outcome: 'stale_claim' }]);
    expect(fixture.saved.size).toBe(0);
  });
  it.each([
    { permission: false }, { deadline: null }, { deadline: 'invalid' },
    { deadline: '2020-01-01T00:00:00Z' },
  ])('denies retention without verified permission and a current deadline %j', async change => {
    const fixture = editionWorkerFixture();
    Object.assign(fixture.controls, change);
    expect((await fixture.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fixture.saved.size).toBe(0);
    expect(fixture.physicalCalls[0]?.finalized).toBe(true);
  });
  it('does not persist choices after physical-call finalization rejects a stale claim', async () => {
    const fixture = editionWorkerFixture();
    fixture.controls.rejectPhysical = true;
    expect((await fixture.run()).results).toEqual([{ outcome: 'stale_claim' }]);
    expect(fixture.saved.size).toBe(0);
  });
  it('cancels before egress without a physical reservation or provider request', async () => {
    const fixture = editionWorkerFixture();
    const controller = new AbortController(); controller.abort();
    expect(await invokeDirect(fixture, controller.signal)).toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.stats().providerRequests).toBe(0);
    expect(fixture.physicalCalls).toHaveLength(0);
  });
  it('runs automatic then explicit then expired fresh explicit with separate operation attempts', async () => {
    const fixture = editionWorkerFixture();
    Object.keys(fixture.current()).forEach(key => { delete fixture.current()[key]; });
    Object.assign(fixture.current(), automaticContext, { localCanonicalEditionId: 'local-winner' });
    expect((await fixture.run()).results[0].outcome).toBe('local_canonical_match');
    fixture.newRequest();
    expect((await fixture.run()).results[0].outcome).toBe('edition_options_available');
    const first = fixture.saved.get('candidate-1')!;
    fixture.saved.set('candidate-1', { ...first, optionsExpiresAt: '2020-01-01T00:00:00Z' });
    fixture.newRequest();
    expect((await fixture.run()).results[0].outcome).toBe('edition_options_available');
    expect(fixture.stats().providerRequests).toBe(2);
    expect(fixture.calls.filter(call => call.name === 'phase9_register_structural_metadata_attempt')
      .map(call => call.parameters.p_lookup_id)).toEqual(['lookup-job-2', 'lookup-job-3']);
  });
  it('rechecks identity before provider egress', async () => {
    const fixture = editionWorkerFixture();
    let reads = 0;
    fixture.controls.beforeContextRead = () => {
      if (++reads === 2) fixture.current().requestGeneration = 1;
    };
    expect((await fixture.run()).results[0].outcome).toBe('stale_claim');
    expect(fixture.stats().providerRequests).toBe(0);
    expect(fixture.physicalCalls).toHaveLength(0);
  });
  it('permits selling/version changes without replacing the newer selection', async () => {
    const fixture = editionWorkerFixture();
    fixture.controls.beforeComplete = async () => {
      fixture.current().candidateVersion = 2;
      fixture.selections.set('candidate-1', { selectionId: 'newer-owner-choice', price: 700, quantity: 3, notes: 'new' });
    };
    expect((await fixture.run()).results[0].outcome).toBe('edition_options_available');
    expect(fixture.selections.get('candidate-1')).toEqual({
      selectionId: 'newer-owner-choice', price: 700, quantity: 3, notes: 'new',
    });
  });
  it('rejects cancellation while a request is in flight and still records the actual call', async () => {
    const fixture = editionWorkerFixture();
    const controller = new AbortController();
    fixture.controls.beforeFetch = async () => { controller.abort(); };
    expect(await invokeDirect(fixture, controller.signal)).toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.saved.size).toBe(0);
    expect(fixture.stats().providerRequests).toBe(1);
    expect(fixture.physicalCalls[0]?.finalized).toBe(true);
  });
  it('denies egress when registry storage policy is disabled', async () => {
    const fixture = editionWorkerFixture();
    fixture.current().providerPolicies = [{ ...automaticContext.providerPolicies[0], storageAllowed: false }];
    expect((await fixture.run()).results[0].outcome).toBe('manual_metadata_required');
    expect(fixture.stats().providerRequests).toBe(0);
    expect(fixture.saved.size).toBe(0);
  });
  it('enforces fifteen jobs and three active jobs, refilling a freed slot immediately', async () => {
    const fixture = editionWorkerFixture(16);
    const releases: Array<() => void> = [];
    let hold = true;
    fixture.controls.beforeFetch = () => hold ? new Promise<void>(resolve => { releases.push(resolve); }) : Promise.resolve();
    const run = fixture.run(15);
    try {
      await until(() => releases.length === 3);
      releases[0]();
      await until(() => releases.length === 4);
      expect(fixture.stats().active).toBe(3);
    } finally { hold = false; releases.forEach(release => release()); }
    expect((await run).claimed).toBe(15);
    expect(fixture.stats()).toMatchObject({ providerRequests: 15, maximumActive: 3 });
    expect(fixture.saved.size).toBe(15);
  });
});
