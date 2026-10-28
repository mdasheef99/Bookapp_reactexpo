// Round D / 02b sections 7.1/10, AC7-13/17: real worker + RPC boundary, recorded transport.
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { createMetadataEditionOptionsBoundary } from '../_shared/imageInventory/runtime/metadataEditionOptionsRpc';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});

function recoveryFixture(attempt = 2, physicalClaimAttempt = 1) {
  const fixture = editionWorkerFixture();
  Object.assign(fixture.current(), {
    attempt, currentPhysicalStatus: 'finalized', currentPhysicalClaimAttempt: physicalClaimAttempt,
    currentPhysicalRetryable: false, currentPhysicalOutcome: 'coherent_match',
  });
  const calls: Array<{ name: string; parameters: Record<string, any> }> = [];
  const controls = {
    unavailable: false, failFirstRecovery: false, rejectCompletion: false,
    receipt: null as Record<string, unknown> | null, jobStatus: 'in_progress',
  };
  let recoveryCount = 0;
  const rpc = async (name: string, parameters: Record<string, any>) => {
    calls.push({ name, parameters });
    if (name === 'phase9_recover_candidate_edition_options_v1') {
      recoveryCount += 1;
      if (controls.unavailable || (controls.failFirstRecovery && recoveryCount === 1)) {
        return { data: null, error: { message: 'recorded recovery outage' } };
      }
      return { data: controls.receipt ?? { status: 'missing' }, error: null };
    }
    if (name === 'phase9_fail_candidate_edition_options_v1') {
      // M68 failure RPC: a nonretryable provider_unavailable is a durable technical dead-letter.
      controls.jobStatus = parameters.p_retryable && parameters.p_attempt_count < 5
        ? 'retry_scheduled' : 'dead_letter';
      return { data: { status: controls.jobStatus }, error: null };
    }
    if (/^phase9_complete_candidate_edition_options_v[12]$/.test(name)) {
      if (controls.rejectCompletion) return { data: null, error: { message: 'recorded response loss' } };
      throw new Error('recovery-only job must not dispatch completion');
    }
    return fixture.dependencies.serviceClient.rpc(name, parameters);
  };
  const dependencies = { ...fixture.dependencies, serviceClient: { rpc },
    editionOptionsBoundary: createMetadataEditionOptionsBoundary({ rpc }) };
  const failures = () => calls.filter(call => call.name === 'phase9_fail_candidate_edition_options_v1');
  const completions = () => calls.filter(call => /^phase9_complete_candidate_edition_options_v[12]$/.test(call.name));
  const setReceipt = () => {
    controls.receipt = { status: 'replayed', requestId: 'job-1', requestGeneration: 0,
      optionsVersion: 1, optionsExpiresAt: new Date(Date.now() + 3600000).toISOString() };
  };
  return { fixture, calls, controls, failures, completions, setReceipt,
    run: () => runMetadataWorkerBatch(1, dependencies) };
}

test('AC7-13: continuing recovery outage after reclaim schedules no provider retry; later receipt wins', async () => {
  const f = recoveryFixture();
  f.controls.unavailable = true;
  for (const attempt of [2, 3]) {
    if (attempt > 2) f.fixture.requeue();
    expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(f.failures()).toEqual([]);
    expect(f.controls.jobStatus).toBe('in_progress');
    expect(f.fixture.current().attempt).toBe(attempt); // Claims still consume the existing DB budget.
  }
  f.controls.unavailable = false;
  f.setReceipt();
  f.fixture.requeue();
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(f.failures()).toEqual([]);
  expect(f.completions()).toEqual([]);
  expect(f.fixture.stats().providerRequests).toBe(0);
});

test.each([[2, 1], [5, 1]])(
  'AC7-17: missing receipt with finalized nonretryable response terminates claim %i (physical claim %i)',
  async (attempt, physicalClaimAttempt) => {
    const f = recoveryFixture(attempt, physicalClaimAttempt);
    expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(f.failures()).toHaveLength(1);
    expect(f.failures()[0].parameters).toMatchObject({
      p_attempt_count: attempt, p_failure_kind: 'provider_unavailable', p_retryable: false,
    });
    expect(f.controls.jobStatus).toBe('dead_letter');
    expect(f.calls.filter(call => ['phase9_recover_candidate_edition_options_v1',
      'phase9_fail_candidate_edition_options_v1'].includes(call.name)).map(call => call.name))
      .toEqual(['phase9_recover_candidate_edition_options_v1', 'phase9_fail_candidate_edition_options_v1']);
    expect(f.completions()).toEqual([]);
    expect(f.fixture.stats().providerRequests).toBe(0);
  },
);

test('same-claim finalized response preserves its bounded retry without provider egress', async () => {
  const f = recoveryFixture(1, 1);
  expect((await f.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
  expect(f.failures()).toHaveLength(1);
  expect(f.failures()[0].parameters.p_retryable).toBe(true);
  expect(f.completions()).toEqual([]);
  expect(f.fixture.stats().providerRequests).toBe(0);
});

test('AC7-17: second recovery proving missing also persists the terminal outcome', async () => {
  const f = recoveryFixture();
  f.controls.failFirstRecovery = true;
  expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(f.failures()).toHaveLength(1);
  expect(f.failures()[0].parameters.p_retryable).toBe(false);
  expect(f.controls.jobStatus).toBe('dead_letter');
  expect(f.completions()).toEqual([]);
  expect(f.fixture.stats().providerRequests).toBe(0);
});

test('AC7-13: saved receipt takes precedence over terminal failure for a reclaimed finalized call', async () => {
  const f = recoveryFixture();
  f.setReceipt();
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(f.failures()).toEqual([]);
  expect(f.completions()).toEqual([]);
  expect(f.fixture.stats().providerRequests).toBe(0);
});

test('AC7-13: a just-dispatched uncertain completion stays pending until a later claim proves missing', async () => {
  const f = recoveryFixture(1);
  Object.assign(f.fixture.current(), {
    currentPhysicalStatus: null, currentPhysicalClaimAttempt: null, currentPhysicalRetryable: null,
  });
  f.controls.rejectCompletion = true;
  expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(f.failures()).toEqual([]);
  expect(f.completions().map(call => call.name)).toEqual(['phase9_complete_candidate_edition_options_v2']);
  expect(f.fixture.stats().providerRequests).toBe(1);
  f.fixture.requeue({ currentPhysicalStatus: 'finalized', currentPhysicalClaimAttempt: 1,
    currentPhysicalRetryable: false, currentPhysicalOutcome: 'coherent_match' });
  expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(f.failures()).toHaveLength(1);
  expect(f.failures()[0].parameters.p_retryable).toBe(false);
  expect(f.controls.jobStatus).toBe('dead_letter');
  expect(f.completions()).toHaveLength(1);
  expect(f.fixture.stats().providerRequests).toBe(1);
});

test('a recovery outage without earlier physical evidence retains the ordinary retry path', async () => {
  const f = recoveryFixture(1);
  Object.assign(f.fixture.current(), {
    currentPhysicalStatus: null, currentPhysicalClaimAttempt: null, currentPhysicalRetryable: null,
  });
  f.controls.unavailable = true;
  expect((await f.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
  expect(f.failures()).toHaveLength(1);
  expect(f.failures()[0].parameters.p_retryable).toBe(true);
  expect(f.fixture.stats().providerRequests).toBe(0);
});
